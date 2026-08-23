import type { Settings } from './settings';
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

export function buildCss(settings: Settings): string {
  // Master switch: when off, inject no CSS. The content script keeps the
  // <style> element in the DOM so flipping the switch on later just
  // re-fills it without needing a page reload.
  if (!settings.enabled) return '';

  const parts: string[] = [];

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
  if (settings.watchPage.hideAISummary)
    parts.push(rule(SELECTORS.watchPage.hideAISummary));
  if (settings.watchPage.hideFundraiser)
    parts.push(rule(SELECTORS.watchPage.hideFundraiser));
  if (settings.watchPage.hideEndScreenCards)
    parts.push(rule(SELECTORS.watchPage.hideEndScreenCards));
  if (settings.watchPage.hideDescription)
    parts.push(rule(SELECTORS.watchPage.hideDescription));
  if (settings.watchPage.hideComments)
    parts.push(rule(SELECTORS.watchPage.hideComments));
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
      parts.push('ytd-watch-flexy #secondary { display: none !important; }\n');
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

  // Ads
  if (settings.ads.hideAll) parts.push(rule(SELECTORS.ads.hideAll));

  // Popups
  if (settings.popups.hideSurveys) parts.push(rule(SELECTORS.popups.hideSurveys));

  return parts.join('');
}
