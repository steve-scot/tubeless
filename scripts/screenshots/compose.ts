import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { OUTPUTS, WINDOW, canvasOf, type Device, type Scene } from './config.ts';
import type { CaptureMeta } from './capture.ts';

const TEMPLATE = pathToFileURL(path.join(import.meta.dirname, 'template.html')).href;

type SceneData = { page: string; popup?: string } & Partial<CaptureMeta['home']>;

function loadScenes(device: Device, dir: string): Record<Scene, SceneData> {
  const file = (name: string) => pathToFileURL(path.join(dir, `${name}.png`)).href;
  // Simulator captures are whole screens, popup included.
  if (device !== 'desktop') {
    const scenes: Scene[] = ['home-before', 'home-after', 'watch-before', 'watch-after', 'popup'];
    return Object.fromEntries(scenes.map((scene) => [scene, { page: file(scene) }])) as Record<Scene, SceneData>;
  }
  const meta: CaptureMeta = JSON.parse(readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  return {
    'home-before': { page: file('home-before'), ...meta.home },
    'home-after': { page: file('home-after'), ...meta.home },
    'watch-before': { page: file('watch-before'), ...meta.watch },
    'watch-after': { page: file('watch-after'), ...meta.watch },
    popup: { page: file('watch-after'), popup: file('popup'), ...meta.watch },
  };
}

export async function compose(opts: {
  captures: string;
  devices: Device[];
  icon: string;
  root: string;
}): Promise<void> {
  const icon = readFileSync(opts.icon, 'utf8').replace('<svg ', '<svg width="16" height="16" ');
  const scenes = Object.fromEntries(
    opts.devices.map((device) => [device, loadScenes(device, path.join(opts.captures, device))]),
  ) as Record<Device, Record<Scene, SceneData>>;

  const browser = await chromium.launch();
  try {
    for (const output of OUTPUTS.filter((o) => opts.devices.includes(o.device))) {
      console.log(`  ${output.name}`);
      const bare = output.backdrop === false;
      const canvas = bare ? { width: WINDOW.width, height: WINDOW.height } : canvasOf(output.device);
      const win = bare ? { ...WINDOW, x: 0, y: 0 } : WINDOW;
      const page = await browser.newPage({
        viewport: canvas,
        deviceScaleFactor: output.width / canvas.width,
      });
      await page.goto(TEMPLATE);
      const dir = path.join(opts.root, output.dir);
      mkdirSync(dir, { recursive: true });

      for (const [scene, name] of Object.entries(output.files) as [Scene, string][]) {
        await page.evaluate((data) => (window as any).render(data), {
          ...scenes[output.device][scene],
          frame: output.frame,
          icon,
          canvas,
          win,
          backdrop: !bare,
        });
        const png = await page.screenshot({ omitBackground: bare });
        const target = path.join(dir, `${name}.${output.format}`);
        writeFileSync(target, output.format === 'webp' ? await toWebp(page, png) : png);
        console.log(`    ${path.relative(opts.root, target)}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function toWebp(page: import('playwright').Page, png: Buffer): Promise<Buffer> {
  const dataUrl = await page.evaluate(async (b64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }, png.toString('base64'));
  return Buffer.from(dataUrl.split(',')[1]!, 'base64');
}
