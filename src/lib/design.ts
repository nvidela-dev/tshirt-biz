import { z } from 'zod';
export const layerSchema = z.object({
  id: z.string().uuid(), name: z.string().min(1).max(150), source: z.string().max(2000),
  side: z.enum(['front', 'back']), x: z.number().min(-1).max(2), y: z.number().min(-1).max(2),
  width: z.number().min(0.01).max(2), aspect: z.number().positive().max(100),
  rotation: z.number().min(-180).max(180), pixelWidth: z.number().int().positive().max(20000),
});
export const designSchema = z.object({
  name: z.string().trim().min(1).max(100), color: z.enum(['cream', 'black', 'sage']),
  printWidth: z.number().int().min(300).max(6000), printHeight: z.number().int().min(300).max(6000),
  dpi: z.number().int().min(72).max(600), layers: z.array(layerSchema).max(20),
});
export type Layer = z.infer<typeof layerSchema>;
export type Design = z.infer<typeof designSchema>;
export type SavedDesign = { id: string; name: string; updated_at: string };
export const initialDesign: Design = { name: 'Untitled design', color: 'cream', printWidth: 3600, printHeight: 4800, dpi: 300, layers: [] };
// All coordinates are normalized against the PRINT canvas, never the shirt mockup.
export function placement(layer: Layer, width: number, height: number) {
  return { x: layer.x * width, y: layer.y * height, width: layer.width * width, height: layer.width * width / layer.aspect };
}
