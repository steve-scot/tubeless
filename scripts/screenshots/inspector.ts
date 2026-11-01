import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { connect, type Socket } from 'node:net';
import { decode, encode, type PlistValue } from './bplist.ts';

type Dict = Record<string, any>;
type Waiter = { target: string; resolve: (value: any) => void; reject: (error: Error) => void };

const SAFARI = 'com.apple.mobilesafari';

// A Web Inspector session on a simulator's Safari tab, over the simulator's
// webinspectord socket. Unlike WebDriver, this inspects an ordinary tab,
// where Safari runs extensions. One session follows the tab across
// navigations; a tab stays hidden from new sessions for a while after one
// ends, so reconnecting per page is slow.
export class Inspector {
  private socket: Socket;
  private buffer = Buffer.alloc(0);
  private connection = randomUUID().toUpperCase();
  private sender = randomUUID().toUpperCase();
  private apps: Dict = {};
  private listings = new Map<string, Dict>();
  private listeners: ((selector: string, arg: Dict) => void)[] = [];
  private pending = new Map<number, Waiter>();
  private nextId = 1;
  private app = '';
  private page = 0;
  private target: string | null = null;
  private closed: Error | null = null;

  private constructor(socket: Socket) {
    this.socket = socket;
    socket.on('data', (chunk) => this.receive(chunk as Buffer));
    socket.on('close', () => this.fail(new Error('The Web Inspector connection closed')));
    socket.on('error', (error) => this.fail(error));
  }

  // Attaches to the Safari tab whose URL passes `match`.
  static async attach(udid: string, match: (url: string) => boolean, timeout = 30_000): Promise<Inspector> {
    const path = execFileSync('xcrun', ['simctl', 'getenv', udid, 'RWI_LISTEN_SOCKET']).toString().trim();
    const socket = connect(path);
    await new Promise<void>((resolve, reject) => socket.once('connect', resolve).once('error', reject));
    const inspector = new Inspector(socket);
    inspector.send('_rpc_reportIdentifier:', {});
    try {
      await inspector.attachTo(match, timeout);
    } catch (error) {
      inspector.close();
      throw error;
    }
    return inspector;
  }

  close() {
    this.closed ??= new Error('Closed');
    this.socket.destroy();
  }

  get isClosed() {
    return this.closed !== null;
  }

  // Evaluates in the page, or in another context such as the extension's.
  // Promises are awaited; the result comes back as JSON-compatible data.
  async evaluate<T = any>(expression: string, opts: { context?: number; timeout?: number } = {}): Promise<T> {
    const evaluated = await this.call('Runtime.evaluate', {
      expression: `Promise.resolve((() => (${expression}))())`,
      ...(opts.context === undefined ? {} : { contextId: opts.context }),
    }, opts.timeout);
    if (evaluated.wasThrown) throw new Error(`evaluate: ${evaluated.result?.description}`);
    const awaited = await this.call('Runtime.awaitPromise', {
      promiseObjectId: evaluated.result.objectId,
      returnByValue: true,
    }, opts.timeout);
    if (awaited.wasThrown) throw new Error(`evaluate: ${awaited.result?.description ?? JSON.stringify(awaited.result)}`);
    return awaited.result?.value as T;
  }

  // Runs before the page's own scripts on every load, for as long as this
  // session lasts.
  async setBootstrapScript(source: string) {
    await this.call('Page.enable');
    await this.call('Page.setBootstrapScript', { source });
  }

  // The isolated world Safari gives the extension's content script, where
  // `browser.*` is available.
  async extensionContext(): Promise<number> {
    const tree = await this.call('Page.getResourceTree');
    const mainFrame = tree.frameTree.frame.id;
    const contexts: Dict[] = [];
    const listener = (selector: string, arg: Dict) => {
      const message = this.unwrap(selector, arg);
      if (message?.method === 'Runtime.executionContextCreated') contexts.push(message.params.context);
    };
    this.listeners.push(listener);
    try {
      await this.call('Runtime.disable');
      await this.call('Runtime.enable');
      await new Promise((r) => setTimeout(r, 500));
    } finally {
      this.listeners = this.listeners.filter((l) => l !== listener);
    }
    const context = contexts.find((c) => c.frameId === mainFrame && c.name.startsWith('WebExtension-'));
    if (!context) throw new Error('The extension is not running in this tab');
    return context.id;
  }

  private async attachTo(match: (url: string) => boolean, timeout: number) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const app = Object.keys(this.apps).find((id) => this.apps[id].WIRApplicationBundleIdentifierKey === SAFARI);
      if (app) {
        const listing = await this.listing(app);
        const page = Object.values(listing).find((p: Dict) => match(String(p.WIRURLKey ?? '')));
        if (page) {
          this.app = app;
          this.page = page.WIRPageIdentifierKey;
          await this.setupSocket();
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('No matching Safari tab');
  }

  private listing(app: string): Promise<Dict> {
    this.listings.delete(app);
    this.send('_rpc_forwardGetListing:', { WIRApplicationIdentifierKey: app });
    return this.waitFor(() => this.listings.get(app), 5_000).catch(() => ({}));
  }

  private async setupSocket() {
    this.send('_rpc_forwardSocketSetup:', {
      WIRApplicationIdentifierKey: this.app,
      WIRPageIdentifierKey: this.page,
      WIRSenderKey: this.sender,
      WIRAutomaticallyPause: false,
    });
    // Pages announce their target through the Target domain; commands go to it.
    await this.waitFor(() => this.target, 10_000);
  }

  private async call(method: string, params: Dict = {}, timeout = 60_000): Promise<any> {
    // Between targets during a navigation.
    const target = await this.waitFor(() => this.target, timeout);
    const id = this.nextId++;
    this.forward({
      id: this.nextId++,
      method: 'Target.sendMessageToTarget',
      params: { targetId: target, message: JSON.stringify({ id, method, params }) },
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, timeout);
      this.pending.set(id, {
        target,
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
    });
  }

  private forward(message: Dict) {
    this.send('_rpc_forwardSocketData:', {
      WIRApplicationIdentifierKey: this.app,
      WIRPageIdentifierKey: this.page,
      WIRSenderKey: this.sender,
      WIRSocketDataKey: new Uint8Array(Buffer.from(JSON.stringify(message))),
    });
  }

  private send(selector: string, arg: Record<string, PlistValue>) {
    const body = encode({ __selector: selector, __argument: { WIRConnectionIdentifierKey: this.connection, ...arg } });
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    this.socket.write(Buffer.concat([length, body]));
  }

  private receive(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32BE(0);
      if (this.buffer.length < 4 + length) break;
      const message = decode(this.buffer.subarray(4, 4 + length)) as Dict;
      this.buffer = this.buffer.subarray(4 + length);
      this.handle(message.__selector, message.__argument ?? {});
    }
  }

  private handle(selector: string, arg: Dict) {
    switch (selector) {
      case '_rpc_reportConnectedApplicationList:':
        this.apps = arg.WIRApplicationDictionaryKey;
        break;
      case '_rpc_applicationConnected:':
        this.apps[arg.WIRApplicationIdentifierKey] = arg;
        break;
      case '_rpc_applicationSentListing:':
        this.listings.set(arg.WIRApplicationIdentifierKey, arg.WIRListingKey);
        break;
      case '_rpc_applicationSentData:': {
        const message = JSON.parse(Buffer.from(arg.WIRMessageDataKey).toString());
        // A navigation that swaps processes opens a provisional target and
        // commits it once the new page loads.
        if (message.method === 'Target.targetCreated') {
          const info = message.params.targetInfo;
          if (info.type === 'page' && !info.isProvisional) this.target = info.targetId;
        } else if (message.method === 'Target.didCommitProvisionalTarget') {
          this.dropTarget(message.params.oldTargetId);
          this.target = message.params.newTargetId;
        } else if (message.method === 'Target.targetDestroyed') {
          this.dropTarget(message.params.targetId);
        }
        const inner = this.unwrap(selector, arg);
        if (inner && 'id' in inner) {
          const waiter = this.pending.get(inner.id);
          this.pending.delete(inner.id);
          if (inner.error) waiter?.reject(new Error(inner.error.message));
          else waiter?.resolve(inner.result);
        }
        break;
      }
    }
    for (const listener of this.listeners) listener(selector, arg);
  }

  private unwrap(selector: string, arg: Dict): Dict | null {
    if (selector !== '_rpc_applicationSentData:') return null;
    const message = JSON.parse(Buffer.from(arg.WIRMessageDataKey).toString());
    return message.method === 'Target.dispatchMessageFromTarget' ? JSON.parse(message.params.message) : null;
  }

  private waitFor<T>(check: () => T | null | undefined, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeout;
      const poll = () => {
        const value = check();
        if (value) return resolve(value);
        if (this.closed) return reject(this.closed);
        if (Date.now() > deadline) return reject(new Error('Timed out waiting for the Web Inspector'));
        setTimeout(poll, 50);
      };
      poll();
    });
  }

  private dropTarget(target: string) {
    if (this.target === target) this.target = null;
    for (const [id, waiter] of this.pending) {
      if (waiter.target !== target) continue;
      this.pending.delete(id);
      waiter.reject(new Error('The page navigated away'));
    }
  }

  private fail(error: Error) {
    this.closed ??= error;
    for (const waiter of this.pending.values()) waiter.reject(error);
    this.pending.clear();
  }
}
