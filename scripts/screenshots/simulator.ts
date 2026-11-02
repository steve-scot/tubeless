import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  HOME_ATTEMPTS,
  SEED_VIDEOS,
  SIMULATORS,
  WATCH,
  YOUTUBE_COOKIES,
  storedSettings,
  type Simulator,
  type SimulatorConfig,
} from './config.ts';
import { SETTINGS_APP, UiDriver } from './driver.ts';
import { Inspector } from './inspector.ts';
import { feedHasClutter, hideVideos, loadMoreShelves, visibleVideos } from './videos.ts';

const run = promisify(execFile);
const simctl = async (...args: string[]) => (await run('xcrun', ['simctl', ...args])).stdout;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const YOUTUBE = 'https://www.youtube.com';
const EXTENSION_ID = 'app.tubeless.Tubeless.Extension';

// The simulator's Safari claims AV1 support but can't decode it, so
// YouTube's AV1 streams buffer and never start. Without AV1 it picks VP9.
const NO_AV1 = `(() => {
  const av1 = (type) => /av01/i.test(type || '');
  for (const source of [window.MediaSource, window.ManagedMediaSource]) {
    if (!source) continue;
    const isTypeSupported = source.isTypeSupported.bind(source);
    source.isTypeSupported = (type) => !av1(type) && isTypeSupported(type);
  }
  const capabilities = navigator.mediaCapabilities;
  if (capabilities) {
    const decodingInfo = capabilities.decodingInfo.bind(capabilities);
    capabilities.decodingInfo = (config) => av1(config?.video?.contentType)
      ? Promise.resolve({ supported: false, smooth: false, powerEfficient: false })
      : decodingInfo(config);
  }
})()`;

// Each device gets its own simulator, run side by side.
export async function captureSimulators(opts: {
  app: string;
  xctestrun: string;
  out: string;
  devices: Simulator[];
}): Promise<void> {
  const results = await Promise.allSettled(
    opts.devices.map((device) =>
      captureSimulator(device, SIMULATORS[device], opts.app, opts.xctestrun, path.join(opts.out, device)),
    ),
  );
  const failures = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
  if (failures.length) throw new AggregateError(failures, failures.map(String).join('\n'));
}

async function captureSimulator(name: Simulator, sim: SimulatorConfig, app: string, xctestrun: string, out: string) {
  const log = (message: string) => console.log(`  ${name}: ${message}`);
  mkdirSync(out, { recursive: true });
  const udid = await prepareSimulator(sim, app, log);
  const ui = await UiDriver.start({ udid, xctestrun, log });
  const safari = new SafariTab(udid, ui, sim.player);
  try {
    log('enabling the extension');
    await enableExtension(udid, ui);
    // Leaving Settings straight for Safari puts a "Settings" back link in the status bar.
    await ui.send('home');
    if (sim.landscape) await ui.send('orientation', { value: 'landscapeLeft' });

    await safari.open(`${YOUTUBE}/`);
    await safari.setCookies();

    for (const id of SEED_VIDEOS) {
      log(`seeding ${id}`);
      await safari.go(`${YOUTUBE}/watch?v=${id}`);
      await safari.play();
      await sleep(20_000);
    }

    log('home');
    // Ads come and go between loads; the "before" shot should show one.
    await safari.setEnabled(false);
    for (let attempt = 1; ; attempt++) {
      await safari.go(`${YOUTUBE}/`);
      await safari.waitForFeed();
      await sleep(3000);
      if (await safari.filterFeed()) break;
      if (attempt === HOME_ATTEMPTS) {
        console.warn(`    ${name}: no load showed a good "before" feed`);
        break;
      }
      log('no clutter worth showing; reloading');
    }
    await safari.beforeAfter(path.join(out, 'home'), false);

    log('watch');
    await safari.go(`${YOUTUBE}/watch?v=${WATCH.id}`);
    await safari.play();
    await safari.pauseAt(WATCH.at);
    await safari.beforeAfter(path.join(out, 'watch'), true);

    log('popup');
    // iPad Safari shows extension buttons in the address bar; iPhone Safari
    // lists them in the page menu.
    const extensionButton = { type: 'button', label: 'Tubeless' } as const;
    if (!(await ui.exists({ ...extensionButton, timeout: 2 }))) await ui.tap({ identifier: 'MoreMenuButton' });
    await ui.tap(extensionButton);
    await sleep(2000);
    await screenshot(udid, path.join(out, 'popup.png'));
  } catch (error) {
    const shot = path.join(out, 'error.png');
    await screenshot(udid, shot).catch(() => {});
    throw new Error(`${name}: ${error instanceof Error ? error.message : error} (see ${shot})`, { cause: error });
  } finally {
    safari.close();
    await ui.close();
    await simctl('shutdown', udid).catch(() => {});
  }
}

// Finds or creates the dedicated simulator, erases it, boots it and
// installs the app, so every run starts signed out with no history.
async function prepareSimulator(sim: SimulatorConfig, app: string, log: (m: string) => void): Promise<string> {
  type Listed = { name: string; udid: string; deviceTypeIdentifier: string; isAvailable: boolean };
  const { devices } = JSON.parse(await simctl('list', 'devices', '-j')) as { devices: Record<string, Listed[]> };
  let udid = Object.values(devices)
    .flat()
    .find((d) => d.name === sim.name && d.deviceTypeIdentifier === sim.deviceType && d.isAvailable)?.udid;
  if (!udid) {
    type Runtime = { identifier: string; platform: string; version: string; isAvailable: boolean };
    const { runtimes } = JSON.parse(await simctl('list', 'runtimes', '-j')) as { runtimes: Runtime[] };
    const runtime = runtimes
      .filter((r) => r.platform === 'iOS' && r.isAvailable)
      .sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
      .at(-1);
    if (!runtime) throw new Error('No iOS simulator runtime is installed (Xcode > Settings > Components).');
    log(`creating the "${sim.name}" simulator`);
    udid = (await simctl('create', sim.name, sim.deviceType, runtime.identifier)).trim();
  }
  await simctl('shutdown', udid).catch(() => {});
  await simctl('erase', udid);
  await simctl('boot', udid);
  await simctl('bootstatus', udid, '-b');
  await simctl('ui', udid, 'appearance', 'dark');
  await simctl(
    'status_bar', udid, 'override',
    // Local 9:41; simctl wants an ISO string with milliseconds.
    '--time', new Date(2026, 0, 13, 9, 41).toISOString(),
    '--batteryState', 'discharging', '--batteryLevel', '100',
    '--cellularBars', '4', '--wifiBars', '3',
  );
  await simctl('install', udid, app);
  return udid;
}

// Settings > Apps > Safari > Extensions > Tubeless: turn it on and allow it on youtube.com.
async function enableExtension(udid: string, ui: UiDriver) {
  const bundle = SETTINGS_APP;
  // A freshly erased simulator lists no apps until it has indexed them,
  // and an open list doesn't refresh, so reopen Settings until it does.
  const deadline = Date.now() + 300_000;
  for (;;) {
    await simctl('terminate', udid, bundle).catch(() => {});
    await ui.send('activate', { bundle });
    try {
      // The scroll to Apps sometimes lands on the search field instead.
      await ui.tap({ bundle, identifier: 'com.apple.settings.apps', scroll: true });
      await ui.tap({ bundle, label: 'Safari', scroll: true, timeout: 15 });
      break;
    } catch (error) {
      if (Date.now() > deadline) throw error;
    }
  }
  await ui.tap({ bundle, label: 'Extensions', scroll: true });
  await ui.tap({ bundle, type: 'button', identifier: EXTENSION_ID });
  // The labelled switch spans the row, and a tap at its centre misses the
  // control; the unlabelled one after it is the control itself.
  await ui.tap({ bundle, type: 'switch', index: 1 });
  if ((await ui.send('value', { bundle, type: 'switch', identifier: 'Allow Extension' })) !== '1') {
    throw new Error('The extension did not turn on in Settings');
  }
  await ui.tap({ bundle, type: 'button', identifier: 'youtube.com', scroll: true });
  await ui.tap({ bundle, type: 'cell', label: 'Allow' });
}

function screenshot(udid: string, file: string) {
  return simctl('io', udid, 'screenshot', '--type', 'png', file);
}

// One Safari tab, driven through the Web Inspector, with taps where Safari
// insists on a user gesture.
class SafariTab {
  private inspector: Inspector | null = null;
  private udid: string;
  private ui: UiDriver;
  private player: string;

  constructor(udid: string, ui: UiDriver, player: string) {
    this.udid = udid;
    this.ui = ui;
    this.player = player;
  }

  private get page(): Inspector {
    if (!this.inspector) throw new Error('No Safari tab is attached');
    return this.inspector;
  }

  async open(url: string) {
    // On a fresh simulator the first URL can land while Safari is still
    // launching and get dropped, leaving its start page.
    for (let attempt = 1; ; attempt++) {
      await simctl('openurl', this.udid, url);
      try {
        this.inspector = await Inspector.attach(this.udid, (u) => new URL(u).hostname.endsWith('youtube.com'), 20_000);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
    await this.until('document.readyState === "complete"', 30_000);
    // Takes effect from the next load.
    await this.page.setBootstrapScript(NO_AV1);
  }

  async go(url: string) {
    // The flag tells the old page from the new one, even when the URL is the same.
    // The reply can lose a race with the navigation it starts.
    await this.page.evaluate(`(() => {
      window.tubelessLeaving = true;
      setTimeout(() => { location.href = ${JSON.stringify(url)} }, 50);
    })()`).catch(() => {});
    await sleep(500);
    await this.until('!window.tubelessLeaving && document.readyState === "complete"', 45_000);
  }

  close() {
    this.inspector?.close();
    this.inspector = null;
  }

  async setCookies() {
    const cookies = YOUTUBE_COOKIES.map((c) => `${c.name}=${c.value}; domain=.youtube.com; path=/; secure; max-age=31536000`);
    await this.page.evaluate(`${JSON.stringify(cookies)}.forEach((c) => { document.cookie = c })`);
    await this.go(`${YOUTUBE}/`);
  }

  async waitForFeed() {
    await this.until('document.querySelectorAll("ytd-rich-item-renderer, ytm-rich-item-renderer").length > 1', 20_000)
      .catch(() => {
        throw new Error('The home feed did not load. Try again, or add more SEED_VIDEOS.');
      });
  }

  // Safari only plays sound after a tap. Mobile YouTube starts muted, with
  // captions and an unmute button over the video; desktop YouTube waits,
  // and ignores the first tap after a load.
  async play() {
    await this.until(`!!document.querySelector('${this.player} video')`, 20_000);
    const deadline = Date.now() + 45_000;
    for (;;) {
      const [paused, muted, time] = await this.page.evaluate<[boolean, boolean, number]>(
        `(v => [v.paused, v.muted, v.currentTime])(document.querySelector('${this.player} video'))`,
      );
      if (!paused && !muted && time > 0) return;
      if (Date.now() > deadline) {
        throw new Error(`The video would not play (paused: ${paused}, muted: ${muted}, at ${time}s).`);
      }
      if (paused) await this.ui.tap({ type: 'button', label: 'Play', timeout: 3 }).catch(() => {});
      else if (muted) await this.ui.tap({ type: 'button', label: 'unmute', contains: true, timeout: 3 }).catch(() => {});
      await sleep(1500);
    }
  }

  // Waits out any pre-roll ad, then pauses the video at `at` seconds.
  async pauseAt(at: number) {
    const deadline = Date.now() + 180_000;
    for (;;) {
      const [time, ad] = await this.page.evaluate<[number, boolean]>(`(() => {
        const p = document.querySelector('${this.player}');
        p.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern')?.click();
        return [p.querySelector('video').currentTime, p.classList.contains('ad-showing')];
      })()`);
      if (!ad && time >= at) break;
      if (Date.now() > deadline) throw new Error(`The video did not reach ${at}s (stuck at ${time}s${ad ? ', in an ad' : ''}).`);
      await sleep(200);
    }
    // Muted autoplay turns on automatic captions, which then stay on.
    await this.page.evaluate(`(p => { p.pauseVideo(); p.unloadModule('captions'); })(document.querySelector('${this.player}'))`);
  }

  async setEnabled(enabled: boolean) {
    const context = await this.page.extensionContext();
    await this.page.evaluate(`browser.storage.sync.set({ settings: ${JSON.stringify(storedSettings(enabled))} })`, { context });
  }

  // Loads more shelves, removes unwanted videos, and says whether what's
  // left on screen makes a good "before" shot.
  async filterFeed(): Promise<boolean> {
    await this.page.evaluate(loadMoreShelves, { timeout: 15_000 });
    await this.page.evaluate(hideVideos);
    return this.page.evaluate<boolean>(feedHasClutter);
  }

  async beforeAfter(prefix: string, watch: boolean) {
    for (const [enabled, suffix] of [[false, 'before'], [true, 'after']] as const) {
      await this.setEnabled(enabled);
      // Feed previews play inline; stop them so both shots show the same thing.
      await this.page.evaluate(`(() => {
        scrollTo(0, 0);
        for (const v of document.querySelectorAll('video')) if (!v.closest('${this.player}')) v.pause();
      })()`);
      await sleep(2000);
      // The desktop player shows its controls for a few seconds after a
      // layout change.
      if (watch) {
        const hidden = `(p => !p.querySelector('.ytp-chrome-bottom') || p.classList.contains('ytp-autohide'))`;
        await this.until(`${hidden}(document.querySelector('${this.player}'))`, 15_000)
          .catch(() => console.warn('    the player controls stayed visible'));
      }
      await this.page.evaluate(hideVideos);
      await sleep(1000);
      writeFileSync(`${prefix}-${suffix}-videos.txt`, (await this.page.evaluate<string[]>(visibleVideos)).join('\n') + '\n');
      await screenshot(this.udid, `${prefix}-${suffix}.png`);
    }
  }

  private async until(expression: string, timeout: number) {
    const deadline = Date.now() + timeout;
    while (!(await this.page.evaluate<boolean>(expression, { timeout: 5_000 }).catch(() => false))) {
      if (Date.now() > deadline) throw new Error(`Timed out waiting for ${expression}`);
      await sleep(250);
    }
  }
}
