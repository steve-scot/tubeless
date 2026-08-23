# Tubeless

> YouTube, with the noise let out.

A browser extension for Firefox and Chrome that hides Shorts, recommended-game
shelves, event banners, sponsored in-feed slots, end-screen cards, the AI "Ask"
button, and other curation noise on YouTube. Each toggle is independent and
configurable from the popup. Pause the whole thing with one switch when you
want plain YouTube back.

Works on desktop and on Firefox for Android.

## Why

I've been a YouTube Premium subscriber for many years. Despite this, my YouTube
feed was still cluttered with things I didn't want to see. Shorts all over the
place, "Most relevant" sections, "Explore more topics" sections, "How are we
doing" survey blocks, more Shorts, the list goes on.

I tried numerous other plugins, most helped, but none of them got rid of all of
it, so I created Tubeless to solve the problem. I've been using it full time
for many months with extensive YouTube browsing, and I'm constantly tweaking it.

## Install

- **Firefox**: [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tubeless/)
- **Chrome**: [Chrome Web Store](https://chromewebstore.google.com/detail/tubeless/majebohkonlfnedomfjnjaaeioiooolg)

Or build from source below.

## How it works

Tubeless is a thin content script that injects a single `<style>` element into
youtube.com. Every toggle in the popup maps to a CSS rule that hides specific
elements via `display: none`. There is no DOM mutation, no MutationObservers,
no background workers doing real work, and no remote code.

The full set of selectors lives in [`utils/selectors.ts`](./utils/selectors.ts),
annotated with confidence levels (`✓` stable, `?` likely-current, `!` guess).
When YouTube ships a redesign, that's the file to edit.

## Privacy

- No telemetry, no analytics, no network requests.
- The only permission requested is `storage`, used to persist your settings
  (synced through your own browser account, nowhere else).
- The manifest declares `data_collection_permissions: ['none']`.

## Building from source

Requirements: Node 20+ and npm.

```bash
npm install
npm run dev         # WXT dev server, opens Firefox with the extension loaded
npm run dev:chrome  # same, for Chrome
npm run build       # unpacked build under .output/firefox-mv3
npm run zip         # produces .output/tubeless-<version>-firefox.zip
npm run zip:chrome  # produces .output/tubeless-<version>-chrome.zip
npm run compile     # TypeScript type-check (no emit)
```

`package-lock.json` pins every dependency, so builds are reproducible.

## Project layout

```
entrypoints/
  content.ts          Content script - injects the <style> tag
  background.ts       Firefox-for-Android shim - opens the popup in a tab
  popup/              The toolbar popup UI (HTML/CSS/TS)
utils/
  selectors.ts        Single source of truth for what each toggle hides
  buildCss.ts         Composes the injected CSS from current settings
  settings.ts         Settings schema, defaults, and storage migration
assets/
  icon.svg            Source icon - rasterized to PNG icons at build time
wxt.config.ts         WXT/manifest configuration
```

Built with [WXT](https://wxt.dev).

## License

[MIT](./LICENSE).
