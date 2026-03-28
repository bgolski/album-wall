# Album Wall Agent Notes

## Purpose and UX flow
- Web app that visualizes a Discogs vinyl collection as a wall of album covers with a pool of overflow items.
- Entry point: `src/app/page.tsx` renders `src/components/VinylWallApp.tsx`.
- User flow: enter Discogs username -> collection fetch -> grid/pool drag-and-drop -> sort/shuffle/pin -> export CSV or image.

## Architecture map (where to look)
- Collection fetch + validation: `src/hooks/useCollection.ts`, `src/utils/discogs.ts`.
- Grid behavior (dimensions, pinning, sorting, shuffle, export): `src/components/grid/RecordGrid.tsx` + hooks in `src/hooks/`.
- Drag/drop logic: `src/utils/dragAndDropHelpers.ts`.
- Album rendering + image proxying/export-safe images: `src/components/album/SortableRecord.tsx`, `src/hooks/useAlbumImage.ts`, `src/utils/imageProxy.ts`.
- Layout shell: `src/components/layout/*`, global styles in `src/app/globals.css`.

## Data flow (high-level)
- `SearchInput` triggers `useCollection.loadCollection`, which calls Discogs API via `getUserCollection`.
- Albums are split into wall grid (`displayedAlbums`) and pool (`poolItems`) based on grid size.
- Pinning prevents drag swaps into pinned positions; shuffle only affects unpinned items.
- Export uses `html2canvas` over the grid ref and hides labels during capture.

## Environment variables
- `NEXT_PUBLIC_DISCOGS_TOKEN` optional but avoids Discogs rate limiting.
- `NEXT_PUBLIC_BASE_PATH` needed for static deployments (GitHub Pages).
- `NEXT_STATIC_EXPORT` controls SSR vs static export in builds.

## Common commands
- Install: `npm install`
- Dev server: `npm run dev` (Next.js + Turbopack)
- Lint: `npm run lint` (or `npm run lint:fix`)
- Typecheck: `npm run type-check`
- Static build: `npm run build:static`, run with `npm run start`
- SSR build: `npm run build:ssr`, run with `npm run start:next`

## Feature readiness criteria
- A feature is only complete when it passes linting (`npm run lint`), typechecks (`npm run type-check`), and the relevant build (`npm run build:static` or `npm run build:ssr`).
- If the change targets deployment mode specifically, validate the matching build and start command.

## Documentation expectations
- Add JSDoc comments to new exported functions, custom hooks, utilities, and non-trivial internal handlers.
- Keep JSDoc concise and behavior-focused: explain intent, important side effects, key params, return values, and invariants when they are not obvious from TypeScript alone.
- Do not add boilerplate JSDoc to trivial presentational code unless the behavior needs extra context.

## Deployment notes
- Static export writes to `out/`; `npm run start` serves it on port 3001.
- SSR uses Next.js server on port 3001.
