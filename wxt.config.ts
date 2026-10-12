import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/auto-icons'],
  // Chrome rejects SVG manifest icons (Firefox accepts them), so we rasterize
  // the single source SVG to PNGs at build time, per browser target. The
  // generated `icons` also drive the toolbar button - with no explicit
  // `action.default_icon`, both browsers fall back to `icons`.
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
    sizes: [128, 96, 48, 32, 16],
  },
  // The Firefox sources ZIP (for AMO review) should contain only what's needed
  // to build. WXT's defaults already drop node_modules/tests/hidden files; we
  // also exclude prebuilt packages and material that the build doesn't use.
  zip: {
    // releases/ holds past dev-build artifacts; the bare '*.zip' glob
    // only matches at the repo root, so exclude the directory itself.
    excludeSources: ['*.zip', '*.xpi', 'docs/**', 'releases/**'],
  },
  // Per-browser manifest: the Gecko-only `browser_specific_settings` block is
  // emitted for Firefox only, keeping the Chrome manifest free of keys Chrome
  // merely ignores.
  manifest: ({ browser }) => ({
    name: 'Tubeless',
    description:
      'YouTube, quieter. Hide Shorts, ads, recommendation shelves, comments and more, each with its own switch. No tracking, no requests.',
    permissions: ['storage'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'tubeless@steve.scot',
          strict_min_version: '142.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
        // Without an explicit gecko_android block (even an empty object), AMO
        // restricts the extension to desktop Firefox and the Android catalog
        // never lists it. The 142 floor matches Firefox-for-Android's first
        // release supporting data_collection_permissions.
        gecko_android: {
          strict_min_version: '142.0',
        },
      },
    }),
  }),
});
