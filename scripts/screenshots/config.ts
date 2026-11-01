export type Device = 'desktop' | Simulator;
export type Simulator = 'iphone' | 'iphone-large' | 'ipad';
export type Frame = 'firefox' | 'chrome' | 'safari' | 'none';
export type Scene =
  | 'home-before'
  | 'home-after'
  | 'watch-before'
  | 'watch-after'
  | 'popup';

// Played before the home capture. A signed-out session that has watched
// nothing gets an empty home feed; these give it something to recommend from.
export const SEED_VIDEOS = ['9nTZTJHBCAs', 'cFWBatrHbPk'];

// The watch-page video, and how far into it (seconds) to pause. The capture
// plays up to this point, so a later moment makes for a slower run.
export const WATCH = { id: '9nTZTJHBCAs', at: 20 };

// Applied over the defaults for the "after" shots and the popup.
export const SETTINGS = {
  watchPage: { hideRecommendations: true, hideDescription: true, hideComments: true },
};

// What goes in storage.sync. Settings are stored partially; the extension
// merges each group with its defaults.
export const storedSettings = (enabled: boolean) => ({ ...SETTINGS, schemaVersion: 2, enabled });

export const YOUTUBE_COOKIES = [
  // "Reject all" on the EU/UK consent interstitial.
  { name: 'SOCS', value: 'CAI' },
  // Signed out, YouTube ignores prefers-color-scheme; f6=400 is its dark theme.
  { name: 'PREF', value: 'f6=400&hl=en-GB&gl=GB' },
];

type Size = { width: number; height: number };

// Desktop images put a browser window on a backdrop.
export const WINDOW = { x: 100, y: 62, width: 1080, height: 676, radius: 12 };

// Captured in Chromium with the Chrome build, then framed as each browser.
export const DESKTOP = {
  // The composed image, in CSS pixels. Outputs scale this up.
  canvas: { width: 1280, height: 800 },
  // Tallest page area any desktop frame shows (Safari's toolbar is the
  // shortest); taller frames crop the bottom of the same capture.
  page: { width: WINDOW.width, height: WINDOW.height - 53 },
  // Highest output scale, so the largest output is composed 1:1.
  scale: 2.25,
  // Chrome and Firefox cap an extension popup at 600px tall.
  popup: { width: 360, height: 600 },
  player: 'ytd-watch-flexy #movie_player',
};

// Captured from Safari in the iOS Simulator with the Safari app installed.
// Each gets its own simulator, created on first use and erased every run.
export type SimulatorConfig = {
  name: string;
  deviceType: string;
  landscape: boolean;
  // The screen in points, as the capture is oriented.
  canvas: Size;
  // Pixels per point.
  scale: number;
  // iPad Safari gets YouTube's desktop site, iPhone Safari the mobile one.
  player: string;
};

// App Store Connect requires the medium iPhone size and scales the large
// one down from it otherwise, so both are worth supplying.
export const SIMULATORS: Record<Simulator, SimulatorConfig> = {
  iphone: {
    name: 'Tubeless iPhone',
    deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro',
    landscape: false,
    canvas: { width: 402, height: 874 },
    scale: 3,
    player: '#player #movie_player',
  },
  'iphone-large': {
    name: 'Tubeless iPhone Large',
    deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max',
    landscape: false,
    canvas: { width: 440, height: 956 },
    scale: 3,
    player: '#player #movie_player',
  },
  ipad: {
    name: 'Tubeless iPad',
    deviceType: 'com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M5-12GB',
    landscape: true,
    canvas: { width: 1376, height: 1032 },
    scale: 2,
    player: 'ytd-watch-flexy #movie_player',
  },
};

export const canvasOf = (device: Device): Size =>
  device === 'desktop' ? DESKTOP.canvas : SIMULATORS[device].canvas;

export type Output = {
  name: string;
  device: Device;
  frame: Frame;
  width: number;
  format: 'png' | 'webp';
  // Desktop frames only: false crops to the browser window, leaving its
  // rounded corners transparent and adding no shadow.
  backdrop?: boolean;
  // Relative to the repo root.
  dir: string;
  files: Partial<Record<Scene, string>>;
};

const STORE_FILES: Output['files'] = {
  'home-before': '1-home-before',
  'home-after': '2-home-after',
  'watch-before': '3-watch-before',
  'watch-after': '4-watch-after',
  popup: '5-popup',
};

const README_FILES: Output['files'] = {
  'home-before': 'home-before',
  'home-after': 'home-after',
  'watch-before': 'watch-before',
  'watch-after': 'watch-after',
  popup: 'popup',
};

// For the website, which supplies its own background and shadow. One set
// per frame, at the capture's full resolution (WINDOW.width × DESKTOP.scale).
const WEBSITE: Output[] = (['firefox', 'chrome', 'safari'] as const).map((frame) => ({
  name: `Website, ${frame}`,
  device: 'desktop',
  frame,
  width: 2430,
  format: 'webp',
  backdrop: false,
  dir: `.output/screenshots/website/${frame}`,
  files: README_FILES,
}));

export const OUTPUTS: Output[] = [
  {
    name: 'Firefox Add-ons',
    device: 'desktop',
    frame: 'firefox',
    width: 1280,
    format: 'png',
    dir: '.output/screenshots/firefox',
    files: STORE_FILES,
  },
  {
    name: 'Chrome Web Store',
    device: 'desktop',
    frame: 'chrome',
    width: 1280,
    format: 'png',
    dir: '.output/screenshots/chrome',
    files: STORE_FILES,
  },
  {
    name: 'Mac App Store',
    device: 'desktop',
    frame: 'safari',
    width: 2880,
    format: 'png',
    dir: '.output/screenshots/safari',
    files: STORE_FILES,
  },
  {
    name: 'App Store, iPhone',
    device: 'iphone',
    frame: 'none',
    width: 1206,
    format: 'png',
    dir: '.output/screenshots/iphone',
    files: STORE_FILES,
  },
  {
    name: 'App Store, iPhone (large)',
    device: 'iphone-large',
    frame: 'none',
    width: 1320,
    format: 'png',
    dir: '.output/screenshots/iphone-large',
    files: STORE_FILES,
  },
  {
    name: 'App Store, iPad',
    device: 'ipad',
    frame: 'none',
    width: 2752,
    format: 'png',
    dir: '.output/screenshots/ipad',
    files: STORE_FILES,
  },
  {
    name: 'README',
    device: 'desktop',
    frame: 'firefox',
    width: 1600,
    format: 'webp',
    dir: 'docs/screenshots',
    files: README_FILES,
  },
  ...WEBSITE,
];
