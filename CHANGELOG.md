# Changelog

All notable changes to Tubeless are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
(2.0.0 is a significance major: ad blocking is additive, not breaking.)

## 2.4.0 - 2026-09-28

### Added

- **Hide AI summary**, renamed **Hide AI summaries**, now also hides the AI
  "Summary" rows under search results and the "Ask questions" section in a
  video's description.

- **Hide live streams** and **Hide Mixes** now also cover search results,
  and **Hide playlists & podcasts** covers the newer search result cards.

### Fixed

- **Hide Mixes no longer hides ordinary videos.** YouTube now links many
  music and long-form videos with a Mix-style URL, so the toggle was hiding
  plain videos from Home. It now matches only cards with the stacked Mix
  thumbnail.

- **Hide live streams no longer hides uploads from a channel that is live.**
  The channel avatar's live ring marks the channel, not the video, so every
  video from a streaming channel was hidden. Only the thumbnail's LIVE badge
  counts now.

- **Hide member-only videos no longer hides fundraiser videos.** Both badges
  share a style; only the members badge carries an icon, which is now
  required.

- **Hide comments** and **Hide recommendations** work again on mobile
  YouTube, which had replaced both elements.

## 2.3.0 - 2026-08-23

First release from the public repository.

### Added

- **Hide gaming shelves** now also hides the YouTube Playables (mini-games)
  shelf. Its header says "YouTube Playables" so the existing title matches
  missed it; it's matched by its `/playables` header link instead, which is
  also locale-independent.

- The popup greys out the **Hide gaming shelves** toggle while **Hide all
  shelves** is on, since the master already hides everything it covers. The
  stored setting is untouched and comes back when the master is turned off.

### Fixed

- **Shelf-level hides no longer leave a blank band in the feed.** Home and
  Subscriptions nest shelves inside a full-width section wrapper; hiding only
  the inner shelf left the empty wrapper forcing a row break (and a short row
  above it when a card in that row was hidden by another toggle). Every
  shelf-level hide - Shorts, gaming, event banners, movies & shows, community
  posts, sponsored brand shelves - now hides the wrapper too, with mobile
  equivalents.

- **Hide community posts** no longer leaves a blank grid cell where an inline
  post sat in the Home grid.

- **Hide surveys** no longer leaves a blank slot where a survey card sat in a
  feed row or shelf (the newer view-model survey variant wasn't collapsing
  its grid slot).

- **Hide ads** grid-cell matching broadened to cover every in-feed ad
  renderer, not just the generic ad slot, in case YouTube ships one into a
  grid cell without the ad-slot wrapper.

## 2.2.3 - 2026-08-17

### Changed

- **Popup dark theme** switched from the warm walnut palette to a neutral
  charcoal. The tomato accent and light mode are unchanged.

- **Popup text sizes** increased for legibility: row labels and body
  13 → 13.5px, hint text 10.5 → 12.5px, section titles and the footer
  version 10 → 11.5px, selects 12 → 13px, segmented buttons 11.5 → 12.5px.

- **Popup contrast raised to WCAG AA** in both themes: muted text now meets
  4.5:1 against its worst-case backgrounds, and the dark off-state toggle
  track was lightened so it reads against the elevated rows.

- The **Hide member-only videos** row now carries a hint: on channels you've
  joined it also hides member videos you can actually watch, because the
  badge marks the video's restriction, not the viewer's access.

- **Default settings tuned** (fresh installs only; existing users' stored
  choices are untouched): the sidebar "You" section defaults to Full (was
  Minimal), the notifications bell is no longer hidden by default, Hide
  movies & shows defaults off, and Hide Mixes defaults on.

### Fixed

- **Hide ads** no longer leaves blank cells in the Home grid. Newer feed
  templates wrap in-feed ads inside an ordinary `ytd-rich-item-renderer`
  grid cell, which is now hidden along with the inner ad slot.

- **Hide member-only videos** now also matches the `badge-shape-wiz--commerce`
  variant of the members badge. YouTube ships two class systems for the same
  badge; only the `ytBadgeShapeCommerce` view-model class was covered.

- **Hide live chat** now also hides the "Live chat" / "Live chat replay →
  Open panel" teaser under the video title, and in theater mode releases the
  player width YouTube reserves for an expanded chat, nudging a re-measure
  so the player controls repaint at full width. Also fixes live streams
  opened in theater mode, where chat starts expanded.

- **Hide recommendations sidebar** no longer leaves a blank sidebar column on
  premieres and stream VODs with chat replay, which ship a collapsed,
  invisible `ytd-live-chat-frame`. The keep-the-column-for-live-chat guard
  now fires only when the chat frame is actually expanded.

- On channel pages, the "Hide all shelves" exemption no longer overrides the
  independent content-type toggles (a Shorts shelf on a channel's home tab
  stayed visible despite Hide Shorts). Channel pages are now excluded inside
  the hide selector itself rather than by a higher-specificity revert rule.

## 2.1.1 - 2026-06-08

### Fixed

- Popup: the **Hide ads** and **Hide survey popups** hints rendered inline
  with their toggle labels instead of wrapping to their own muted line.
  Added the missing base hint style so help text is consistent across every
  toggle.

## 2.1.0 - 2026-06-08

### Added

- **Chrome / Chromium support.** The extension now builds for Chrome in
  addition to Firefox (`npm run zip:chrome`). No change to behaviour.

### Changed

- Extension icons are now rasterized to PNG at build time from a single
  source SVG. Chrome rejects SVG manifest icons.

## 2.0.0 - 2026-06-08

### Added

- **Ad & sponsored-content blocking** (`Block ads`). Hides ads across YouTube
  surfaces: in-feed sponsored slots, the masthead/home banner ad, watch-page
  display & companion ads, in-player ad chrome, sponsored brand & shopping
  shelves, Premium upsell mealbars, and ad-click tracking anchors.

## 1.3.0 - 2026-05-30

### Added

- **Popup & survey blocking** (`Hide surveys`). New category covering YouTube's
  intercept surveys and survey-style prompts.

## 1.2.0 - 2026-05-22

### Added

- Watch page: hide the AI-generated summary, the fundraiser/donation panel, and
  live chat.
- Feeds: hide thin alert-style notification banners above the home feed.

## 1.1.1 - 2026-05-12

### Fixed

- Restored access to the Subscribe / Unsubscribe and notification controls on
  watch pages. Minimal action-row mode hid the notification bell, but on
  current YouTube that control is the whole "Subscribed" button once you
  subscribe, and its menu is the only path to unsubscribe. Minimal mode now
  leaves the subscribe control untouched.

## 1.1.0 - 2026-05-06

### Added

- Top bar: toggle to hide the notifications bell in the masthead.
- Watch page: toggle to hide the video description panel.

## 1.0.3 - 2026-05-04

### Changed

- Replaced the single "Hide Ask button" toggle with a Full / Minimal action-row
  control on watch pages. Minimal keeps Subscribe, Like/Dislike and Save, and
  trims Join, the Ask entrypoint, Share, and the overflow menu. Existing users
  who had "Hide Ask button" enabled are migrated to Minimal.

## 1.0.2 - 2026-05-03

### Added

- Feeds: hide feed nudges (sign-in / engagement prompts).
- Watch page: hide info panels.

## 1.0.1 - 2026-05-03

### Fixed

- Selector reliability fixes for YouTube markup changes.

## 1.0.0 - 2026-05-03

### Added

- Global pause switch: turn the whole extension off and get plain YouTube back
  with one toggle.

First stable release.

## 0.1.1 - 2026-05-02

### Removed

- Dropped the experimental "expand description" toggle.

## 0.1.0 - 2026-05-02

### Added

- Initial release. CSS-only hiding for Shorts, recommended-game shelves, event
  banners, in-feed sponsored slots, end-screen cards, and assorted feed clutter,
  each an independent toggle in the popup.
