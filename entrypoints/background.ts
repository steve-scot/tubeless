import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';

// On Firefox-for-Android the default_popup overlay is reachable only via the
// Add-ons menu - there's no toolbar icon to click. Stripping the popup and
// handling onClicked instead lets the action open the same UI in a normal tab,
// which is debuggable with standard devtools and feels native on mobile.
//
// Desktop is untouched: getPlatformInfo().os is not 'android', the popup stays
// configured, and the click is consumed by the popup before onClicked fires.
export default defineBackground(() => {
  browser.runtime.getPlatformInfo().then(({ os }) => {
    if (os === 'android') {
      browser.action.setPopup({ popup: '' });
    }
  });

  browser.action.onClicked.addListener(() => {
    browser.tabs.create({ url: browser.runtime.getURL('/popup.html') });
  });
});
