import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { loadSettings } from '@/utils/settings';
import { buildCss } from '@/utils/buildCss';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_start',
  async main() {
    const styleEl = document.createElement('style');
    styleEl.id = 'tubeless';

    let hideLiveChat = false;

    const apply = async () => {
      const settings = await loadSettings();
      hideLiveChat = settings.enabled && settings.watchPage.hideLiveChat;
      styleEl.textContent = buildCss(settings);
    };

    // At document_start, <head> may not exist yet - documentElement always does.
    (document.head ?? document.documentElement).appendChild(styleEl);

    await apply();

    // hideLiveChat's theater fix (see buildCss) releases the chat
    // column's width reservation via CSS, but YouTube sizes the player
    // chrome (progress bar, control row) with inline pixel widths
    // measured when the chat column opened, and only re-measures on
    // window resize. Without a nudge the chrome stays at the reduced
    // width over the full-width video. Fire a resize whenever the
    // reserved state is active so the player re-measures.
    let flexy: Element | null = null;

    const inReservedState = () =>
      flexy != null &&
      flexy.hasAttribute('theater') &&
      flexy.hasAttribute('live-chat-present-and-expanded');

    const nudgeIfReserved = () => {
      if (hideLiveChat && inReservedState()) {
        // Next frame, so YouTube's own layout pass for the state change
        // (and our released width) lands before the re-measure.
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      }
    };

    const watchFlexy = (el: Element) => {
      flexy = el;
      nudgeIfReserved();
      // The resize dispatch doesn't touch these attributes, so this
      // can't feed back into itself.
      new MutationObserver(nudgeIfReserved).observe(el, {
        attributes: true,
        attributeFilter: ['theater', 'live-chat-present-and-expanded'],
      });
    };

    // ytd-watch-flexy doesn't exist at document_start; it's created once
    // and reused across SPA navigations, so find it once and stop looking.
    const existing = document.querySelector('ytd-watch-flexy');
    if (existing) {
      watchFlexy(existing);
    } else {
      const finder = new MutationObserver(() => {
        const el = document.querySelector('ytd-watch-flexy');
        if (el) {
          finder.disconnect();
          watchFlexy(el);
        }
      });
      finder.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && 'settings' in changes) {
        // Re-nudge after the new CSS lands: turning hideLiveChat on
        // while the chat column is reserved releases the width, and the
        // chrome needs the same re-measure as the attribute path.
        apply().then(nudgeIfReserved);
      }
    });
  },
});
