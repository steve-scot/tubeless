import type { Settings, ThumbnailSize } from './settings';
import { SELECTORS } from './selectors';

function rule(selectors: readonly string[]): string {
  if (selectors.length === 0) return '';
  return `${selectors.join(',\n')} { display: none !important; }\n`;
}

// Channel pages are never filtered: once the user is on a channel they want
// to see what it has, and hiding its shelves/tabs/cards breaks the layout.
// The exclusion lives inside each hide selector rather than as a
// higher-specificity revert rule - a revert would out-rank every other
// toggle and re-show elements those toggles hid on channel pages.
// Desktop-only guard: mobile (ytm-*) has no ytd-browse, so the :not() is
// vacuously true there and mobile channel pages remain filtered.
function feedRule(selectors: readonly string[]): string {
  return rule(
    selectors.map((s) => `${s}:not(ytd-browse[page-subtype*="channel"] *)`),
  );
}

// Widest a thumbnail may be at each step below YouTube's size, in px.
const THUMBNAIL_MAX_WIDTHS: Partial<Record<ThumbnailSize, number>> = {
  [-1]: 440,
  [-2]: 380,
  [-3]: 330,
  [-4]: 290,
  [-5]: 250,
  [-6]: 220,
};

// Beyond this grid width the column count stops rising.
const MAX_GRID_WIDTH = 7680;
// --ytd-rich-grid-item-margin and --ytd-rich-grid-gutter-margin.
const ITEM_MARGIN = 16;
const GUTTER = 16;

const GRID = 'ytd-browse ytd-rich-grid-renderer';
const ITEMS = `${GRID} > #contents > ytd-rich-item-renderer`;

// YouTube's script writes a column count to --ytd-rich-grid-items-per-row
// on the grid, and each item's width is 100% / that variable. It stops
// adding columns on wide windows, and caps the grid at that many 700px
// thumbnails, centred. Instead, a container query on the grid's width picks
// the fewest whole columns that keep each thumbnail within the step's
// width, and the width caps are lifted so the grid fills the page.
// The override sits on the items, not the grid, so --tubeless-columns can
// read YouTube's count without a cycle; max() keeps the grid from ever
// showing fewer columns than YouTube would. YouTube's script also drops
// the outer margin of the items it counts as first or last in a row, by its
// own column count, so every item is given both margins to keep rows full.
// Shelves sit in ytd-rich-section-renderer and keep YouTube's sizing.
function gridRule(size: ThumbnailSize): string {
  // Unknown values (e.g. synced from a newer version) fall back to YouTube's.
  const maxWidth = THUMBNAIL_MAX_WIDTHS[size];
  if (!maxWidth) return '';
  const column = maxWidth + ITEM_MARGIN;
  let css =
    `${GRID} { container-type: inline-size; --tubeless-columns: var(--ytd-rich-grid-items-per-row); }\n` +
    `${GRID} > #contents, ${GRID} .chip-bar.ytd-rich-grid-renderer, ${GRID} #title.ytd-rich-grid-renderer { max-width: none !important; }\n` +
    `${ITEMS} { margin-left: calc(var(--ytd-rich-grid-item-margin) / 2) !important; margin-right: calc(var(--ytd-rich-grid-item-margin) / 2) !important; }\n`;
  for (let columns = 2; (columns - 1) * column + 2 * GUTTER < MAX_GRID_WIDTH; columns++) {
    css +=
      `@container (width > ${(columns - 1) * column + 2 * GUTTER}px) { ${ITEMS} ` +
      `{ --ytd-rich-grid-items-per-row: max(var(--tubeless-columns), ${columns}) !important; } }\n`;
  }
  return css;
}

export function buildCss(settings: Settings): string {
  // Master switch: when off, inject no CSS. The content script keeps the
  // <style> element in the DOM so flipping the switch on later just
  // re-fills it without needing a page reload.
  if (!settings.enabled) return '';

  const parts: string[] = [];

  // Always on: a YouTube player bug rather than clutter. The top-right
  // button container is larger than its buttons, and its empty area
  // swallows clicks that should reach the video and toggle playback.
  parts.push(
    '.ytp-chrome-top-buttons { pointer-events: none !important; }\n' +
      '.ytp-chrome-top-buttons > * { pointer-events: auto !important; }\n',
  );

  if (settings.sidenav.hideShorts) parts.push(rule(SELECTORS.sidenav.hideShorts));
  if (settings.sidenav.hideExplore) parts.push(rule(SELECTORS.sidenav.hideExplore));
  if (settings.sidenav.hideMoreFromYouTube)
    parts.push(rule(SELECTORS.sidenav.hideMoreFromYouTube));

  if (settings.sidenav.youSection === 'minimal') {
    parts.push(rule(SELECTORS.sidenav.youSectionMinimal));
  } else if (settings.sidenav.youSection === 'hidden') {
    parts.push(rule(SELECTORS.sidenav.youSectionHidden));
  }

  // Top bar
  if (settings.topBar.hideCreate)
    parts.push(rule(SELECTORS.masthead.hideCreate));
  if (settings.topBar.hideNotifications)
    parts.push(rule(SELECTORS.masthead.hideNotifications));
  if (settings.topBar.hideFilterChips) {
    parts.push(feedRule(SELECTORS.feeds.hideFilterChips));
    // Without this override, the chipbar wrapper disappears but a sibling
    // backdrop (#frosted-glass.with-chipbar) keeps reserving extra height
    // for it. 56px matches YouTube's masthead-only height (the value of
    // --ytd-rich-grid-chips-bar-top).
    parts.push('#frosted-glass.with-chipbar { height: 56px !important; }\n');
    // Mobile equivalent: the chip bar is fixed over the feed, and its
    // wrapper keeps a 50px bottom margin (a 50px height on hashtag pages)
    // to clear it, which stays behind as a blank band.
    parts.push(
      '.rich-grid-sticky-header:has(> ytm-feed-filter-chip-bar-renderer) { margin-bottom: 0 !important; height: auto !important; }\n',
    );
  }

  // Home shelves
  if (settings.homeShelves.hideAll)
    parts.push(feedRule(SELECTORS.feeds.hideShelves));
  if (settings.homeShelves.hideGaming)
    parts.push(feedRule(SELECTORS.feeds.hideGames));
  if (settings.homeShelves.hideEventBanners)
    parts.push(feedRule(SELECTORS.feeds.hideEventBanners));
  if (settings.homeShelves.hideAlertBanners)
    parts.push(feedRule(SELECTORS.feeds.hideAlertBanners));
  if (settings.homeShelves.hideFeedNudges)
    parts.push(feedRule(SELECTORS.feeds.hideFeedNudges));

  // Content types
  if (settings.contentTypes.hideShorts)
    parts.push(feedRule(SELECTORS.feeds.hideShorts));
  if (settings.contentTypes.hideMovies)
    parts.push(feedRule(SELECTORS.feeds.hideMovies));
  if (settings.contentTypes.hideMembersOnly)
    parts.push(feedRule(SELECTORS.feeds.hideMembersOnly));
  if (settings.contentTypes.hidePremieres)
    parts.push(feedRule(SELECTORS.feeds.hidePremieres));
  if (settings.contentTypes.hidePosts)
    parts.push(feedRule(SELECTORS.feeds.hidePosts));
  if (settings.contentTypes.hideMixes)
    parts.push(feedRule(SELECTORS.feeds.hideMixes));
  if (settings.contentTypes.hideCollections)
    parts.push(feedRule(SELECTORS.feeds.hideCollections));
  if (settings.contentTypes.hideLive)
    parts.push(feedRule(SELECTORS.feeds.hideLive));
  if (settings.contentTypes.hideMusic)
    parts.push(feedRule(SELECTORS.feeds.hideMusic));

  // Layout. Unlike the feed filters, this also applies on channel pages.
  parts.push(gridRule(settings.layout.thumbnailSize));

  // Watch page
  if (settings.watchPage.actionRow === 'minimal')
    parts.push(rule(SELECTORS.watchPage.actionRowMinimal));
  if (settings.watchPage.hideMerch)
    parts.push(rule(SELECTORS.watchPage.hideMerch));
  if (settings.watchPage.hideLiveChat) {
    parts.push(rule(SELECTORS.watchPage.hideLiveChat));
    // In theater mode an expanded chat doesn't live in #secondary - it
    // docks beside the full-bleed player, and flexy narrows the player
    // by --ytd-watch-flexy-sidebar-width. display:none on the frame
    // hides the chat but the width reservation is attribute-driven
    // (live-chat-present-and-expanded), leaving a dead black column
    // beside the player. Zero the var in exactly that state so the
    // player takes the full width. Scoped to [theater] because the
    // same var sizes the (still wanted) #secondary column in the
    // default layout.
    parts.push(
      'ytd-watch-flexy[theater][live-chat-present-and-expanded] { --ytd-watch-flexy-sidebar-width: 0px !important; }\n',
    );
  }
  if (settings.watchPage.hideFundraiser)
    parts.push(rule(SELECTORS.watchPage.hideFundraiser));
  if (settings.watchPage.hideEndScreenCards)
    parts.push(rule(SELECTORS.watchPage.hideEndScreenCards));
  if (settings.watchPage.hideDescription)
    parts.push(rule(SELECTORS.watchPage.hideDescription));
  if (settings.watchPage.hideComments) {
    parts.push(rule(SELECTORS.watchPage.hideComments));
    // The side-rail layout opens the comments panel by default and
    // reserves its column with a #columns::after spacer while
    // [fixed-panel-expanded] is set. With the panel hidden, apply
    // YouTube's own closed-panel layout (its :not([fixed-panel-expanded])
    // rules) so the player takes the width instead of an empty column.
    const panel = 'ytd-watch-flexy[split-scroll][is-comments-panel-visible]';
    parts.push(
      `${panel} #secondary { display: none !important; }\n` +
        // No width transition: the player re-measures on the resize nudge,
        // which would otherwise land mid-transition.
        `${panel} #columns::after { width: 0px !important; min-width: 0px !important; padding: 0px !important; transition: none !important; }\n` +
        // The spacer still has to clear the fixed rail of panel buttons.
        `${panel}[show-fixed-side-menu]:not([side-rail-collapsed]):not([full-bleed-player]) #columns::after { width: var(--ytd-watch-flexy-fixed-side-menu-width) !important; }\n` +
        `${panel} #primary { max-width: 100% !important; }\n` +
        `${panel} #player, ${panel} #below > :not(:last-child) { margin-left: auto !important; margin-right: auto !important; ` +
        'max-width: calc(var(--ytd-watch-flexy-max-player-height) * 1.7777777778) !important; }\n',
    );
  }
  if (settings.watchPage.hideInfoPanels)
    parts.push(rule(SELECTORS.watchPage.hideInfoPanels));
  if (settings.watchPage.hideRecommendations) {
    parts.push(rule(SELECTORS.watchPage.hideRecommendations));
    // When live chat is also being hidden, force-collapse the #secondary
    // column outright. hideRecommendations's expanded-chat guard
    // (:not(:has(ytd-live-chat-frame:not([collapsed])))) preserves the
    // column whenever an expanded chat frame exists in the DOM - but
    // display:none doesn't remove the frame, so the guard would otherwise
    // keep an empty column reserved on live-stream pages.
    if (settings.watchPage.hideLiveChat) {
      parts.push('ytd-watch-flexy:not([split-scroll]) #secondary { display: none !important; }\n');
    }
    // Hiding the recommendations column removes the sidebar's space
    // reservation but YouTube's flexy layout still sizes the primary
    // column / player as if the sidebar were there, which pushes some
    // descendant past the viewport edge at wide widths and produces a
    // page-level horizontal scrollbar. We can't easily pin down the
    // exact offender (devtools narrows the viewport, masking the bug),
    // so we clip overflow at YouTube's app root. `overflow-x: clip`
    // (not `hidden`) doesn't create a scroll/containing-block context,
    // so the masthead and miniplayer still anchor to the viewport.
    parts.push('ytd-app { overflow-x: clip !important; }\n');
  }

  // AI (stored under watchPage for compatibility, see settings.ts)
  if (settings.watchPage.hideAISummary) parts.push(rule(SELECTORS.ai.hideFeatures));

  // Ads
  if (settings.ads.hideAll) parts.push(rule(SELECTORS.ads.hideAll));

  // Popups
  if (settings.popups.hideSurveys) parts.push(rule(SELECTORS.popups.hideSurveys));

  return parts.join('');
}
