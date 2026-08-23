import { loadSettings, saveSettings, type Settings, type Theme } from '@/utils/settings';

type Path = string;

function getNested(obj: unknown, path: Path): unknown {
  return path.split('.').reduce<unknown>((o, k) => {
    if (o && typeof o === 'object') return (o as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

function setNested(obj: Settings, path: Path, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce<Record<string, unknown>>(
    (o, k) => o[k] as Record<string, unknown>,
    obj as unknown as Record<string, unknown>,
  );
  target[last] = value;
}

function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  if (theme === 'auto') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme);
  }
}

function applyPowerState(enabled: boolean): void {
  const popup = document.querySelector<HTMLElement>('.popup');
  popup?.classList.toggle('is-paused', !enabled);
  const label = document.querySelector<HTMLElement>('.row-power .row-label');
  if (label) label.textContent = enabled ? 'Tubeless is on' : 'Tubeless is paused';
}

function bindCheckboxesAndSelects(settings: Settings): void {
  const controls = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
    '[data-key]',
  );

  controls.forEach((el) => {
    const key = el.dataset.key!;
    const value = getNested(settings, key);

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      el.checked = !!value;
    } else if (el instanceof HTMLSelectElement) {
      el.value = String(value);
    }

    el.addEventListener('change', async () => {
      const current = await loadSettings();
      const newValue =
        el instanceof HTMLInputElement && el.type === 'checkbox'
          ? el.checked
          : el.value;
      setNested(current, key, newValue);
      await saveSettings(current);
      if (key === 'enabled') applyPowerState(!!newValue);
    });
  });
}

function bindSegmentedControls(settings: Settings): void {
  const groups = document.querySelectorAll<HTMLElement>('[data-segmented-key]');

  groups.forEach((group) => {
    const key = group.dataset.segmentedKey!;
    const currentValue = String(getNested(settings, key) ?? '');
    const buttons = group.querySelectorAll<HTMLButtonElement>('.segment');

    buttons.forEach((btn) => {
      btn.setAttribute(
        'aria-pressed',
        btn.dataset.value === currentValue ? 'true' : 'false',
      );
    });

    buttons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const newValue = btn.dataset.value!;

        buttons.forEach((b) =>
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'),
        );

        const current = await loadSettings();
        setNested(current, key, newValue);
        await saveSettings(current);

        if (key === 'appearance.theme') {
          applyTheme(newValue as Theme);
        }
      });
    });
  });
}

// Grey out child rows whose selectors are fully covered by an active
// master toggle (data-master / data-disabled-by pairs in the markup).
// The child setting is preserved, just redundant while the master is on.
function wireMasters(): void {
  const masterRows = document.querySelectorAll<HTMLElement>('[data-master]');

  masterRows.forEach((row) => {
    const masterKey = row.dataset.master!;
    const masterInput = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!masterInput) return;

    const children = document.querySelectorAll<HTMLElement>(
      `[data-disabled-by="${masterKey}"]`,
    );

    const sync = (): void => {
      const disabled = masterInput.checked;
      children.forEach((child) => {
        const childInput = child.querySelector<HTMLInputElement>(
          'input[type="checkbox"]',
        );
        if (childInput) childInput.disabled = disabled;
        child.classList.toggle('row-disabled', disabled);
      });
    };

    sync();
    masterInput.addEventListener('change', sync);
  });
}

function showVersion(): void {
  const slot = document.getElementById('version');
  if (!slot) return;
  const manifest = browser.runtime.getManifest();
  slot.textContent = `v${manifest.version_name ?? manifest.version}`;
}

async function init(): Promise<void> {
  const settings = await loadSettings();

  applyTheme(settings.appearance.theme);
  applyPowerState(settings.enabled);

  bindCheckboxesAndSelects(settings);
  bindSegmentedControls(settings);
  wireMasters();
  showVersion();
}

init();
