import type { Design, Layer } from './design';
import { placement } from './design';
export const assetUrl = (source: string) => source.startsWith('blob:') ? source : `/api/assets?path=${encodeURIComponent(source)}`;
export async function loadImage(source: string) {
  const image = new Image();
  image.src = assetUrl(source);
  await image.decode();
  return image;
}
function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
// Browser canvases default to 96 DPI. Write PNG pHYs so physical size matches the template.
export async function pngWithDpi(canvas: HTMLCanvasElement, dpi: number): Promise<Blob> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG export failed')), 'image/png'));
  const original = new Uint8Array(await blob.arrayBuffer());
  const chunks: Uint8Array[] = [original.slice(0, 8)];
  const phys = new Uint8Array(21);
  const view = new DataView(phys.buffer);
  view.setUint32(0, 9); phys.set([112, 72, 89, 115], 4);
  const ppm = Math.round(dpi / 0.0254);
  view.setUint32(8, ppm); view.setUint32(12, ppm); phys[16] = 1;
  view.setUint32(17, crc32(phys.subarray(4, 17)));
  for (let offset = 8; offset < original.length;) {
    const length = new DataView(original.buffer).getUint32(offset);
    const type = String.fromCharCode(...original.slice(offset + 4, offset + 8));
    if (type !== 'pHYs') chunks.push(original.slice(offset, offset + length + 12));
    if (type === 'IHDR') chunks.push(phys);
    offset += length + 12;
  }
  return new Blob(chunks as BlobPart[], { type: 'image/png' });
}
export async function renderPrint(design: Design, side: Layer['side'], blank = false) {
  const canvas = document.createElement('canvas');
  canvas.width = design.printWidth; canvas.height = design.printHeight;
  const ctx = canvas.getContext('2d')!;
  if (!blank) for (const layer of design.layers.filter(l => l.side === side)) {
    const image = await loadImage(layer.source);
    const p = placement(layer, canvas.width, canvas.height);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(layer.rotation * Math.PI / 180);
    ctx.drawImage(image, -p.width / 2, -p.height / 2, p.width, p.height); ctx.restore();
  }
  return pngWithDpi(canvas, design.dpi);
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
