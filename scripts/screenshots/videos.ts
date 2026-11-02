import { HIDDEN_VIDEOS } from './config.ts';

// Page expressions shared by the desktop and simulator captures. Both run
// in the page and return plain data.

// Outermost first: removing an inner card would leave its empty slot.
const CARDS = [
  'ytd-rich-item-renderer',
  'ytm-rich-item-renderer',
  'ytd-reel-item-renderer',
  'ytm-shorts-lockup-view-model-v2',
  'ytm-shorts-lockup-view-model',
  'ytd-compact-video-renderer',
  'ytd-video-renderer',
  'ytm-video-with-context-renderer',
  'ytm-compact-video-renderer',
  'yt-lockup-view-model',
];

const videoId = `(href => {
  const url = new URL(href, location.href);
  return url.searchParams.get('v') ?? url.pathname.match(/^\\/shorts\\/([\\w-]{11})/)?.[1] ?? null;
})`;

const cardOf = `(a => {
  for (const selector of ${JSON.stringify(CARDS)}) {
    const card = a.closest(selector);
    if (card) return card;
  }
  return null;
})`;

// Removes the cards of HIDDEN_VIDEOS.
// The feed grid closes the gap itself; a shelf (the Shorts row) renders
// exactly one row, so the gap is filled from a later shelf of the same
// kind. Returns how many it removed.
export const hideVideos = `(() => {
  const hidden = new Set(${JSON.stringify(HIDDEN_VIDEOS.map((v) => v.id))});
  const unwanted = (a) => hidden.has(${videoId}(a.getAttribute('href')));
  const isUnwanted = (el) => [...el.querySelectorAll('a[href]')].some(unwanted);
  const cards = new Set();
  for (const a of document.querySelectorAll('a[href]')) {
    if (unwanted(a)) {
      const card = ${cardOf}(a);
      if (card) cards.add(card);
    }
  }
  for (const card of cards) {
    if (!card.isConnected) continue;
    const shelf = card.closest('ytd-rich-shelf-renderer');
    const spare = shelf && [...document.querySelectorAll('ytd-rich-shelf-renderer')]
      .filter((s) => s !== shelf && s.hasAttribute('is-shorts') === shelf.hasAttribute('is-shorts')
        && shelf.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)
      .flatMap((s) => [...s.querySelectorAll('ytd-rich-item-renderer')])
      .find((c) => !cards.has(c) && !isUnwanted(c));
    if (spare) {
      spare.toggleAttribute('is-in-first-column', card.hasAttribute('is-in-first-column'));
      card.replaceWith(spare);
    } else {
      card.remove();
    }
  }
  return cards.size;
})()`;

// Whether the screen shows the clutter a "before" shot is for: a full row
// of Shorts and, on the desktop site, an in-feed ad. Signed-out mobile
// YouTube doesn't put ads in the home feed.
export const feedHasClutter = `(() => {
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0;
  };
  if (document.querySelector('ytd-app')) {
    const shelf = [...document.querySelectorAll('ytd-rich-shelf-renderer[is-shorts]')].find(onScreen);
    // A shelf that starts in the bottom strip of the screen shows little more than its heading.
    const full = shelf && shelf.getBoundingClientRect().top < innerHeight * 0.85
      && shelf.querySelectorAll('ytd-rich-item-renderer').length >= Number(shelf.getAttribute('elements-per-row') || 1);
    const ad = [...document.querySelectorAll('ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer')].some(onScreen);
    return !!full && ad;
  }
  return [...document.querySelectorAll('ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model')].filter(onScreen).length >= 2;
})()`;

// Scrolls down and back so the feed loads further shelves, which the
// first Shorts shelf can be filled from.
export const loadMoreShelves = `(async () => {
  for (let i = 0; i < 3; i++) {
    scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 1500));
  }
  scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 1000));
})()`;

// The videos with a card on screen, for reviewing a capture.
export const visibleVideos = `(() => {
  const seen = new Map();
  for (const a of document.querySelectorAll('a[href]')) {
    const id = ${videoId}(a.getAttribute('href'));
    if (!id || seen.has(id) || id === new URL(location.href).searchParams.get('v')) continue;
    const card = ${cardOf}(a);
    const r = (card ?? a).getBoundingClientRect();
    if (r.width === 0 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    const title = (card ?? a).querySelector('#video-title, h3, [title]');
    seen.set(id, (title?.getAttribute('title') || title?.textContent || '').trim().replace(/\\s+/g, ' '));
  }
  return [...seen].map(([id, title]) => id + '  ' + title);
})()`;
