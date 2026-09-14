# Filomer — Project Change Log & Roadmap Tracker

All modifications and architectural improvements are tracked here phase-by-phase for manual Git commits.

---

## Phase 1: True Offline PWA & Resilient Multi-CDN Engine Loader
*Status: Completed ✓*

### Key Objectives Achieved
1. **Resilient Multi-CDN WASM Lazy-Loading**:
   - Primary: jsDelivr (`@ffmpeg/core@0.12.10/dist/esm/`).
   - Secondary Fallback: unpkg (`@ffmpeg/core@0.12.10/dist/esm/`).
   - Zero cloud accounts, zero credit cards, zero server costs.
2. **Local Disk Persistence via Browser `CacheStorage` (`filomer-engine-cache-v1`)**:
   - Downloads the ~31MB WASM binary once, stores in browser cache, and loads in < 30ms on repeat visits.
   - 100% offline execution once cached.
3. **Live Download Stream Progress**:
   - Accurate download percentage & MB reporting (`onDownloadProgress`) displayed on `FileCard` during first engine load.
4. **Service Worker & PWA Manifest**:
   - `public/manifest.json` configured for desktop & mobile PWA standalone install.
   - `public/sw.js` created for offline caching of app shell, icons, and fonts.
   - PWA metadata & service worker registration in `index.html` and `src/main.jsx`.
5. **AppBar Offline & Engine Cache Indicators**:
   - Real-time offline detection badge (`Offline Mode`).
   - Engine cache status badge with 1-click "Cache Engine" pre-cacher.
6. **Codebase Deduplication & Quality**:
   - Replaced duplicated FFmpeg loading in `conversionEngine.js` and `compressionEngine.js` with `ffmpegLoader.js`.
   - Resolved all ESLint errors (Fast Refresh, effect setState, unused vars) across `Toast.jsx`, `usePWA.js`, and `theme.js`. Both `npm run lint` and Vite production build pass cleanly.

### Modified & Created Files
- `[NEW] CHANGELOG.md` — Project modification log.
- `[NEW] src/utils/ffmpegLoader.js` — Resilient multi-CDN fallback, CacheStorage manager, and progress stream.
- `[NEW] public/manifest.json` — PWA Web App Manifest.
- `[NEW] public/sw.js` — Offline caching Service Worker.
- `[MODIFY] src/conversionEngine.js` — Refactored to consume unified `ffmpegLoader.js`.
- `[MODIFY] src/compressionEngine.js` — Refactored to consume unified `ffmpegLoader.js`.
- `[MODIFY] src/components/FileCard.jsx` — Added live engine download progress overlay.
- `[MODIFY] index.html` — Added manifest link and mobile web app meta tags.
- `[MODIFY] src/main.jsx` — Registered `sw.js` service worker.
- `[MODIFY] src/components/Layout.jsx` — Added offline detection & engine cache badges.
- `[MODIFY] src/components/Toast.jsx` — ESLint fast-refresh export rule comment.
- `[MODIFY] src/hooks/usePWA.js` — Initialized state without synchronous effect setState; resolved missing dependencies.
- `[MODIFY] src/theme.js` — Removed unused import `alpha`.

---

## Phase 2: PDF Superpowers (iLovePDF Benchmark)
*Status: Completed ✓*

### Key Objectives Achieved
1. **Client-Side PDF Engine (`src/utils/pdfEngine.js`)**:
   - Progressive page thumbnail generation with canvas rendering and immediate memory reclamation.
   - Page rotation (cumulative 90°/180°/270°), reordering, and deletion support via `pdf-lib`.
   - Custom page range parser (e.g., `1-3, 5; 6-8`) exporting to individual parts.
   - Burst mode: splits all pages into individual 1-page PDFs packaged into a ZIP.
   - Multi-document PDF merging.
2. **Interactive Visual PDF Studio (`src/components/pdf/PdfWorkbench.jsx`)**:
   - **Organize & Rotate Studio**: Real thumbnail cards for every page, live CSS rotation preview, individual 90° clockwise and counter-clockwise rotate buttons, page move left/right controls, delete/restore toggle, bulk "Rotate All 90°", and "Export PDF".
   - **Split PDF Studio**: Mode selection between Extract Selected Checkboxes, Custom Page Ranges, and Burst All Pages to ZIP.
   - **Merge PDFs Studio**: Dedicated multi-file queue with reordering controls and 1-click merge.
3. **Navigation & Dynamic Theme Integration**:
   - Added crimson/rose `pdf` palette (`#EF4444`) to `PALETTES` in `src/components/Layout.jsx`.
   - Added **PDF Studio** tab to `NavPills` with dynamic 3-tab layout and comet animation.
   - Registered `/pdf` route in `src/App.jsx`.
   - Added `.pill-comet--pdf` glow styling in `src/index.css`.

### Modified & Created Files
- `[NEW] src/utils/pdfEngine.js` — Client-side PDF thumbnail generator, page rotator, splitter, and merger.
- `[NEW] src/components/pdf/PdfWorkbench.jsx` — Visual PDF Studio component (Organize, Split, Merge).
- `[MODIFY] src/components/Layout.jsx` — Added `pdf` palette, updated `NavPills` for 3 tabs, and wired `/pdf` navigation.
- `[MODIFY] src/App.jsx` — Registered `/pdf` route.
- `[MODIFY] src/index.css` — Added `.pill-comet--pdf` animation filter.

---

## Phase 3: Tools Hub & Queue Flexibility
*Status: Planned*
- Dedicated Tools Hub page (`/tools`) with direct tool routing.
- De-lock queue restriction to support mixed file formats.

---

## Phase 4: Visual Compression Preview & Laptop Memory Optimization
*Status: Planned*
- Side-by-side before/after image comparison slider.
- Low-memory canvas cleanup routines.
