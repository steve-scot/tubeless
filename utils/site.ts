// Which YouTube site a tab shows: www.youtube.com or m.youtube.com. iPad
// Safari gets the desktop site and phones the mobile one, unless the user
// asks for the other, so the popup asks the tab rather than guessing from
// the device.
export type Site = 'desktop' | 'mobile';

export const SITE_QUERY = 'tubeless:site';

export const siteOf = (hostname: string): Site =>
  hostname === 'm.youtube.com' ? 'mobile' : 'desktop';
