import { browser } from 'wxt/browser';

export type YouSection = 'full' | 'minimal' | 'hidden';
export type ActionRowMode = 'full' | 'minimal';
export type Theme = 'auto' | 'light' | 'dark';

export type Settings = {
  schemaVersion: 2;
  enabled: boolean;
  sidenav: {
    hideShorts: boolean;
    hideExplore: boolean;
    hideMoreFromYouTube: boolean;
    youSection: YouSection;
  };
  topBar: {
    hideCreate: boolean;
    hideFilterChips: boolean;
    hideNotifications: boolean;
  };
  homeShelves: {
    hideAll: boolean;
    hideGaming: boolean;
    hideEventBanners: boolean;
    hideAlertBanners: boolean;
    hideFeedNudges: boolean;
  };
  contentTypes: {
    hideShorts: boolean;
    hideMovies: boolean;
    hidePosts: boolean;
    hideMixes: boolean;
    hideCollections: boolean;
    hideLive: boolean;
    hideMusic: boolean;
    hideMembersOnly: boolean;
    hidePremieres: boolean;
  };
  watchPage: {
    actionRow: ActionRowMode;
    hideMerch: boolean;
    hideLiveChat: boolean;
    // Drives the "Hide AI features" toggle, which covers every AI surface,
    // not only the watch page. Renaming the key would need a migration.
    hideAISummary: boolean;
    hideFundraiser: boolean;
    hideEndScreenCards: boolean;
    hideDescription: boolean;
    hideComments: boolean;
    hideRecommendations: boolean;
    hideInfoPanels: boolean;
  };
  ads: {
    hideAll: boolean;
  };
  popups: {
    hideSurveys: boolean;
  };
  appearance: {
    theme: Theme;
  };
};

export const DEFAULTS: Settings = {
  schemaVersion: 2,
  enabled: true,
  sidenav: {
    hideShorts: true,
    hideExplore: true,
    hideMoreFromYouTube: true,
    youSection: 'full',
  },
  topBar: {
    hideCreate: true,
    hideFilterChips: true,
    hideNotifications: false,
  },
  homeShelves: {
    hideAll: true,
    hideGaming: true,
    hideEventBanners: true,
    hideAlertBanners: true,
    hideFeedNudges: true,
  },
  contentTypes: {
    hideShorts: true,
    hideMovies: false,
    hidePosts: true,
    hideMixes: true,
    hideCollections: false,
    hideLive: false,
    hideMusic: false,
    hideMembersOnly: false,
    hidePremieres: false,
  },
  watchPage: {
    actionRow: 'minimal',
    hideMerch: true,
    hideLiveChat: false,
    hideAISummary: true,
    hideFundraiser: false,
    hideEndScreenCards: true,
    hideDescription: false,
    hideComments: false,
    hideRecommendations: false,
    hideInfoPanels: false,
  },
  ads: {
    hideAll: true,
  },
  popups: {
    hideSurveys: true,
  },
  appearance: {
    theme: 'auto',
  },
};

// V1 shape kept locally for migration. Anything stored before schemaVersion 2
// will arrive in this layout. Keys are optional because partial writes were
// possible in v1.
type V1Settings = {
  schemaVersion?: 1;
  sidenav?: {
    hideShorts?: boolean;
    hideExplore?: boolean;
    hideMoreFromYouTube?: boolean;
    youSection?: YouSection;
  };
  feeds?: {
    hideShelves?: boolean;
    hideShorts?: boolean;
    hideGames?: boolean;
    hideEventBanners?: boolean;
    hideMovies?: boolean;
    hideMembersOnly?: boolean;
    hidePremieres?: boolean;
    hidePosts?: boolean;
    hideFilterChips?: boolean;
    hideMixes?: boolean;
    hideCollections?: boolean;
    hideLive?: boolean;
    hideMusic?: boolean;
  };
  masthead?: { hideCreate?: boolean };
  // Stored watchPage may include legacy keys (hideAskButton was a boolean
  // before v1.0.3 collapsed it into the actionRow segmented control).
  watchPage?: Partial<Settings['watchPage']> & { hideAskButton?: boolean };
  appearance?: Partial<Settings['appearance']>;
};

// Translate the legacy hideAskButton boolean into actionRow if the user's
// stored settings predate the rename. Used by both the v2 and v1 branches.
function migrateActionRow(
  stored: { actionRow?: ActionRowMode; hideAskButton?: boolean } | undefined,
): ActionRowMode {
  if (stored?.actionRow) return stored.actionRow;
  if (stored?.hideAskButton === true) return 'minimal';
  if (stored?.hideAskButton === false) return 'full';
  return DEFAULTS.watchPage.actionRow;
}

export function mergeWithDefaults(stored: unknown): Settings {
  if (!stored || typeof stored !== 'object') return structuredClone(DEFAULTS);

  const s = stored as Partial<Settings>;

  if (s.schemaVersion === 2) {
    return {
      schemaVersion: 2,
      enabled: s.enabled ?? DEFAULTS.enabled,
      sidenav: { ...DEFAULTS.sidenav, ...s.sidenav },
      topBar: { ...DEFAULTS.topBar, ...s.topBar },
      homeShelves: { ...DEFAULTS.homeShelves, ...s.homeShelves },
      contentTypes: { ...DEFAULTS.contentTypes, ...s.contentTypes },
      watchPage: {
        ...DEFAULTS.watchPage,
        ...s.watchPage,
        actionRow: migrateActionRow(
          s.watchPage as { actionRow?: ActionRowMode; hideAskButton?: boolean },
        ),
      },
      ads: { ...DEFAULTS.ads, ...s.ads },
      popups: { ...DEFAULTS.popups, ...s.popups },
      appearance: { ...DEFAULTS.appearance, ...s.appearance },
    };
  }

  // Treat anything without schemaVersion 2 as v1 (covers schemaVersion: 1
  // and missing-version writes from earlier dev builds).
  const v1 = stored as V1Settings;
  return {
    schemaVersion: 2,
    enabled: DEFAULTS.enabled,
    sidenav: { ...DEFAULTS.sidenav, ...v1.sidenav },
    topBar: {
      hideCreate: v1.masthead?.hideCreate ?? DEFAULTS.topBar.hideCreate,
      hideFilterChips:
        v1.feeds?.hideFilterChips ?? DEFAULTS.topBar.hideFilterChips,
      hideNotifications: DEFAULTS.topBar.hideNotifications,
    },
    homeShelves: {
      hideAll: v1.feeds?.hideShelves ?? DEFAULTS.homeShelves.hideAll,
      hideGaming: v1.feeds?.hideGames ?? DEFAULTS.homeShelves.hideGaming,
      hideEventBanners:
        v1.feeds?.hideEventBanners ?? DEFAULTS.homeShelves.hideEventBanners,
      // hideAlertBanners and hideFeedNudges didn't exist in v1.
      hideAlertBanners: DEFAULTS.homeShelves.hideAlertBanners,
      hideFeedNudges: DEFAULTS.homeShelves.hideFeedNudges,
    },
    contentTypes: {
      hideShorts: v1.feeds?.hideShorts ?? DEFAULTS.contentTypes.hideShorts,
      hideMovies: v1.feeds?.hideMovies ?? DEFAULTS.contentTypes.hideMovies,
      hidePosts: v1.feeds?.hidePosts ?? DEFAULTS.contentTypes.hidePosts,
      hideMixes: v1.feeds?.hideMixes ?? DEFAULTS.contentTypes.hideMixes,
      hideCollections:
        v1.feeds?.hideCollections ?? DEFAULTS.contentTypes.hideCollections,
      hideLive: v1.feeds?.hideLive ?? DEFAULTS.contentTypes.hideLive,
      hideMusic: v1.feeds?.hideMusic ?? DEFAULTS.contentTypes.hideMusic,
      hideMembersOnly:
        v1.feeds?.hideMembersOnly ?? DEFAULTS.contentTypes.hideMembersOnly,
      hidePremieres:
        v1.feeds?.hidePremieres ?? DEFAULTS.contentTypes.hidePremieres,
    },
    watchPage: {
      ...DEFAULTS.watchPage,
      ...v1.watchPage,
      actionRow: migrateActionRow(v1.watchPage),
    },
    // ads didn't exist in v1 - fall through to defaults.
    ads: { ...DEFAULTS.ads },
    // popups didn't exist in v1 - fall through to defaults.
    popups: { ...DEFAULTS.popups },
    appearance: { ...DEFAULTS.appearance, ...v1.appearance },
  };
}

export async function loadSettings(): Promise<Settings> {
  const { settings } = await browser.storage.sync.get('settings');
  return mergeWithDefaults(settings);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.sync.set({ settings });
}
