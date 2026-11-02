import { chromium, type BrowserContext, type Page, type Worker } from 'playwright';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DESKTOP, HOME_ATTEMPTS, SEED_VIDEOS, WATCH, YOUTUBE_COOKIES, storedSettings } from './config.ts';
import { feedHasClutter, hideVideos, loadMoreShelves, visibleVideos } from './videos.ts';

export type CaptureMeta = {
  home: { title: string; url: string };
  watch: { title: string; url: string };
};

const YOUTUBE = 'https://www.youtube.com';

// The extension's service worker, where setEnabled runs, has Chrome's global.
declare const chrome: typeof import('wxt/browser').browser;

// Captures the desktop site in Chromium with the Chrome build loaded.
export async function capture(opts: { extension: string; out: string }): Promise<void> {
  const { extension, out } = opts;
  const log = (message: string) => console.log(`  desktop: ${message}`);
  mkdirSync(out, { recursive: true });
  // Extensions need a persistent context; a throwaway profile keeps every run signed out and clean.
  const profile = mkdtempSync(path.join(tmpdir(), 'tubeless-screenshots-'));

  const ctx = await chromium.launchPersistentContext(profile, {
    // Branded Chrome no longer honours --load-extension.
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
      '--hide-scrollbars',
    ],
    viewport: DESKTOP.page,
    deviceScaleFactor: DESKTOP.scale,
    colorScheme: 'dark',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  });

  try {
    await ctx.addCookies(
      YOUTUBE_COOKIES.map((c) => ({ ...c, domain: '.youtube.com', path: '/', secure: true, sameSite: 'Lax' as const })),
    );

    const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const page = ctx.pages()[0] ?? (await ctx.newPage());

    for (const id of SEED_VIDEOS) {
      log(`seeding ${id}`);
      await page.goto(`${YOUTUBE}/watch?v=${id}`);
      await page.waitForTimeout(25_000);
    }

    log('home');
    // Ads come and go between loads; the "before" shot should show one.
    await setEnabled(worker, false);
    for (let attempt = 1; ; attempt++) {
      await page.goto(YOUTUBE);
      try {
        await page
          .locator('ytd-rich-item-renderer')
          .nth(1)
          .waitFor({ state: 'attached', timeout: 20_000 });
      } catch {
        const shot = path.join(out, 'home-error.png');
        await page.screenshot({ path: shot });
        throw new Error(`desktop: the home feed did not load (see ${shot}). Try again, or add more SEED_VIDEOS.`);
      }
      await page.waitForTimeout(3000);
      await page.evaluate(loadMoreShelves);
      await page.evaluate(hideVideos);
      if (await page.evaluate<boolean>(feedHasClutter)) break;
      if (attempt === HOME_ATTEMPTS) {
        console.warn('    no load showed both an ad and a full row of Shorts');
        break;
      }
      log('no ad or full row of Shorts; reloading');
    }
    const home = { title: await page.title(), url: page.url() };
    await shootBeforeAfter(page, worker, out, 'home');

    log('watch');
    // Tubeless hides the pre-roll's skip button, and YouTube ignores a
    // scripted click on it.
    await setEnabled(worker, false);
    await page.goto(`${YOUTUBE}/watch?v=${WATCH.id}`);
    await settleVideo(page, DESKTOP.player);
    const watch = { title: await page.title(), url: page.url() };
    await shootBeforeAfter(page, worker, out, 'watch');

    log('popup');
    await capturePopup(ctx, worker, out);

    const meta: CaptureMeta = { home, watch };
    writeFileSync(path.join(out, 'meta.json'), JSON.stringify(meta, null, 2));
  } finally {
    await ctx.close();
    rmSync(profile, { recursive: true, force: true });
  }
}

function setEnabled(worker: Worker, enabled: boolean): Promise<void> {
  return worker.evaluate((settings) => chrome.storage.sync.set({ settings }), storedSettings(enabled));
}

async function shootBeforeAfter(page: Page, worker: Worker, out: string, name: 'home' | 'watch') {
  // Keep the pointer off the page so nothing shows a hover state.
  await page.mouse.move(2, DESKTOP.page.height - 2);
  for (const [enabled, suffix] of [[false, 'before'], [true, 'after']] as const) {
    await setEnabled(worker, enabled);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    await waitForVisibleImages(page);
    if (name === 'watch') await waitForPlayerChromeHidden(page, DESKTOP.player);
    await page.evaluate(hideVideos);
    await waitForVisibleImages(page);
    writeFileSync(path.join(out, `${name}-${suffix}-videos.txt`), (await page.evaluate<string[]>(visibleVideos)).join('\n') + '\n');
    await page.screenshot({ path: path.join(out, `${name}-${suffix}.png`) });
  }
}

async function waitForVisibleImages(page: Page) {
  await page
    .waitForFunction(
      () =>
        [...document.images].every((img) => {
          const r = img.getBoundingClientRect();
          const visible = r.width > 0 && r.bottom > 0 && r.top < innerHeight;
          return !visible || (img.complete && img.naturalWidth > 0);
        }),
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => console.warn('    some images had not loaded'));
}

// Waits out any pre-roll ad, plays to WATCH.at and pauses there, so the
// before and after shots show the same frame. Seeking instead leaves the
// headless player buffering indefinitely.
async function settleVideo(page: Page, selector: string) {
  const player = page.locator(selector);
  await player.locator('video').waitFor({ state: 'attached', timeout: 20_000 });
  const deadline = Date.now() + 120_000;
  while ((await player.getAttribute('class'))?.includes('ad-showing')) {
    if (Date.now() > deadline) throw new Error('A pre-roll ad did not finish within two minutes.');
    await page.locator('.ytp-skip-ad-button, .ytp-ad-skip-button-modern').click({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  // The player element exposes YouTube's IFrame API methods.
  type Api = { playVideo(): void; pauseVideo(): void };
  await page.evaluate((selector) => (document.querySelector(selector) as unknown as Api).playVideo(), selector);
  await page.waitForFunction(
    ([selector, at]) => (document.querySelector<HTMLVideoElement>(`${selector} video`)?.currentTime ?? 0) >= at,
    [selector, WATCH.at] as const,
    { timeout: (WATCH.at + 30) * 1000, polling: 100 },
  );
  await page.evaluate((selector) => (document.querySelector(selector) as unknown as Api).pauseVideo(), selector);
}

// The control bar fades out a few seconds after the pointer leaves the player.
async function waitForPlayerChromeHidden(page: Page, selector: string) {
  await page
    .waitForFunction(
      (selector) => {
        const player = document.querySelector(selector);
        return player?.classList.contains('ytp-autohide') && !player.classList.contains('buffering-mode');
      },
      selector,
      { timeout: 15_000 },
    )
    .catch(() => console.warn('    the player controls stayed visible'));
}

async function capturePopup(ctx: BrowserContext, worker: Worker, out: string) {
  await setEnabled(worker, true);
  const id = new URL(worker.url()).host;
  const page = await ctx.newPage();
  await page.setViewportSize(DESKTOP.popup);
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, 'popup.png') });
  await page.close();
}
