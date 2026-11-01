import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

type Command = { id: number; action: string; [key: string]: unknown };
type Pending = { command: Command; resolve: (value: unknown) => void; reject: (error: Error) => void };

// Element query for the UI test driver (ios/Driver/Driver.swift).
export type Query = {
  bundle?: string;
  type?: 'any' | 'button' | 'cell' | 'link' | 'other' | 'staticText' | 'switch' | 'textField' | 'webView';
  label?: string;
  identifier?: string;
  // Case-insensitive substring match on label and identifier.
  contains?: boolean;
  index?: number;
  timeout?: number;
  // Swipe up until the element is on screen.
  scroll?: boolean;
};

export const SAFARI = 'com.apple.mobilesafari';
export const SETTINGS_APP = 'com.apple.Preferences';

// Taps and rotation for a simulator, through a UI test that long-polls this
// process for commands. Everything that needs no touch goes through simctl
// or the Web Inspector instead.
export class UiDriver {
  private nextId = 1;
  private queue: Pending[] = [];
  private inFlight = new Map<number, Pending>();
  private waiting: ServerResponse | null = null;
  private failure: Error | null = null;
  private server: Server;
  private test: ChildProcess;
  private exited: Promise<void>;
  private derivedData: string;

  private constructor(server: Server, test: ChildProcess, derivedData: string) {
    this.server = server;
    this.test = test;
    this.derivedData = derivedData;
    this.exited = new Promise((resolve) => test.once('exit', () => resolve()));
  }

  static async start(opts: { udid: string; xctestrun: string; log: (line: string) => void }): Promise<UiDriver> {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    // Otherwise every run leaves a new folder of test logs in the global DerivedData.
    const derivedData = mkdtempSync(path.join(tmpdir(), 'tubeless-driver-'));
    const test = spawn(
      'xcodebuild',
      ['test-without-building', '-xctestrun', opts.xctestrun, '-destination', `id=${opts.udid}`,
        '-derivedDataPath', derivedData],
      // xcodebuild hands TEST_RUNNER_-prefixed variables to the test, unprefixed.
      { env: { ...process.env, TEST_RUNNER_DRIVER_URL: `http://127.0.0.1:${port}` }, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const driver = new UiDriver(server, test, derivedData);
    server.on('request', (req, res) => driver.handle(req, res));
    let output = '';
    const keep = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-4000);
    };
    test.stdout!.on('data', keep);
    test.stderr!.on('data', keep);
    test.on('exit', (code) => {
      driver.fail(new Error(`The UI test driver exited (${code}):\n${output}`));
    });
    // The first command waits for the runner to install and connect.
    await driver.send('exists', { label: '', timeout: 0 });
    opts.log('UI driver connected');
    return driver;
  }

  send(action: string, args: object = {}): Promise<any> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.queue.push({ command: { id: this.nextId++, action, ...args }, resolve, reject });
      this.dispatch();
    });
  }

  tap(query: Query) {
    return this.send('tap', query);
  }

  exists(query: Query): Promise<boolean> {
    return this.send('exists', query);
  }

  // Normalised to the app's frame.
  tapPoint(x: number, y: number, bundle = SAFARI) {
    return this.send('tapPoint', { bundle, x, y });
  }

  tree(bundle = SAFARI): Promise<string> {
    return this.send('tree', { bundle });
  }

  async close() {
    if (!this.failure) await this.send('quit').catch(() => {});
    this.server.close();
    this.test.kill();
    await this.exited;
    rmSync(this.derivedData, { recursive: true, force: true });
  }

  private dispatch() {
    if (!this.waiting || !this.queue.length) return;
    const next = this.queue.shift()!;
    this.inFlight.set(next.command.id, next);
    this.waiting.end(JSON.stringify(next.command));
    this.waiting = null;
  }

  private handle(req: IncomingMessage, res: ServerResponse) {
    if (req.url === '/next') {
      this.waiting = res;
      this.dispatch();
      return;
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      res.end('{}');
      const reply = JSON.parse(body) as { id: number; result?: unknown; error?: string };
      const pending = this.inFlight.get(reply.id);
      if (!pending) return;
      this.inFlight.delete(reply.id);
      if (pending.command.action === 'quit') pending.resolve(true);
      else if (reply.error) pending.reject(new Error(`${pending.command.action}: ${reply.error}`));
      else pending.resolve(reply.result);
    });
  }

  private fail(error: Error) {
    this.failure ??= error;
    for (const p of [...this.queue, ...this.inFlight.values()]) {
      if (p.command.action === 'quit') p.resolve(true);
      else p.reject(error);
    }
    this.queue = [];
    this.inFlight.clear();
  }
}
