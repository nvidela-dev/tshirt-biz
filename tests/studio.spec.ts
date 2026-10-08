import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';

test('individual artwork, placement, PNG dimensions/DPI, print clipping and original handoff', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make it your own.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible({ timeout: 15000 });
  const sample = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 120; c.height = 120;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#f04020'; ctx.fillRect(0, 0, 120, 120);
    return c.toDataURL().split(',')[1];
  });
  const original = Buffer.from(sample, 'base64');
  await page.locator('input[type=file]').setInputFiles({ name: 'red-square.png', mimeType: 'image/png', buffer: original });
  await expect(page.getByRole('heading', { name: 'Fine-tune placement' })).toBeVisible();
  await page.locator('summary').click();
  await page.getByLabel('Width (px)').fill('300');
  await page.getByLabel('Height (px)').fill('400');
  await page.getByRole('button', { name: 'Center', exact: true }).click();
  const box = await page.locator('.artwork').boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down(); await page.mouse.move(box!.x + box!.width / 2 + 15, box!.y + box!.height / 2 + 10); await page.mouse.up();
  const position = await page.locator('.artwork').getAttribute('style'); expect(position).not.toContain('left: 50%; top: 50%');
  await page.getByRole('button', { name: 'Center', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.locator('.artwork')).toHaveCount(2);
  await page.getByLabel('Print side', { exact: true }).selectOption('back');
  await expect(page.locator('.artwork')).toHaveCount(1);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export print pack' }).click();
  const file = await pending; const zip = await JSZip.loadAsync(await readFile((await file.path())!));
  expect(Object.keys(zip.files)).toContain('front-print.png'); expect(Object.keys(zip.files)).toContain('back-print.png');
  const sources = Object.keys(zip.files).filter(p => p.startsWith('originals/') && !zip.files[p].dir);
  expect(sources).toHaveLength(2);
  expect(await zip.file(sources[0])!.async('nodebuffer')).toEqual(original);
  const png = await zip.file('front-print.png')!.async('nodebuffer');
  expect(png.readUInt32BE(16)).toBe(300); expect(png.readUInt32BE(20)).toBe(400);
  const phys = png.indexOf(Buffer.from('pHYs')); expect(phys).toBeGreaterThan(0); expect(png.readUInt32BE(phys + 4)).toBe(11811);
  const colors = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext('2d')!; ctx.drawImage(bitmap, 0, 0);
    return { corner: Array.from(ctx.getImageData(0, 0, 1, 1).data), center: Array.from(ctx.getImageData(150, 200, 1, 1).data) };
  }, Array.from(png));
  expect(colors.corner[3]).toBe(0); expect(colors.center).toEqual([240, 64, 32, 255]);
  await page.screenshot({ path: 'test-results/studio-desktop.png', fullPage: true });
});

test('unauthenticated design and artwork requests are rejected; mobile workspace fits', async ({ page, request }) => {
  expect((await request.get('/api/designs')).status()).toBe(401);
  expect((await request.post('/api/designs', { data: {} })).status()).toBe(401);
  expect((await request.get('/api/assets?path=artwork/someone/secret.png')).status()).toBe(401);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Make it your own.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible({ timeout: 15000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/studio-mobile.png', fullPage: true });
});
