# Movie Directory - Project Analysis & Recommendations

## Current State Summary

The Movie Directory is a personalized web app for cataloging a physical media collection (~250 titles). It uses an Excel workbook as the data backend, served through a custom Node.js HTTP server that reads/writes the `.xlsx` file live.

### Architecture

```
Browser (vanilla JS SPA)
    |
    v
Node.js HTTP Server (scripts/serve.mjs)
    |
    v
Excel Workbook (outputs/catalog/Movie Collection Catalog.xlsx)
    via @oai/artifact-tool SpreadsheetFile API
```

### What's Built and Working

| Feature | Status |
|---------|--------|
| Browsable catalog grid/list view | Done |
| Search (title, tags, category, director) | Done |
| Sort (inventory, title, category, favorites) | Done |
| Group by (category, format, director, collection tag) | Done |
| Sidebar navigation (formats, categories, directors) | Done |
| Detail panel with movie metadata | Done |
| Edit format, steelbook, criterion, movies anywhere (writes to Excel) | Done |
| Favorites (browser localStorage) | Done |
| Custom lists (browser localStorage) | Done |
| Seed favorites/lists from spreadsheet | Done |
| Quick filter chips (Criterion, Series, Collections, Steelbook, Ghibli) | Done |
| Stats dashboard (totals, favorites, criterion count, directors) | Done |
| Responsive design (desktop 3-panel, tablet, mobile) | Done |
| Mobile access via LAN URL | Done |
| Excel workbook with Guide, Catalog, and Lookups sheets | Done |

### Data Model (per movie)

Fields currently tracked in the spreadsheet:
- `id`, `inventoryNumber`, `title`, `rawTitle`, `sortTitle`
- `section`, `subsection`, `directorCollection`
- `primaryFormat`, `collectionType`
- `tags` (pipe-separated), `editionNotes` (pipe-separated)
- `steelbook`, `criterion`, `moviesAnywhere` (booleans)
- `seedFavorite`, `seedLists`
- `watchStatus`, `personalRating`, `notes` (defined but **not exposed in UI**)

---

## Gap Analysis

### 1. Missing: Add New Movie from Browser

Currently, new titles can only be added by editing the Excel workbook directly. There's no "Add Movie" button or form in the UI.

### 2. Missing: Value Estimation / Price Tracking

No fields or UI exist for tracking purchase price, current market value, or estimated collection worth. This is a core goal you mentioned.

### 3. Missing: Special Features Cataloging

No structured way to record disc special features (commentary tracks, documentaries, deleted scenes, booklets, etc.). The `editionNotes` field is a flat pipe-separated string that could serve this purpose but isn't exposed for editing in the browser.

### 4. Unused Data Fields

`watchStatus`, `personalRating`, and `notes` all exist in the spreadsheet schema but have no UI controls. These are ready to wire up.

### 5. No Bulk Edit / Import

No way to import a batch of movies (CSV, barcode scan, API lookup, etc.).

### 6. localStorage-Only Lists & Favorites

Favorites and custom lists live in the browser only. If you clear browser data or use a different device, they're gone. The spreadsheet has `Seed Favorite` and `Seed Lists` columns but they're only read at first load.

### 7. No External Data Enrichment

No integration with TMDb, OMDb, or Blu-ray.com for auto-filling metadata, cover art, release year, runtime, etc.

### 8. Dependency on `@oai/artifact-tool`

The Excel read/write layer depends on `@oai/artifact-tool` (a Claude-specific library). This works in the current setup but limits portability. If you ever want to host this publicly or hand it off, this would need to be replaced with a standard library like `exceljs` or switched to a database.

---

## Recommended Next Steps (Priority Order)

### Phase 1: Unlock the Core Goals

These directly address your stated goals of editing, value tracking, and special features.

#### 1A. Add "New Movie" Form
- Modal or slide-out form with required fields: title, format, section
- Auto-assign next inventory number
- Write directly to the spreadsheet via a new POST `/api/catalog` endpoint

#### 1B. Value Estimation System
Add new spreadsheet columns and UI:
- `purchasePrice` - what you paid
- `estimatedValue` - current market value (manual entry or API-assisted)
- `valueSource` - where the estimate came from (eBay, PriceCharting, manual)
- `valueDate` - when last updated
- Collection total value stat in the dashboard
- Sort by value, filter "most valuable"

#### 1C. Special Features Catalog
Add a structured way to record what's on each disc:
- `specialFeatures` field (pipe-separated or structured JSON)
- Predefined categories: Commentary, Documentary, Deleted Scenes, Featurette, Booklet, Slipcover, Poster, Digital Copy
- Checkbox grid or tag-style entry in the detail panel
- Filter/search by special feature type ("show me everything with commentary tracks")

### Phase 2: Quality of Life

#### 2A. Expose Unused Fields in UI
- Watch status toggle (Unwatched / Watched / Rewatching)
- Personal rating (1-10 or 5-star)
- Notes textarea in detail panel
- All write back to Excel on change

#### 2B. Persist Favorites & Lists to Spreadsheet
- When a favorite is toggled, also write `Seed Favorite = TRUE` to the workbook
- When list membership changes, update `Seed Lists` column
- This makes the data device-independent

#### 2C. Collection Statistics Enhancement
- Total estimated value
- Value by format (4K vs Blu-ray vs Criterion)
- Most/least valuable titles
- Purchase history timeline (if dates added)
- Format breakdown pie chart

### Phase 3: Enrichment & Automation

#### 3A. TMDb/OMDb Integration
- Lookup by title to auto-fill: year, director, runtime, genre, poster URL
- Store poster URLs for real cover art instead of generated gradients
- "Search & Add" workflow: type a title, pick from results, auto-populate fields

#### 3B. Barcode/UPC Lookup
- Scan or type a UPC code
- Look up the disc edition via Blu-ray.com or a UPC database
- Pre-fill format, edition, special features

#### 3C. Market Value API
- Pull pricing from eBay sold listings or PriceCharting
- Periodic refresh of estimated values
- Flag titles that have appreciated significantly

### Phase 4: Infrastructure (If Going Public/Multi-Device)

#### 4A. Replace Excel with SQLite or PostgreSQL
- Removes `@oai/artifact-tool` dependency
- Better concurrent access, faster queries
- Migration script from current Excel data

#### 4B. Authentication
- Simple password or PIN for single-user access
- Prevents random LAN users from editing your catalog

#### 4C. Export Options
- Export collection as CSV, PDF, or printable list
- Insurance documentation format (title + value + condition)
- Share a read-only public link to your collection

---

## Technical Observations

### Strengths
- Clean, well-structured vanilla JS with no framework overhead
- Beautiful, polished UI with thoughtful dark/light panel design
- Responsive at all breakpoints
- The spreadsheet-as-database approach is surprisingly effective for a personal tool
- Good separation between data layer (`catalog-workbook.mjs`) and presentation (`app.js`)

### Risks to Address
- **`@oai/artifact-tool` dependency**: Not a standard npm package. If it breaks or becomes unavailable, the entire data layer stops working. Mitigation: either pin the version carefully, or migrate to `exceljs`.
- **No data backup**: If the Excel file corrupts, the collection data is gone. Mitigation: add an auto-backup script that copies the xlsx on each server start.
- **innerHTML usage**: Several places use `.innerHTML` with movie data. If a movie title ever contained HTML characters, it could break rendering. Low risk for your own data but worth sanitizing.
- **Full re-render on every change**: The `render()` function rebuilds the entire DOM every time. Fine at ~250 movies, could get sluggish at 1000+. Virtual scrolling or incremental updates would help if the collection grows significantly.

---

## Quick Wins (Can Do Right Now)

1. **Wire up watch status, rating, and notes in the detail panel** - the data columns already exist
2. **Add a "Total Collection Value" stat card** - just needs a new column and sum
3. **Auto-backup the xlsx on server start** - 5 lines of code in `serve.mjs`
4. **Add an "Add Movie" button** - form + POST endpoint
5. **Sync favorites back to spreadsheet** - modify `toggleFavorite()` to also PATCH

---

## File Map

| File | Purpose |
|------|---------|
| `index.html` | Single-page app shell (sidebar, main, detail panel, modal) |
| `app.js` | All client-side logic (state, rendering, events, API calls) |
| `styles.css` | Full stylesheet (~1000 lines, responsive, dark panels) |
| `movies-data.js` | Static export of all movie data (fallback if API unavailable) |
| `movies-data.json` | JSON export of same data |
| `package.json` | Scripts: serve, catalog:sync, catalog:bootstrap |
| `scripts/serve.mjs` | HTTP server with GET/PATCH API + static file serving |
| `scripts/catalog-workbook.mjs` | Excel read/write/schema logic (core data layer) |
| `scripts/sync-catalog-to-app.mjs` | One-shot export from Excel to JS/JSON |
| `scripts/build-catalog-workbook.mjs` | Bootstrap a new Excel workbook from existing data |
| `outputs/catalog/` | Generated Excel workbook lives here |
