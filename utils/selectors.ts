/**
 * The single source of truth for which DOM elements each toggle hides.
 *
 * When YouTube ships a redesign, this is the file to edit - append or replace
 * selectors per toggle. No other code changes needed.
 *
 * Each entry is an array; buildCss joins them with commas and adds !important.
 *
 * Confidence annotations:
 *   ✓  high - well-known stable selector, used by other YouTube extensions
 *   ?  medium - likely current but verify in DevTools
 *   !  guess - verify; YouTube may have renamed/restructured
 *
 * Desktop YouTube (www.youtube.com) uses a Polymer-based component system
 * where most renderers are `ytd-*` custom elements. Many shelves are
 * distinguished by attributes (e.g. `is-shorts`) or by inspecting their
 * `chip` / `header` text.
 *
 * Mobile YouTube (m.youtube.com) is a *separate* site with parallel
 * renderers prefixed `ytm-*` instead of `ytd-*`. Some classes are shared
 * across both (`.ytp-*` player chrome, the newer `.ytBadgeShape*`
 * view-model classes, all URL-based selectors).
 * Mobile-specific selectors below carry a "mobile" inline note; selectors
 * with no "mobile" note are desktop-only and simply don't match anything
 * when injected onto m.youtube.com (safe - CSS just no-ops). Toggles
 * without a mobile mapping (e.g. left-sidenav entries - mobile YT has no
 * sidenav) are flagged in their section comment.
 */
export const SELECTORS = {
  sidenav: {
    // ─── Hide Shorts entry in left/mini sidenav ─────────────────────────
    // In the full sidenav the Shorts entry has no href (JS-driven
    // navigation) and is the only [is-primary] entry without one; titles
    // are localised ("ショート" in Japanese), so the title match only
    // covers locales that keep the English brand name. The mini sidenav
    // entry does carry /shorts/.
    //
    // Mobile YT has no left sidenav at all - the analogous concept is the
    // bottom pivot bar, and "Shorts" lives there as a pivot item. The user
    // intent ("hide the Shorts entrypoint") matches cleanly, so we extend
    // this toggle to also hide the mobile Shorts pivot button.
    hideShorts: [
      'ytd-guide-entry-renderer[is-primary]:has(> a#endpoint:not([href]))', // ✓ full sidenav, any locale
      'ytd-mini-guide-entry-renderer:has(a#endpoint[href^="/shorts"])', // ✓ collapsed sidenav, any locale
      'ytd-guide-entry-renderer:has(a#endpoint[title="Shorts"])', // ✓ full sidenav, English title
      'ytd-mini-guide-entry-renderer:has(a#endpoint[title="Shorts"])', // ✓ collapsed sidenav, English title
      'ytm-pivot-bar-item-renderer:has(.pivot-shorts)', // ✓ mobile bottom-nav Shorts button (uBlock confirmed)
    ],

    // ─── Hide entire "Explore" section ──────────────────────────────────
    // Section title text lives in <yt-formatted-string>'s text content,
    // which CSS can't match. Instead, match the section wrapper by an
    // inner href unique to Explore. Movies & TV's /feed/storefront is the
    // most distinctive marker; YouTube's official Music brand channel
    // /channel/UC-9-kyTW8... is a redundant backup.
    hideExplore: [
      'ytd-guide-section-renderer:has(a#endpoint[href*="/feed/storefront"])', // ✓ Movies & TV
      'ytd-guide-section-renderer:has(a#endpoint[href="/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ"])', // ✓ YT Music brand channel
    ],

    // ─── Hide "More from YouTube" section ───────────────────────────────
    // Same approach: match the section wrapper by an inner href unique
    // to this section. NOTE: studio.youtube.com is excluded as a marker
    // because it also appears in the You section's "Your videos" entry.
    hideMoreFromYouTube: [
      'ytd-guide-section-renderer:has(a#endpoint[href*="music.youtube.com"])', // ✓
      'ytd-guide-section-renderer:has(a#endpoint[href*="youtubekids.com"])', // ✓
      'ytd-guide-section-renderer:has(a#endpoint[href*="youtube.com/premium"])', // ? non-premium users only
    ],

    // ─── "You" section: minimal mode (denylist) ────────────────────────
    // Keep History, Playlists, Watch Later. Hide Your channel, Liked
    // videos, Your videos, Downloads and the Show more expander. Titles
    // are localised, so entries are matched by href: the user's own
    // channel (/@handle or /channel/), list=LL, and Studio. Scoped to
    // the You section, identified by its /feed/you header entry, to
    // avoid collateral damage elsewhere (the Subscriptions section also
    // has channel links and a Show more/less expander).
    youSectionMinimal: [
      'ytd-guide-collapsible-section-entry-renderer:has(#header-entry a#endpoint[href="/feed/you"]) ytd-guide-entry-renderer:not(#header-entry):has(> a#endpoint:is([href^="/@"], [href^="/channel/"], [href="/playlist?list=LL"], [href*="studio.youtube.com"]))', // ✓ Your channel, Liked videos, Your videos
      'ytd-guide-downloads-entry-renderer', // ✓ Downloads (own wrapper)
      // Show more / Show fewer expander, scoped to the You section only
      'ytd-guide-collapsible-section-entry-renderer:has(#header-entry a#endpoint[href="/feed/you"]) ytd-guide-collapsible-entry-renderer', // ✓
    ],

    // ─── "You" section: hidden mode ────────────────────────────────────
    // Hide the whole section wrapper. The You section is the only
    // ytd-guide-section-renderer whose header entry links to /feed/you
    // (signed out, a plain primary "You" entry with the same href sits
    // in the first section; the header-entry id excludes it).
    youSectionHidden: [
      'ytd-guide-section-renderer:has(ytd-guide-entry-renderer[id="header-entry"] a#endpoint[href="/feed/you"])', // ✓
    ],
  },

  masthead: {
    // ─── Hide "Create" button in masthead (top right) ──────────────────
    // The aria-label is localised. Structurally, Create is the only
    // ytd-button-renderer among the masthead buttons when signed in;
    // signed out the only one is Sign in, which links to ServiceLogin.
    // Scoped to ytd-masthead so we don't hit any unrelated "Create"
    // buttons elsewhere (e.g., on Studio pages).
    //
    // Mobile: the create entrypoint lives in the bottom pivot bar (the
    // central + icon), not the top bar. Pivot-bar items expose semantic
    // hooks like `.pivot-create` similar to `.pivot-shorts`.
    hideCreate: [
      'ytd-masthead #buttons > ytd-button-renderer:not(:has(a[href*="ServiceLogin"]))', // ✓ any locale
      'ytd-masthead ytd-button-renderer:has(button[aria-label="Create"])', // ✓ English label
      'ytm-pivot-bar-item-renderer:has(.pivot-create)', // ? mobile bottom-nav Create
    ],

    // ─── Hide notifications bell in masthead (top right) ───────────────
    // Dedicated tag - stable hook with no risk of catching other things.
    //
    // Mobile equivalent: the bell is in the mobile top bar, wrapped by a
    // dedicated renderer following the same naming pattern. The bottom
    // pivot bar also exposes a separate Activity tab which surfaces the
    // same notification stream - hide both for parity.
    hideNotifications: [
      'ytd-masthead ytd-notification-topbar-button-renderer', // ✓
      'ytm-notification-topbar-button-renderer', // ? mobile top-bar bell (naming-pattern guess)
      'ytm-pivot-bar-item-renderer:has(.pivot-activity)', // ? mobile pivot Activity tab
    ],
  },

  feeds: {
    // ─── Master shelf hide (catch-all by renderer tag) ─────────────────
    // Known shelf-style wrappers used by YouTube for recommendation /
    // curation strips. These all hold dismissible content (the shelf
    // user can collapse) and uniformly map to "junk we want gone."
    //
    // We intentionally do NOT use a generic :has(> #dismissible) match
    // - the #dismissible id appears further up the tree on some pages
    // (notably channel pages, where the entire video tab is wrapped in
    // a parent with a #dismissible direct child). Using explicit tag
    // names keeps the hide narrowly on shelf wrappers only.
    //
    // This subsumes the fine-grained title-based shelf toggles (Games,
    // Movies, Posts) - they become redundant when this is on, but
    // remain useful when this is disabled. Card-level toggles
    // (members-only, premieres, Shorts cards) are NOT subsumed since
    // those target ytd-rich-item-renderer, not these wrappers.
    hideShelves: [
      'ytd-rich-shelf-renderer', // ✓ home/subs/search rich shelves (Posts, Most relevant, …)
      'ytd-reel-shelf-renderer', // ✓ Shorts reel shelves
      'ytd-shelf-renderer', // ✓ legacy shelf
      'ytd-rich-section-renderer', // ✓ section wrapper (also on channel home - buildCss excludes channel pages)
      'ytd-chips-shelf-with-video-shelf-renderer', // ✓ "Explore more topics" pattern
      'grid-shelf-view-model', // ✓ newer view-model grid shelf (no ytd- prefix; both platforms)
      // Mobile shelf wrappers - same naming pattern, ytm- prefix.
      'ytm-rich-shelf-renderer', // ? mobile rich shelf
      'ytm-reel-shelf-renderer', // ✓ mobile Shorts shelf (uBlock confirmed)
      'ytm-shelf-renderer', // ? mobile legacy shelf
      'ytm-rich-section-renderer', // ✓ mobile section wrapper (uBlock confirmed)
    ],

    // ─── Hide Shorts in feeds ───────────────────────────────────────────
    // Shorts surfaces in feeds:
    //  1. Rich shelves on home: ytd-rich-shelf-renderer with is-shorts attribute
    //  2. Reel shelf renderer (sometimes used for Shorts rows in subs/search)
    //  3. Individual Shorts cards inline in grids: ytd-video-renderer or
    //     ytd-rich-item-renderer wrapping a /shorts/ link
    hideShorts: [
      'ytd-rich-shelf-renderer[is-shorts]', // ✓ home page Shorts shelf
      'ytd-reel-shelf-renderer', // ✓ Shorts reel shelf
      // Home nests shelves inside a full-width rich-section grid row. Hiding
      // only the inner shelf leaves the empty wrapper forcing a row break
      // (a blank band, and a short row above it when a card in that row is
      // hidden by another toggle). Every shelf-level hide in this file needs
      // a matching rich-section wrapper rule.
      'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])', // ✓ section wrapper
      'ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)', // ✓ section wrapper
      'ytd-rich-section-renderer:has(grid-shelf-view-model a[href^="/shorts/"])', // ? section wrapper around view-model grid shelf
      'grid-shelf-view-model:has(a[href^="/shorts/"])', // ✓ search results Shorts shelf
      'ytd-video-renderer:has(a#thumbnail[href^="/shorts/"])', // ✓ search results Shorts card
      'ytd-rich-item-renderer:has(a[href^="/shorts/"])', // ✓ home/subs Shorts card
      'ytm-shorts-lockup-view-model-v2', // ✓ Shorts card inside desktop grid shelves (search, channel)
      // Mobile (m.youtube.com). Lockup-view-model and reel-shelf are the
      // confirmed uBlock filters; the rich-item wrapper handles inline
      // Shorts cards in mobile feeds.
      'ytm-shorts-lockup-view-model', // ✓ mobile Shorts card (uBlock confirmed)
      'ytm-reel-shelf-renderer', // ✓ mobile Shorts shelf
      'ytm-rich-section-renderer:has(ytm-reel-shelf-renderer)', // ! mobile section wrapper
      'ytm-rich-item-renderer:has(a[href^="/shorts/"])', // ✓ mobile inline Shorts card
      'ytm-video-with-context-renderer:has(ytm-thumbnail-overlay-time-status-renderer[data-style="SHORTS"])', // ✓ mobile feed/search Shorts (uBlock confirmed pattern)
    ],

    // ─── Hide Games shelf in feeds ──────────────────────────────────────
    // Gaming shelves appear on home as a rich shelf with a games icon/title.
    // Filter lists report an [is-gaming] attribute on the "Top live games"
    // shelf; otherwise we match by the shelf's title text, which is
    // English only. brittle - likely needs tuning.
    hideGames: [
      'ytd-rich-shelf-renderer[is-gaming]', // ! attribute reported by filter lists
      'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-gaming])', // ! section wrapper
      // Title-based (English only): shelf header contains "Gaming" or "Games".
      'ytd-rich-shelf-renderer:has(#title-text:is([title*="Gaming"], [title*="Games"]))', // !
      'ytd-rich-section-renderer:has(#title:is([title*="Gaming"], [title*="Games"]))', // !
      // Specific known shelf: "Recommended games" / "Trending games"
      'ytd-rich-shelf-renderer:has(#title-text[title*="games" i])', // !
      'ytd-rich-section-renderer:has(#title-text:is([title*="gaming" i], [title*="games" i]))', // ! section wrapper for nested title-matched shelves
      // YouTube Playables (mini-games) shelf. Its header says "YouTube
      // Playables", so the title matches above miss it; the /playables
      // header link is a structural, locale-independent hook. Section
      // wrapper included so no empty grid row is left behind.
      'ytd-rich-shelf-renderer:has(a[href^="/playables"])', // ✓ Playables shelf
      'ytd-rich-section-renderer:has(a[href^="/playables"])', // ✓ section wrapper
      'ytd-horizontal-card-list-renderer:has(a[href^="/playables"])', // ! Playables in a card row (reported by filter lists)
      // Mobile equivalents. The title-anchor structure on mobile uses
      // different inner IDs; we match the shelf wrapper having ANY child
      // [title*="Games" i] which is less precise but the safest bet
      // without device verification.
      'ytm-rich-shelf-renderer:has([title*="Gaming" i])', // ! mobile gaming shelf
      'ytm-rich-shelf-renderer:has([title*="Games" i])', // ! mobile games shelf
      'ytm-rich-section-renderer:has([title*="Gaming" i])', // ! mobile gaming section
      'ytm-rich-section-renderer:has([title*="Games" i])', // ! mobile games section
      'ytm-rich-shelf-renderer:has(a[href^="/playables"])', // ! mobile Playables shelf (URL hook is cross-platform)
      'ytm-rich-section-renderer:has(a[href^="/playables"])', // ! mobile section wrapper
    ],

    // ─── Hide "feed nudges" (algorithmic prompts in home grid) ────────
    // Cards like "Looking for something different? Get video recommendations
    // beyond what you usually watch" - wrapped in the standard rich-item
    // grid slot. Hiding the whole slot avoids leaving a blank gap in the
    // grid (the inner ytd-feed-nudge-renderer alone wouldn't collapse).
    hideFeedNudges: [
      'ytd-rich-item-renderer:has(ytd-feed-nudge-renderer)', // ✓
      'ytm-rich-item-renderer:has(ytm-feed-nudge-renderer)', // ! mobile feed nudge (naming-pattern guess)
    ],

    // ─── Hide event banners (live events, breaking news, election) ────
    // Editorial-style banners only - paid placements live in the `ads`
    // namespace. Two variants observed here:
    //  - ytd-statement-banner-renderer (election / news / statement)
    //  - ytd-emergency-onebox-renderer (emergency / health onebox)
    // Plus title-matched shelves for live events and topical-discovery.
    hideEventBanners: [
      'ytd-statement-banner-renderer', // ✓ election/news/statement banner (confirmed in fanboy-annoyance + AdGuard)
      'ytd-emergency-onebox-renderer', // ✓ emergency banner (confirmed in uBO community list)
      'ytd-rich-section-renderer:has(ytd-statement-banner-renderer, ytd-emergency-onebox-renderer)', // ? section wrapper around banner
      // Live event hero: rich shelf with chip "Live now" / "Premieres".
      // Title matches here are English only.
      'ytd-rich-shelf-renderer:has(#title-text[title*="Live" i])', // !
      'ytd-rich-shelf-renderer:has(#title-text[title*="Breaking news" i])', // !
      // Section wrapper around a nested live/news shelf. :has() can't nest,
      // so match the shelf's title-text from the wrapper directly.
      'ytd-rich-section-renderer:has(#title-text:is([title*="Live" i], [title*="Breaking news" i]))', // !
      // "Explore more topics" - topical-discovery shelf wrapped in
      // YouTube's newer chips-shelf-with-video pattern. The title lives in
      // h2.ytShelfHeaderLayoutTitle (NOT the older #title-text hook), and
      // CSS can't text-match it directly, so we hide the whole wrapper
      // class. Trade-off: any future shelf using the same wrapper is also
      // hidden - acceptable for tubeless's intent.
      'ytd-chips-shelf-with-video-shelf-renderer', // ✓ tag name match
      'ytd-rich-section-renderer:has(ytd-chips-shelf-with-video-shelf-renderer)', // ✓ section wrapper
      // Mobile equivalents - naming-pattern parallels. Not yet observed in
      // public filter lists, so flagged ! pending device verification.
      // Mobile "Explore more topics" - the element has no ytm- prefix.
      'chips-shelf-with-video-shelf-renderer', // ✓ mobile topical-discovery shelf
      'ytm-rich-section-renderer:has(chips-shelf-with-video-shelf-renderer)', // ✓ mobile section wrapper
      'ytm-statement-banner-renderer', // ! mobile statement/election banner
      'ytm-emergency-onebox-renderer', // ! mobile emergency banner
      'ytm-rich-shelf-renderer:has([title*="Live" i])', // ! mobile live-event shelf
      'ytm-rich-shelf-renderer:has([title*="Breaking news" i])', // ! mobile breaking-news shelf
      'ytm-rich-section-renderer:has([title*="Live" i], [title*="Breaking news" i])', // ! mobile section wrapper
    ],

    // ─── Hide top-of-page alert / promo banners ────────────────────────
    // The thin notification-style banners YouTube shows above the home
    // feed: language switch prompts, app-wide alerts (e.g. policy
    // notices), and the Primetime / movies promo strip. Scoped under
    // ytd-app so the bare IDs (which YouTube could reuse elsewhere) only
    // match at the page-shell level.
    hideAlertBanners: [
      'ytd-app #yt-lang-alert-container', // ? language switch nag
      'ytd-app #alert-banner', // ? generic top-of-page alert
      'ytd-app #notification-footer', // ? sticky footer notification
      'ytd-primetime-promo-renderer', // ✓ Primetime/movies promo strip (confirmed in fanboy-annoyance)
      // Mobile: the app shell is ytm-app rather than ytd-app. The inner
      // alert/notification ids may not exist on mobile (these are mostly
      // desktop-only nags), but the promo renderer follows the ytm- rename.
      'ytm-app #alert-banner', // ! mobile top-of-page alert (id may not exist on mobile)
      'ytm-primetime-promo-renderer', // ! mobile Primetime promo
    ],

    // ─── Hide Movies / Shows in feeds ──────────────────────────────────
    // Three surfaces:
    //   1. Shelves with "Movies" / "Shows" in the title (covered by the
    //      master hideShelves toggle, but kept here as a fallback).
    //   2. Individual movie cards interleaved into the home grid. These
    //      are normal ytd-rich-item-renderer wrappers but carry an avatar
    //      labelled "YouTube Movies" and a watch URL with pp=sAQB.
    //   3. The same film cards in the watch-page sidebar.
    // The Buy/Rent panel on a film's own watch page (#offer-module) is
    // deliberately left alone: it's how you rent the film you opened.
    hideMovies: [
      // Shelves (legacy - duplicated by hideShelves master). Title
      // matches are English only.
      'ytd-rich-shelf-renderer:has(#title-text[title*="Movies" i])', // !
      'ytd-rich-shelf-renderer:has(#title-text[title*="movie" i])', // !
      'ytd-rich-shelf-renderer:has(#title-text[title*="Shows" i])', // !
      // Section wrapper around a nested movie/show shelf. :has() can't nest,
      // so match the shelf's title-text from the wrapper directly.
      'ytd-rich-section-renderer:has(#title-text:is([title*="movie" i], [title*="Shows" i]))', // !
      // Individual movie cards in the grid. Every YouTube Movies link
      // carries pp=sAQB (sidebar lockups and storefront alike), which is
      // locale-independent; the avatar aria-label is English only.
      'ytd-rich-item-renderer:has(a[href*="pp=sAQB"])', // ? URL marker, any locale
      'ytd-rich-item-renderer:has([aria-label="Go to channel YouTube Movies"])', // ✓ English label
      'ytd-watch-next-secondary-results-renderer yt-lockup-view-model:has(a[href*="pp=sAQB"])', // ✓ watch sidebar ("Free with ads" films)
      // Mobile equivalents. The aria-label hook is platform-independent
      // (YouTube Movies channel is the same entity on both sites). The
      // pp=sAQB URL marker is also identical across platforms.
      'ytm-rich-item-renderer:has([aria-label="Go to channel YouTube Movies"])', // ? mobile movie card by avatar
      'ytm-rich-item-renderer:has(a[href*="pp=sAQB"])', // ? mobile movie card by URL marker
      'ytm-rich-shelf-renderer:has([title*="Movies" i])', // ! mobile movies shelf
      'ytm-rich-shelf-renderer:has([title*="Shows" i])', // ! mobile shows shelf
      'ytm-rich-section-renderer:has([title*="Movies" i], [title*="Shows" i])', // ! mobile section wrapper
    ],

    // ─── Hide member-only videos in feeds ──────────────────────────────
    // Current view-model badge: <badge-shape class="ytBadgeShapeCommerce">
    // with a .ytBadgeShapeIcon (the membership star) and a
    // .ytBadgeShapeText child ("Members only" / "Members first"). The text
    // isn't CSS-matchable and the aria-label is usually absent. Commerce
    // also styles the "Fundraiser" badge, which has no icon, so the icon
    // child is what separates members-only from fundraisers.
    // YouTube ships two class systems for the same badge depending on
    // surface/experiment: the camel-case view-model classes
    // (ytBadgeShapeCommerce) and the wiz classes (badge-shape-wiz--commerce)
    // - match both.
    // Older ytBadgeShapeMembership and polymer .badge patterns kept as
    // fallbacks for surfaces still using the legacy template.
    // NB: the badge persists for paying members, so these selectors also
    // hide videos the user can actually watch on channels they've joined
    // - the popup hint on this toggle documents that trade-off.
    hideMembersOnly: [
      'ytd-rich-item-renderer:has(.ytBadgeShapeCommerce > .ytBadgeShapeIcon)', // ✓ current badge class
      'ytd-video-renderer:has(.ytBadgeShapeCommerce > .ytBadgeShapeIcon)', // ? search results
      'ytd-grid-video-renderer:has(.ytBadgeShapeCommerce > .ytBadgeShapeIcon)', // ? grid variant
      'ytd-watch-next-secondary-results-renderer yt-lockup-view-model:has(.ytBadgeShapeCommerce > .ytBadgeShapeIcon)', // ✓ watch sidebar
      // Wiz class-system variant of the same commerce badge
      'ytd-rich-item-renderer:has(.badge-shape-wiz--commerce > .badge-shape-wiz__icon)', // ! wiz badge class
      'ytd-video-renderer:has(.badge-shape-wiz--commerce > .badge-shape-wiz__icon)', // ! search results
      'ytd-grid-video-renderer:has(.badge-shape-wiz--commerce > .badge-shape-wiz__icon)', // ! grid variant
      // Legacy view-model class (pre-rename)
      'ytd-rich-item-renderer:has(.ytBadgeShapeMembership)', // ?
      'ytd-video-renderer:has(.ytBadgeShapeMembership)', // ?
      'ytd-grid-video-renderer:has(.ytBadgeShapeMembership)', // ?
      // Legacy polymer fallbacks
      'ytd-rich-item-renderer:has(ytd-badge-supported-renderer .badge[aria-label*="Members only" i])', // ?
      'ytd-rich-item-renderer:has(.badge-style-type-members-only)', // ?
      // Mobile - the .ytBadgeShape* classes are shared view-model classes,
      // so only the outer wrapper needs ytm- variants.
      'ytm-rich-item-renderer:has(.ytBadgeShapeCommerce > .ytBadgeShapeIcon)', // ? mobile members-only card
      'ytm-video-with-context-renderer:has(.ytBadgeShapeCommerce > .ytBadgeShapeIcon)', // ? mobile search/feed
      'ytm-rich-item-renderer:has(.badge-shape-wiz--commerce > .badge-shape-wiz__icon)', // ! mobile wiz badge card
      'ytm-video-with-context-renderer:has(.badge-shape-wiz--commerce > .badge-shape-wiz__icon)', // ! mobile wiz search/feed
      'ytm-rich-item-renderer:has(.ytBadgeShapeMembership)', // ? mobile legacy badge
    ],

    // ─── Hide community posts in feeds ──────────────────────────────────
    // Match the shelf wrapper structurally - any shelf containing a
    // post-renderer child is, by definition, a posts shelf. More durable
    // than title-text matching (which would need text-content matching
    // CSS doesn't support). Also covers individual inline posts.
    hidePosts: [
      'ytd-rich-shelf-renderer:has(ytd-post-renderer)', // ✓ "Latest YouTube posts" shelf
      'ytd-rich-section-renderer:has(ytd-post-renderer)', // ✓ section variant
      'ytd-post-renderer', // ✓ individual post cards
      'ytd-backstage-post-renderer', // ? legacy post card name
      'ytd-backstage-post-thread-renderer', // ? thread wrapper
      // Inline posts in the home grid sit inside a rich-item cell; hiding
      // only the inner post renderer leaves a blank grid position.
      'ytd-rich-item-renderer:has(ytd-post-renderer, ytd-backstage-post-renderer, ytd-backstage-post-thread-renderer)', // ✓ grid cell wrapping an inline post
      // Mobile equivalents - naming-pattern parallels.
      'ytm-rich-shelf-renderer:has(ytm-post-renderer)', // ! mobile posts shelf
      'ytm-rich-section-renderer:has(ytm-post-renderer)', // ! mobile section variant
      'ytm-rich-item-renderer:has(ytm-post-renderer)', // ! mobile grid cell wrapping an inline post
      'ytm-post-renderer', // ! mobile post card
      'ytm-backstage-post-renderer', // ! mobile legacy post card
      'ytm-backstage-post-thread-renderer', // ! mobile thread wrapper
    ],

    // ─── Hide feed filter chip bar (Home / Subscriptions) ──────────────
    // The horizontal "All / Gaming / Music / …" chip bar at the top of
    // home and subscriptions feeds. Note: hiding this also requires a
    // height override on #frosted-glass.with-chipbar (handled in
    // buildCss), otherwise a blank gap or - if hidden outright - the
    // masthead loses its backdrop entirely.
    hideFilterChips: [
      'ytd-feed-filter-chip-bar-renderer', // ✓
      'ytm-feed-filter-chip-bar-renderer', // ? mobile feed filter chip bar (naming-pattern parallel)
    ],

    // ─── Hide Mixes (auto-generated playlists) ─────────────────────────
    // Mix playlists use URL prefix list=RD ("radio"), but YouTube also
    // links ordinary music and long-form videos with list=RD…&start_radio=1,
    // so the URL alone matches plain videos. A Mix card is a list=RD link
    // plus the stacked collection thumbnail.
    hideMixes: [
      'ytd-rich-item-renderer:has(yt-collection-thumbnail-view-model):has(a[href*="list=RD"])', // ✓ home/subs Mix card
      'ytd-search yt-lockup-view-model:has(yt-collection-thumbnail-view-model):has(a[href*="list=RD"])', // ✓ search results Mix
      'ytd-watch-next-secondary-results-renderer yt-lockup-view-model:has(yt-collection-thumbnail-view-model):has(a[href*="list=RD"])', // ✓ watch sidebar Mix
      // Mobile Home renders Mix cards as ytm-radio-renderer inside a grid
      // cell; hide the cell too or a blank slot is left. The list=RD
      // overmatch applies here as well, hence the collection thumbnail.
      'ytm-rich-item-renderer:has(ytm-radio-renderer)', // ✓ mobile Mix grid cell
      'ytm-radio-renderer', // ✓ mobile Mix card
      'ytm-rich-item-renderer:has(yt-collection-thumbnail-view-model):has(a[href*="list=RD"])', // ! mobile mix card, view-model variant
    ],

    // ─── Hide Collections (playlists + podcasts) ───────────────────────
    // YouTube renders playlists and podcasts identically: as multi-item
    // collection cards with a stacked thumbnail (yt-collection-thumbnail-
    // view-model) and a list=PL... URL. There's no CSS-detectable
    // distinction between the two, so a single toggle covers both.
    // Note: this targets feed and search cards only, not sidenav playlist
    // entries.
    hideCollections: [
      'ytd-rich-item-renderer:has(yt-collection-thumbnail-view-model)', // ✓ stacked thumbnail
      'ytd-rich-item-renderer:has(a[href*="&list=PL"])', // ✓ playlist URL pattern
      'ytd-search yt-lockup-view-model:has(yt-collection-thumbnail-view-model)', // ✓ search results playlist/podcast
      'ytd-grid-playlist-renderer', // ? grid variant
      'ytd-podcast-renderer', // ? dedicated podcast renderer
      // Mobile - yt-collection-thumbnail-view-model is a shared view-model
      // class (no platform prefix), so it applies cleanly under ytm- wrappers.
      'ytm-rich-item-renderer:has(yt-collection-thumbnail-view-model)', // ? mobile collection card
      'ytm-rich-item-renderer:has(a[href*="&list=PL"])', // ? mobile playlist URL pattern
      'ytm-playlist-renderer', // ! mobile playlist renderer
      'ytm-podcast-renderer', // ! mobile podcast renderer
    ],

    // ─── Hide Music videos in feeds ────────────────────────────────────
    // Feeds and search results. Music videos use a special duration badge that combines a music-
    // note icon WITH the duration text in a single <badge-shape>. The
    // distinguishing structural fact: icon + text in one badge, marked
    // with ytBadgeShapeTypography but NOT ytBadgeShapeNoText.
    //
    // Other icon-bearing badges to exclude:
    //   - ytBadgeShapeNoText: icon-only badges (e.g., kids-restricted /
    //     unavailable indicators) - distinct second badge alongside duration.
    //   - Collection thumbnails (podcasts/playlists) - caught by hideCollections.
    //
    // CSS can't match SVG path content directly; this composite class
    // fingerprint is the cleanest available hook.
    hideMusic: [
      'ytd-rich-item-renderer:has(badge-shape.ytBadgeShapeThumbnailDefault:not(.ytBadgeShapeNoText) .ytBadgeShapeIcon):not(:has(yt-collection-thumbnail-view-model))', // ✓
      'ytd-video-renderer:has(badge-shape.ytBadgeShapeThumbnailDefault:not(.ytBadgeShapeNoText) .ytBadgeShapeIcon)', // ✓ search results
      // Mobile - same badge fingerprint, ytm- wrapper. ytBadgeShape* and
      // yt-collection-thumbnail-view-model are shared view-model classes.
      'ytm-rich-item-renderer:has(badge-shape.ytBadgeShapeThumbnailDefault:not(.ytBadgeShapeNoText) .ytBadgeShapeIcon):not(:has(yt-collection-thumbnail-view-model))', // ? mobile music card
    ],

    // ─── Hide Live streams in feeds ────────────────────────────────────
    // Live videos carry a "LIVE" badge on the thumbnail (badge-shape with
    // ytBadgeShapeThumbnailLive in grids, ytBadgeShapeLive in search
    // results). The avatar's live ring (ytSpecAvatarShapeLiveBadge) is
    // NOT a marker: it means the channel is live right now and appears
    // on that channel's ordinary uploads too. Old overlay-style="LIVE"
    // pattern kept as a fallback for surfaces still using the legacy
    // template.
    hideLive: [
      'ytd-rich-item-renderer:has(.ytBadgeShapeThumbnailLive)', // ✓ new badge class
      'ytd-video-renderer:has(.ytBadgeShapeLive)', // ✓ search result badge
      'ytd-video-renderer:has(ytd-thumbnail[is-live-video])', // ✓ search result thumbnail attribute
      'ytd-video-renderer:has(.ytBadgeShapeThumbnailLive)', // ? search result variant
      'ytd-rich-item-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"])', // ? legacy
      'ytd-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"])', // ? legacy
      'ytd-grid-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"])', // ? legacy
      // Mobile - badge/avatar classes are shared view-model classes;
      // only the outer wrapper needs the ytm- prefix.
      'ytm-rich-item-renderer:has(.ytBadgeShapeThumbnailLive)', // ? mobile live badge
      'ytm-video-with-context-renderer:has(.ytBadgeShapeThumbnailLive)', // ? mobile search result variant
      // Legacy overlay-style attribute fallback, with ytm- prefix for the
      // mobile thumbnail overlay renderer.
      'ytm-rich-item-renderer:has(ytm-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"])', // ! mobile legacy
      'ytm-video-with-context-renderer:has(ytm-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"])', // ! mobile legacy
    ],

    // ─── Hide premieres & upcoming/scheduled videos in feeds ───────────
    // New view-model: premiere/upcoming cards uniquely carry a
    // <lockup-attachments-view-model> child holding the "Notify me"
    // toggle. Regular video cards never have this attachment in feed
    // grids. Old polymer overlay-style="UPCOMING" kept as a fallback.
    // Premieres appear with an "upcoming" overlay or a scheduled-time
    // badge. Two main hooks:
    //  - upcoming overlay: ytd-thumbnail-overlay-time-status-renderer
    //    with overlay-style="UPCOMING"
    //  - "Premiering on…" / "Live in…" metadata text
    hidePremieres: [
      'ytd-rich-item-renderer:has(lockup-attachments-view-model)', // ✓ "Notify me" attachment
      'ytd-video-renderer:has(lockup-attachments-view-model)', // ✓ search results
      // Legacy polymer fallbacks
      'ytd-rich-item-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="UPCOMING"])', // ?
      'ytd-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="UPCOMING"])', // ?
      'ytd-grid-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="UPCOMING"])', // ?
      // Mobile - lockup-attachments-view-model is a shared view-model
      // class; only the outer wrapper needs the ytm- prefix.
      'ytm-rich-item-renderer:has(lockup-attachments-view-model)', // ? mobile "Notify me" attachment
      'ytm-video-with-context-renderer:has(lockup-attachments-view-model)', // ? mobile search results
      'ytm-rich-item-renderer:has(ytm-thumbnail-overlay-time-status-renderer[overlay-style="UPCOMING"])', // ! mobile legacy
    ],
  },

  watchPage: {
    // Mobile YouTube's watch page has a substantially different layout
    // from desktop - the action row is a horizontal-scrolling chip strip,
    // comments and recommendations are inline below the player rather
    // than in a sidebar, and several desktop-only artefacts (clarify box,
    // engagement panels) have no mobile counterpart. Where a mobile
    // mapping is meaningful, it is added below with the appropriate
    // confidence; where no clear analogue exists, the section comment
    // calls it out explicitly.

    // ─── "Minimal" action row on watch pages ───────────────────────────
    // The action row under the player has a lot of buttons. "Minimal"
    // mode keeps the essentials (Subscribe, Like/Dislike, Save) and hides
    // the rest: Join (channel membership), notification bell, the AI
    // "Ask" entrypoint, Share, and the kebab (more) menu.
    //
    // Mobile: ytd-watch-metadata is replaced by a different container,
    // typically ytm-slim-video-metadata-section-renderer or similar, and
    // the action row uses horizontally scrolled chip buttons rather than
    // discrete renderer-per-button. A clean per-button mapping isn't
    // achievable from CSS alone without DevTools verification - flagged !
    // and provided as best-effort. The aria-label-based hooks are the
    // most portable across platforms.
    actionRowMinimal: [
      // Join (channel membership) - sponsor button next to subscribe.
      'ytd-watch-metadata #sponsor-button', // ✓ stable id used by YT
      'ytd-watch-metadata ytd-sponsor-button-renderer', // ? legacy renderer name fallback
      // Notification bell - deliberately NOT hidden. On current YouTube the
      // bell is not a standalone icon: once subscribed, the whole "Subscribed ⌄"
      // control IS ytd-subscription-notification-toggle-button-renderer-next,
      // and its menu is the only path to BOTH notification levels and
      // Unsubscribe. Hiding it removed the ability to unsubscribe (the
      // Subscribe button appeared to "vanish" on click as it morphed into the
      // hidden toggle). Minimal mode must keep the subscribe control accessible,
      // so we leave the subscribe-button area untouched. Do not re-add bell
      // selectors here without separating notification-only UI from the
      // unsubscribe path (verified absent on current YT).
      // Ask (AI chat) - YouTube's own .you-chat-entrypoint-button class.
      'ytd-watch-metadata yt-button-view-model:has(.you-chat-entrypoint-button)', // ✓
      // Share button. Its aria-label is localised; structurally it is
      // the only yt-button-view-model directly in the top-level row
      // (Save and Ask sit in #flexible-item-buttons).
      'ytd-watch-metadata #top-level-buttons-computed > yt-button-view-model', // ✓ any locale
      'ytd-watch-metadata yt-button-view-model:has(button[aria-label="Share"])', // ✓ English label
      // Kebab (More actions) - IMPORTANT: ytd-menu-renderer in the
      // action row wraps EVERYTHING (Like/Dislike, Share, Ask, AND the
      // kebab). Targeting the renderer would also nuke Like/Dislike.
      // The kebab is the trailing direct child only - either an older
      // yt-icon-button.dropdown-trigger or the newer yt-button-shape
      // with id="button-shape".
      'ytd-watch-metadata #menu ytd-menu-renderer > yt-icon-button.dropdown-trigger', // ✓
      'ytd-watch-metadata #menu ytd-menu-renderer > yt-button-shape#button-shape', // ✓
      // Mobile - best-effort, aria-label-based hooks. English only: the
      // mobile action bar's buttons have no structural distinction.
      'ytm-slim-video-metadata-section-renderer button[aria-label="Share"]', // ✓ mobile Share, English label
      'ytm-slim-video-metadata-section-renderer button[aria-label*="more actions" i]', // ! mobile kebab
      'ytm-slim-video-metadata-section-renderer .you-chat-entrypoint-button', // ✓ mobile Ask
    ],

    // ─── Hide merch shelf on watch pages ───────────────────────────────
    // Dedicated tag, no overlap with anything else.
    hideMerch: [
      'ytd-merch-shelf-renderer', // ✓
      'ytm-merch-shelf-renderer', // ! mobile merch shelf (naming-pattern guess)
    ],

    // ─── Hide live chat panel (watch sidebar) ─────────────────────────
    // The chat iframe is its own renderer; hiding it leaves the
    // recommendations panel intact. The same ytd-live-chat-frame serves
    // both live chat and chat replay (premieres / stream VODs) - the two
    // are indistinguishable in CSS (identical attributes; the iframe has
    // no src attribute, its /live_chat vs /live_chat_replay document URL
    // is set from JS), so this toggle necessarily covers both.
    // Note: when used together with hideRecommendations, buildCss emits
    // an extra rule to collapse the #secondary column entirely -
    // hideRecommendations's expanded-chat guard
    // (:not(:has(ytd-live-chat-frame:not([collapsed])))) doesn't fire
    // here because display:none doesn't remove elements from the DOM,
    // so an expanded-but-hidden chat would keep an empty column. In
    // theater mode chat instead docks beside the full-bleed player;
    // buildCss handles that reservation too (sidebar-width var).
    hideLiveChat: [
      'ytd-live-chat-frame', // ✓ chat iframe wrapper (live + replay)
      // The "Live chat" / "Live chat replay → Open panel" teaser box
      // under the video title. It lives in ytd-watch-metadata (primary
      // column), not the chat frame, so hiding the frame alone leaves a
      // dead Open panel button that expands an invisible chat. The
      // carousel host element is generic (yt-video-metadata-carousel-
      // view-model) but #teaser-carousel has only been observed hosting
      // the chat teaser, on both live streams and replay VODs.
      'ytd-watch-metadata #teaser-carousel', // ✓ live chat / chat replay teaser
      // Mobile shows live chat in a tap-to-open bottom sheet rather than
      // an always-visible sidebar. Hiding the entry button (rather than
      // the chat surface itself) is the practical equivalent.
      'ytm-live-chat-frame', // ! mobile live chat (naming-pattern guess)
    ],

    // ─── Hide fundraiser / donation shelf on watch pages ───────────────
    // Appears on creator livestreams running a fundraiser. Renders in
    // the #secondary column alongside the chat/recommendations panel.
    // Bare id scoped to ytd-watch-flexy; dedicated renderer name is a
    // guess (no observed instance), kept as a defensive fallback.
    hideFundraiser: [
      'ytd-watch-flexy #donation-shelf', // ? fundraiser shelf wrapper
      'ytd-donation-shelf-renderer', // ! renderer name guess
    ],

    // ─── Hide end-screen cards & end-screen content ────────────────────
    // Two flavours of in-player promotion:
    //   - .ytp-ce-element: creator-added "cards" that appear in the last
    //     ~20 seconds of a video.
    //   - .ytp-endscreen-content / .ytp-ce-* / .ytp-cards-*: YouTube's
    //     post-video auto-generated suggestion grid that overlays after
    //     playback finishes.
    hideEndScreenCards: [
      '.ytp-ce-element', // ✓ creator end-cards
      '.ytp-endscreen-content', // ✓ post-video grid
      '.ytp-cards-teaser', // ✓ in-video teaser
      // The .ytp-* classes are emitted by the shared YouTube player chrome
      // and should match identically on mobile when the same player build
      // ships - no ytm- variant needed.
    ],

    // ─── Hide comments section ─────────────────────────────────────────
    // Single dedicated wrapper on watch pages.
    hideComments: [
      'ytd-comments#comments', // ✓
      // Mobile inlines a comments teaser card under the player which
      // opens the comments bottom sheet on tap. Hiding the card removes
      // the entrypoint entirely.
      'yt-video-metadata-carousel-view-model:has(comments-entry-point-teaser-view-model)', // ✓ mobile comments teaser
    ],

    // ─── Hide the description block under the player ──────────────────
    // The #description wrapper covers the entire bottom-row description
    // card: view count + date, the inline-expander text, the "...more"
    // button, and the structured extras (Summary, Transcript section,
    // info cards / channel social links). One selector hides it all.
    hideDescription: [
      'ytd-watch-metadata #description', // ✓
      // Mobile description sits in its own renderer; the "Show more" tap
      // expands to a bottom sheet, but the inline preview lives here.
      'ytm-expandable-video-description-body-renderer', // ! mobile description preview
      'ytm-slim-video-metadata-section-renderer #description', // ! mobile description id (if used)
    ],

    // ─── Hide info panels / "clarify box" on watch pages ───────────────
    // YouTube attaches context cards to certain videos (Wikipedia
    // citations on history/event topics, election context, COVID
    // info, misinformation flags, etc.). Two structural anchors:
    //  - #clarify-box: outer wrapper for the Wikipedia-style topic card
    //  - ytd-info-panel-container-renderer: broader - also covers
    //    misinformation / election / health disclaimers
    // Hiding both gives a single toggle that covers every variant the
    // user is likely to want gone. Default off - these panels can
    // carry safety info, so opt-in is the more conservative default.
    hideInfoPanels: [
      'ytd-watch-flexy #clarify-box', // ✓ Wikipedia-style topic card
      'ytd-watch-flexy ytd-info-panel-container-renderer', // ✓ broader info panels
    ],

    // ─── Hide watch-page recommendations sidebar (Up next) ─────────────
    // The recommendations renderer is the content; #secondary is the
    // column container that reserves the space. Hiding only the renderer
    // leaves a blank panel - must also collapse the column. Exception:
    // when live chat is EXPANDED in #secondary, keep the column so chat
    // remains visible. The guard must check for an expanded frame, not
    // mere existence: YouTube ships ytd-live-chat-frame[collapsed] on any
    // video that ever had chat (premieres / stream VODs with chat replay,
    // not just live streams), where it renders nothing - guarding on
    // existence preserved a blank reserved column on all those videos.
    // Expanding chat replay removes [collapsed], bringing the column back.
    // Trade-off: while collapsed, the frame's own "Show chat" button is
    // hidden with the column - the "Live chat replay → Open panel" teaser
    // under the video still re-opens it.
    hideRecommendations: [
      'ytd-watch-next-secondary-results-renderer', // ✓ the content
      'ytd-watch-flexy #secondary:not(:has(ytd-live-chat-frame:not([collapsed])))', // ✓ collapse column unless chat is expanded
      // Mobile shows recommendations inline below the player rather than
      // in a sidebar.
      'ytm-single-column-watch-next-results-renderer .related-items-container', // ✓ mobile related-items wrapper
      'ytm-item-section-renderer[section-identifier="related-items"]', // ✓ mobile related-items section
    ],
  },

  ads: {
    // ─── Hide ads across all YouTube surfaces ───────────────────────────
    // Covers: in-feed sponsored slots (search/home), masthead banner,
    // watch-page display & companion ads, in-player ad chrome (countdown,
    // overlay banner, progress bar - cosmetic only, see note below),
    // sponsored brand & shopping shelves, Premium upsell mealbars, and
    // ad-click tracking anchors.
    //
    // Premium accounts don't see ads server-side, so most selectors here
    // are a silent no-op for paying users.
    //
    // IMPORTANT - in-player chrome is cosmetic only:
    // Hiding .video-ads / .ytp-ad-module / .ytp-ad-overlay-* removes the
    // countdown UI and overlay banners but the <video> element still
    // plays the ad's audio and burns its duration. CSS alone cannot skip
    // a pre-roll. This is intentional - Tubeless is a no-network,
    // no-JS-injection extension. If you want pre-roll skipping, use a
    // dedicated network-level ad blocker alongside Tubeless.
    hideAll: [
      // ── In-feed sponsored slots & promoted results ───────────────
      'ytd-ad-slot-renderer', // ✓ generic in-feed ad wrapper
      // Newer feed templates nest the ad slot inside an ordinary rich-grid
      // cell; hiding only the inner slot leaves the cell holding a blank
      // grid position, so hide the wrapper cell too. The wrapper match
      // covers every in-feed ad renderer below, not just ad-slot, in case
      // YouTube ships one into a grid cell without the ad-slot ancestor.
      'ytd-rich-item-renderer:has(ytd-ad-slot-renderer, ytd-display-ad-renderer, ytd-in-feed-ad-layout-renderer, ytd-promoted-video-renderer, ytd-promoted-sparkles-web-renderer, ytd-banner-promo-renderer)', // ✓ home-grid cell wrapping an ad
      'ytd-rich-section-renderer:has(ytd-ad-slot-renderer, ytd-display-ad-renderer, ytd-in-feed-ad-layout-renderer, ytd-promoted-video-renderer, ytd-promoted-sparkles-web-renderer, ytd-banner-promo-renderer)', // ? full-width section wrapping an ad
      'ytd-search-pyv-renderer', // ✓ promoted video result in search
      'ytd-in-feed-ad-layout-renderer', // ✓ inner layout, defense in depth
      'ytd-promoted-video-renderer', // ✓ legacy promoted result wrapper
      'ytd-compact-promoted-video-renderer', // ? sidebar promoted entry
      'ytd-promoted-sparkles-web-renderer', // ✓ promo "sparkles" card
      'ytd-banner-promo-renderer', // ✓ generic banner promo

      // ── Masthead & home display ads ──────────────────────────────
      '#masthead-ad', // ✓ home top-of-feed banner ad container
      'ytd-display-ad-renderer', // ✓ generic display ad slot

      // ── Watch-page display & companion ads ───────────────────────
      'ytd-companion-slot-renderer', // ✓ companion ad next to the player
      'ytd-action-companion-ad-renderer', // ✓ action-companion variant
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]', // ✓ "Ads" engagement panel in watch sidebar
      '#player-ads', // ✓ container for ads attached to the player

      // ── In-player ad chrome (cosmetic - does NOT skip the ad) ────
      '.video-ads', // ✓ ad slot container inside the player
      '.ytp-ad-module', // ✓ countdown / "Ad" module
      '.ytp-ad-overlay-container', // ✓ in-video banner overlay container
      '.ytp-ad-overlay-slot', // ? overlay slot variant
      '.ytp-ad-text-overlay', // ✓ text-overlay banner
      '.ytp-ad-progress', // ✓ ad progress bar
      '.ytp-ad-progress-list', // ✓ ad progress list
      '.ad-container', // ✓ generic ad-container wrapper
      // "Suggested action" promo badge at the player's bottom-right.
      // Generic class - flagged because YouTube could repurpose this
      // for non-ad prompts (subscribe nudges, captions hints). If a
      // legitimate prompt goes missing, this is the suspect.
      '.ytp-suggested-action', // ! cosmetic promo badge, may overmatch

      // ── Sponsored brand & shopping shelves ───────────────────────
      'ytd-brand-video-shelf-renderer', // ✓ sponsored brand-content shelf
      'ytd-brand-video-singleton-renderer', // ✓ singleton variant (confirmed in fanboy-annoyance)
      // Brand shelves arrive wrapped in a full-width rich-section grid row;
      // hiding only the inner shelf leaves the empty wrapper forcing a row
      // break in the Home grid (a blank band, plus a short row above it
      // when a card in that row is hidden by another toggle).
      'ytd-rich-section-renderer:has(ytd-brand-video-shelf-renderer, ytd-brand-video-singleton-renderer)', // ✓ section wrapper around brand shelf
      // Product lists also catch creator-added affiliate cards - that's
      // acceptable inside an "ads" toggle since both are commercial
      // surfaces, but worth knowing if a user complains.
      'ytd-product-list-renderer', // ? in-description product cards
      'ytd-product-list-item-renderer', // ? individual product card
      '#shopping-timely-shelf', // ? "Shop in this video" shelf

      // ── Premium upsell prompts ───────────────────────────────────
      'yt-mealbar-promo-renderer', // ✓ bottom-left Premium upsell mealbar
      'tp-yt-paper-dialog:has(yt-mealbar-promo-renderer)', // ✓ dialog frame around mealbar

      // ── Universal ad-click tracking anchors ──────────────────────
      // Any anchor pointing at Google's ad-click tracker. Organic
      // content never uses this URL, so this is overmatch-safe.
      'a[href^="https://www.googleadservices.com/pagead/aclk?"]', // ✓ ad-click tracker URLs

      // ── Mobile (m.youtube.com) ad wrappers ──────────────────────
      // The class-based selectors above (.video-ads, .ytp-ad-*,
      // .ytBadgeShape*) and the URL-tracker hook are already cross-
      // platform. Only the ytd- wrappers need ytm- parallels added.
      'ytm-ad-slot-renderer', // ? mobile in-feed ad wrapper
      'ytm-rich-item-renderer:has(ytm-ad-slot-renderer, ytm-display-ad-renderer, ytm-promoted-video-renderer, ytm-promoted-sparkles-web-renderer, ytm-banner-promo-renderer)', // ? mobile grid cell wrapping an ad
      'ytm-rich-section-renderer:has(ytm-brand-video-shelf-renderer)', // ! mobile section wrapper around brand shelf
      'ytm-promoted-video-renderer', // ! mobile promoted result
      'ytm-promoted-sparkles-web-renderer', // ! mobile sparkles promo
      'ytm-display-ad-renderer', // ! mobile display ad
      'ytm-companion-slot-renderer', // ! mobile companion slot
      'ytm-action-companion-ad-renderer', // ! mobile action companion
      'ytm-product-list-renderer', // ! mobile product list
      'ytm-banner-promo-renderer', // ! mobile banner promo
      'ytm-mealbar-promo-renderer', // ! mobile mealbar (Premium upsell)
    ],
  },

  ai: {
    // ─── Hide AI features ───────────────────────────────────────────────
    // Every AI surface outside the watch-page action row (the Ask button
    // there belongs to actionRowMinimal).
    //
    // Summaries: the auto-generated "Summary" rows in the watch-page
    // description and under each search result. Both are an
    // ytd-expandable-metadata-renderer carrying [has-video-summary]; the
    // same renderer without the attribute shows chapters, so the
    // attribute is required. Unscoped because the search rows live
    // outside ytd-watch-flexy.
    //
    // Ask YouTube (conversational search), custom feeds and the "ask
    // for videos" home prompt are US-only at the time of writing; their
    // selectors come from public filter lists and are unverified here.
    hideFeatures: [
      'ytd-watch-flexy #video-summary', // ✓ scoped AI summary block
      'ytd-expandable-metadata-renderer[has-video-summary]', // ✓ watch description + search results
      'yt-video-description-youchat-section-view-model', // ✓ "Ask questions" section in the description
      'ytm-expandable-metadata-renderer:has(.expandableMetadataRendererCollapsedLeftSectionSummary)', // ? mobile summary row (public filter lists)
      // Mobile "Ask questions" slide in the watch-page comments carousel;
      // the comment teaser is a different item type.
      'yt-carousel-item-view-model:has(> yt-text-carousel-item-view-model)', // ? mobile Ask slide
      // Ask YouTube: button inside the search bar, its suggestion panel,
      // and the AI mode chip on search results.
      '.ytSearchboxComponentActions > .ytSearchboxComponentActionsButton[client-ve-type]', // ! Ask button in the search bar
      '.ytSearchboxComponentAiSuggestionsContainer', // ! Ask suggestions under the search bar
      'yt-chip-cloud-chip-renderer[chip-style="STYLE_AI_MODE_CHIP"]', // ! AI mode chip on search results
      // Custom feeds: a prompt-built feed, offered as a chip with a
      // leading sparkle icon at the start of the Home chip bar. Plain
      // topic chips carry no start icon.
      'ytd-feed-filter-chip-bar-renderer yt-chip-cloud-chip-renderer:has(.ytChipShapeStartIconPadding)', // ! custom feed chip
      // "Ask for videos any way you like" prompt on Home.
      'ytd-talk-to-recs-flow-renderer', // ! home prompt
      'ytd-rich-section-renderer:has(ytd-talk-to-recs-flow-renderer)', // ! section wrapper
      'ytd-rich-item-renderer:has(ytd-talk-to-recs-flow-renderer)', // ! grid cell wrapper
    ],
  },

  popups: {
    // ─── Hide YouTube survey / feedback popups ──────────────────────────
    // YouTube renders surveys inside a generic <tp-yt-paper-dialog> wrapped
    // in <ytd-popup-container>. The dialog itself is reused everywhere
    // (menus, share sheets, account switcher), so we must NOT hide the
    // dialog wholesale - only when its content is a survey renderer.
    //
    // Two-layer hide:
    //  1. tp-yt-paper-dialog:has(<survey>) - collapses the dialog frame
    //     entirely so no empty chrome / backdrop lingers.
    //  2. The bare renderer tags as a fallback, in case YouTube ever lifts
    //     the dialog out (or in the rare case :has() is unsupported).
    //
    // Confirmed ✓: ytd-checkbox-survey-renderer (captured from the
    // "Which Premium features are you aware of?" Premium-awareness survey,
    // a multi-checkbox dialog pinned bottom-right).
    //
    // Guesses ! based on YouTube's renderer naming pattern: single-option
    // and feedback variants for surveys that ask one question. These will
    // simply match nothing (silent no-op) if YouTube uses different names.
    hideSurveys: [
      'tp-yt-paper-dialog:has(ytd-checkbox-survey-renderer)', // ✓ multi-checkbox surveys (Premium awareness etc.)
      'tp-yt-paper-dialog:has(ytd-single-option-survey-renderer)', // ! likely single-question variant
      'tp-yt-paper-dialog:has(ytd-feedback-survey-renderer)', // ! likely "How was this experience?" variant
      'ytd-checkbox-survey-renderer', // ✓ bare-renderer fallback
      'ytd-single-option-survey-renderer', // ! bare-renderer fallback
      'ytd-feedback-survey-renderer', // ! bare-renderer fallback
      // Slimline survey: a feed-embedded survey card (not a dialog) that
      // escapes the dialog-anchored hides above. Appears inside the home
      // grid as a thin "How was your experience?" strip.
      'ytd-slimline-survey-renderer', // ✓ bare-renderer
      '.ytSlimlineSurveyViewModelHost', // ✓ view-model host class
      'ytd-rich-item-renderer:has(ytd-slimline-survey-renderer)', // ✓ collapse the grid slot too
      'ytd-rich-item-renderer:has(.ytSlimlineSurveyViewModelHost)', // ✓ grid slot for the view-model variant
      // Mobile - surveys are presented in bottom sheets (tp-yt-paper-
      // dialog is desktop-only). .ytSlimlineSurveyViewModelHost is a
      // shared view-model class so it carries over without a prefix.
      'ytm-checkbox-survey-renderer', // ! mobile multi-checkbox survey
      'ytm-single-option-survey-renderer', // ! mobile single-option survey
      'ytm-feedback-survey-renderer', // ! mobile feedback survey
      'ytm-slimline-survey-renderer', // ! mobile slimline survey
      'ytm-rich-item-renderer:has(ytm-slimline-survey-renderer)', // ! mobile slimline grid slot
      'ytm-rich-item-renderer:has(.ytSlimlineSurveyViewModelHost)', // ! mobile view-model grid slot
    ],
  },
} as const;
