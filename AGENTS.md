# Album Wall Agent Notes

## Purpose and UX flow
- Web app that shows a Discogs vinyl collection (or the built-in demo) as a wall of album covers, with the rest of the collection in a pool beside it, and helps plan which records to hang.
- Entry point: `src/app/page.tsx` renders `src/components/AlbumWallApp.tsx`.
- User flow: enter a Discogs username, sign in with Discogs, or open the demo -> the collection loads -> arrange the wall by hand (drag, tap to move, pin, shuffle) or build it with Arrange (artist, genre, year or color) -> save layouts, record a hang and get the steps to rehang -> save an image, poster or PDF guide, or share a link.

## Architecture map (where to look)
- App shell and wiring: `src/components/AlbumWallApp.tsx`, `src/components/collection/CollectionManager.tsx`, `src/components/grid/RecordGrid.tsx` (the wall, pool and panels), `src/components/layout/*`, global styles in `src/app/globals.css`.
- Code layout: React components in `src/components/`, hooks in `src/hooks/`, and the logic they use in topic folders: `src/color/`, `src/arrange/`, `src/wall/`, `src/collection/`, `src/account/`, `src/share/`, `src/export/` and `src/covers/`. `src/utils/` holds only generic browser helpers (base path, storage, clipboard, downloads, errors). New logic goes in the topic folder it belongs to, with its test beside it.
- Loading a collection: `src/hooks/useCollection.ts`, `src/collection/discogs.ts` (proxy and CloudFront cache), `collectionCache.ts` (copy kept in the browser), `demoCollection.ts`, `loadAddress.ts` (`?user=`), `filterAlbums.ts` (pool search), `uniqueAlbumIds.ts`, `groupPressings.ts` with `src/hooks/usePressings.ts` (one copy per album).
- Moving records by hand: `src/hooks/useWallDrag.ts` with `src/wall/dragAndDropHelpers.ts` (dnd-kit), `src/hooks/useMoveMode.ts` (tap to move), `src/hooks/useAlbumPinning.ts`, `src/hooks/useAlbumShuffle.ts`, `src/hooks/useWallResize.ts`, undo in `src/hooks/useUndoHistory.ts`.
- Arrange by artist, genre or year: panel in `src/components/arrange/`, `src/hooks/useGroupBuilder.ts`, `src/arrange/groupModes.ts` (the modes) and `buildGroupWall.ts`.
- Arrange by color: panel in `src/components/gradient/`, `src/hooks/useGradientBuilder.ts`, run off the main thread by `src/workers/gradient.worker.ts` through `src/arrange/gradientJobs.ts` and `gradientWork.ts`. In `src/arrange/`: `buildGradientWall.ts`, `suggestGradients.ts`, and the matching in `arrangeGradientWall.ts`, `gradientTargets.ts`, `gradientFit.ts` (3 x 3 region fit), `neighbourFit.ts` (seams between covers), `assignByCost.ts` and `hungarian.ts`.
- Cover colors (`src/color/`): `readCoverProfile.ts` measures a small copy of a cover; `coverProfile.ts`, `profileShape.ts`, `colorBasics.ts` (OKLab) and `colorName.ts` describe colors; `colorCache.ts` keeps them in the browser and `sharedProfiles.ts` shares them through the cover-profiles Lambda; `src/hooks/useCoverColors.ts` ties it together.
- Cover images: `src/covers/` (`coverSource.ts`, `imageProxy.ts`, `imageSourcePolicy.ts`), `src/hooks/useAlbumImage.ts`, rendered by `src/components/album/SortableRecord.tsx`.
- The wall, saved layouts and hanging (`src/wall/`): `albumKey.ts`, `wallSize.ts`, `sameWall.ts`, `savedWall.ts` (the wall remembered on this device), `layoutStore.ts` with `src/hooks/useLayouts.ts`, `hangHistory.ts` with `src/hooks/useHangHistory.ts`, steps between walls in `diffWalls.ts`, `wallSteps.ts`, `rehangSteps.ts`, `rehangText.ts`, `hangChanges.ts`; UI in `src/components/layouts/`.
- Signing in and the account copy: `src/account/` (`discogsSignIn.ts`, `savedWalls.ts`), `src/hooks/useDiscogsSignIn.ts`, `src/hooks/useDiscogsFolders.ts`, `src/hooks/useAccountSync.ts`.
- Images, posters and guides (`src/export/`): `src/hooks/useGridExport.ts` draws the wall itself on a canvas (`drawWall.ts`, `exportFrame.ts`, `recordBackground.ts`); posters come from the poster Lambda (`posterService.ts`, `posterLayout.ts`); the printable guide is `guide.ts`, `guideLayout.ts` and `pdf.ts`.
- Sharing (`src/share/`): `shareState.ts` (wall state in the address hash), `shortLink.ts` (short links stored by the proxy), `src/hooks/useShareLinks.ts`.
- Offline: `public/sw.js`, registered by `src/components/layout/RegisterServiceWorker.tsx`.
- AWS (`infra/`): the CDK stack is `infra/lib/album-wall-stack.ts`. Lambdas in `infra/lambda/`: `discogs-proxy` (collections, folders, Discogs sign-in, saved walls, short links), `cover-image` (resized covers), `cover-profiles` (shared cover colors), `poster`, `share-page` (link previews for short links), and `shared/` helpers.

## Data flow (high-level)
- `SearchInput` calls `useCollection`, which reads the cached copy or asks the proxy through `getUserCollection`; a share link or a remembered wall orders the collection first.
- The first `rows x columns` albums are the wall (`displayedAlbums`), the rest the pool (`poolItems`). Pinned albums keep their spots through drags, shuffles and builds.
- Builds (Arrange) return the whole collection in a new order; each is one change that Undo reverses.
- Exports draw the wall from its tiles' covers onto a canvas; nothing captures the page itself.

## Environment variables
- `NEXT_PUBLIC_DISCOGS_PROXY_URL` points the static frontend at the AWS Discogs proxy Lambda Function URL.
- `NEXT_PUBLIC_COLLECTION_CACHE_URL`, `NEXT_PUBLIC_IMAGE_SERVICE_URL`, `NEXT_PUBLIC_PROFILE_SERVICE_URL` and `NEXT_PUBLIC_POSTER_SERVICE_URL` point at the CloudFront collection cache and the cover-image, cover-profiles and poster services; each feature falls back or turns off when its value is empty.
- `NEXT_PUBLIC_BASE_PATH` needed for static deployments (GitHub Pages).
- `NEXT_STATIC_EXPORT` controls SSR vs static export in builds.
- Any sensitive Discogs credentials must not be exposed through static client code. Keep secrets in AWS secure storage (for example SSM Parameter Store `SecureString`) or another server-side secret manager, never in `NEXT_PUBLIC_*` variables.

## AWS infrastructure expectations
- Tag all AWS resources created for this project so they are easy to identify later in the AWS console.
- Use a consistent project tag value of `album-wall` on all taggable resources created through CDK or other deployment tooling.

## Common commands
- Install: `npm install`
- Dev server: `npm run dev` (Next.js + Turbopack)
- Lint: `npm run lint` (or `npm run lint:fix`)
- Format: `npm run format` (or `npm run format:check`), over `src`, `e2e`, `scripts` and `infra`
- Unused code: `npm run check:unused` (knip; also runs before each push)
- Typecheck: `npm run type-check`
- Static build: `npm run build:static`, run with `npm run start` (serves `out/` under `NEXT_PUBLIC_BASE_PATH` on port 3100)
- Static build checks: `npm run check:static-output` (after `build:static`), `npm run test:e2e` (Playwright and axe against the built site; needs `npx playwright install chromium` once), and Lighthouse with `npx @lhci/cli@0.15.1 autorun`. Set `NEXT_PUBLIC_BASE_PATH=/album-wall` for all three. `build:static` fails when `NEXT_PUBLIC_DISCOGS_PROXY_URL` or `NEXT_PUBLIC_BASE_PATH` is missing.
- SSR build: `npm run build:ssr`, run with `npm run start:next`

## Feature readiness criteria
- A feature is only complete when it passes linting (`npm run lint`), typechecks (`npm run type-check`), and the relevant build (`npm run build:static` or `npm run build:ssr`).
- If the change targets deployment mode specifically, validate the matching build and start command.

## Documentation expectations
- Comments explain what the code cannot say: intent, units, invariants, side effects and surprises (why a limit has its value, what a browser refuses).
- Give exported functions and hooks a short summary when the name alone does not say what they do.
- Write `@param` and `@returns` only when they add something the name and type do not, such as units, ranges, what `null` means or what the caller must do. No tags that repeat the signature ("@param username The username").
- Do not add boilerplate comments to trivial presentational code.

## UI responsiveness expectations
- Any new or edited UI component must be responsive and remain usable on mobile widths, not just desktop layouts.
- When changing layout-heavy components, verify there is no unintended horizontal overflow and that controls remain reachable around common phone widths such as `375px` and `390px`.
- Prefer mobile-first layout decisions for toolbars, forms, grids, and panels so dense desktop UIs do not simply compress into unusable phone layouts.

## Deployment notes
- Static export writes to `out/`; `npm run start` serves it on port 3100.
- SSR uses Next.js server on port 3001.
