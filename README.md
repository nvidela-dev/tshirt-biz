# Press Studio

A simple T-shirt artwork workspace built with Next.js, Vercel, Clerk, Neon Postgres, and private Vercel Blob storage.

## Workflow

1. Set the printer's canvas dimensions and DPI (default: 3600 × 4800 px, 12 × 16 inches at 300 DPI).
2. Download a blank transparent PNG template. Edit it externally without changing its dimensions.
3. Upload PNG, JPEG, or WebP assets individually, or upload the edited template as one layer. To place a full-size edited template exactly, set size to 100%, rotation to 0°, and click Center.
4. Drag, resize, rotate, duplicate, or move artwork between front and back.
5. Export a ZIP with transparent front/back PNGs, unmodified original files, placement data, and print notes.
6. Sign in to upload originals to private storage and save versions in your library. Each save is a new version.

The editor and local export work without an account. Cloud saves require Clerk, Neon, and Blob configuration. Refreshing loses unsaved work.

## Run locally

```sh
npm ci
cp .env.example .env.local
# Fill the credentials for this project's services.
npm run migrate
npm run dev
```

The Clerk CLI can create/link the app and pull its keys. Use a separate Clerk application and Neon project for this app. Do not borrow credentials from another project.

## Vercel setup

Import this GitHub repository as a Next.js project. Connect Neon and a **private** Vercel Blob store. Set the environment variables listed in `.env.example`. Use pooled `DATABASE_URL` for requests and a direct connection for migrations. Run `npm run migrate` before the first cloud save. Use separate Neon branches and Blob stores for preview/production environments, and configure Clerk's production instance and domain before launch.

## How the design works

Neon stores design JSON and Clerk user IDs. Blob stores the original image bytes. Every database read is scoped to the signed-in owner; private artwork is streamed through an owner-checked route. Browser uploads go directly to Blob with short-lived server-authorized tokens, avoiding Vercel request-body limits.

Layer positions are normalized against the print canvas. The preview and export share that coordinate system. The shirt is visual context only. Export composites layers at full print resolution, clips anything outside the print canvas, and writes PNG pHYs metadata for the chosen DPI. The print ZIP includes originals so the printer can adjust files individually.

## Boundaries

- PNG export preserves template pixel dimensions and DPI, not arbitrary PSD/PDF/AI formats. Confirm the provider's required format before production.
- Exports are RGB browser-canvas PNGs, not CMYK separations or a color-managed proof. The shirt preview is approximate.
- Maximum 20 layers, 25 MB per asset, 20,000 px per source side; output up to 6000 × 6000 px. Large exports depend on browser memory.
- DPI metadata does not add detail; effective DPI is shown for the selected artwork.
- Uploads removed from a design remain in private storage. Automatic cleanup, deletion, orders, payments, garment catalogues, and printer integrations are outside this initial version.
- A blank template contains no printed guides. The editor's dashed guides never appear in exports.

## Verification

```sh
npm run lint
npm run build
npm run test:e2e
```
