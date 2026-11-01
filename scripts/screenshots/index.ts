// Captures live YouTube with Tubeless installed, then composes the store
// and README screenshots from those captures.
//
//   npm run screenshots                     capture and compose
//   npm run screenshots -- --compose-only   recompose from the last capture
//   npm run screenshots -- --device iphone  only this device (repeatable):
//                                           desktop, iphone, iphone-large
//                                           or ipad
//
// Desktop runs in Chromium with the Chrome build. First run:
// `npx playwright install chromium`.
//
// iPhone and iPad run Safari in the iOS Simulator with the Safari app
// installed, which needs Xcode and an iOS simulator runtime.

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { capture } from './capture.ts';
import { compose } from './compose.ts';
import { SIMULATORS, type Device, type Simulator } from './config.ts';
import { captureSimulators } from './simulator.ts';

const { values } = parseArgs({
  options: {
    'compose-only': { type: 'boolean', default: false },
    device: { type: 'string', multiple: true },
  },
});

const all: Device[] = ['desktop', ...(Object.keys(SIMULATORS) as Simulator[])];
const devices = (values.device ?? all) as Device[];
for (const device of devices) {
  if (!all.includes(device)) throw new Error(`Unknown device "${device}". Use one of: ${all.join(', ')}.`);
}
const simulators = devices.filter((d): d is Simulator => d !== 'desktop');

const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, '.output/screenshots');
const captures = path.join(output, 'captures');
const derivedData = path.join(output, 'xcode');
const products = path.join(derivedData, 'Build/Products');
const sh = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });

if (!values['compose-only']) {
  console.log('Building');
  if (devices.includes('desktop')) sh('npx', ['wxt', 'build', '--browser', 'chrome']);
  if (simulators.length) {
    sh('npx', ['wxt', 'build', '--browser', 'safari']);
    const xcode = ['-destination', 'generic/platform=iOS Simulator', '-derivedDataPath', derivedData, '-quiet'];
    sh('xcodebuild', ['build', '-project', 'safari/Tubeless/Tubeless.xcodeproj', '-scheme', 'Tubeless (iOS)',
      '-configuration', 'Debug', ...xcode]);
    sh('xcodebuild', ['build-for-testing', '-project', 'scripts/screenshots/ios/Driver.xcodeproj', '-scheme', 'Driver',
      ...xcode]);
  }

  console.log('Capturing');
  const xctestrun = readdirSync(products).find((f) => f.endsWith('.xctestrun'));
  const results = await Promise.allSettled([
    devices.includes('desktop') && capture({ extension: path.join(output, '../chrome-mv3'), out: path.join(captures, 'desktop') }),
    simulators.length &&
      captureSimulators({
        app: path.join(products, 'Debug-iphonesimulator/Tubeless.app'),
        xctestrun: path.join(products, xctestrun!),
        out: captures,
        devices: simulators,
      }),
  ]);
  const failures = results.flatMap((r) => (r.status === 'rejected' ? [r.reason] : []));
  if (failures.length) throw new AggregateError(failures, failures.map(String).join('\n'));
}

console.log('Composing');
await compose({ captures, devices, icon: path.join(root, 'assets/icon.svg'), root });
