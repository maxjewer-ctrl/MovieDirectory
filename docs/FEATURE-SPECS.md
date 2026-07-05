# Feature Specifications

Detailed specs for the priority features identified in the project analysis.

---

## Feature: Add New Movie

### Goal
Allow adding new titles directly from the browser without opening Excel.

### UI
- "Add Movie" button in the toolbar (next to "New List")
- Opens a modal form with fields:
  - **Title** (required, text)
  - **Section** (required, dropdown: General 4K / Blu-ray, Animation / Family, Studio Ghibli, Action / Drama / Sci-Fi, Horror, Criterion Collection, Director Collections, Marvel / Superhero)
  - **Primary Format** (dropdown: 4K, Blu-ray, DVD, 4K / Blu-ray, Criterion, Digital, Series, Collection, Trilogy)
  - **Director Collection** (optional text, with autocomplete from existing directors)
  - **Steelbook** (checkbox)
  - **Criterion** (checkbox)
  - **Movies Anywhere** (checkbox)
  - **Edition Notes** (optional text)
  - **Notes** (optional textarea)

### Backend
- New endpoint: `POST /api/catalog`
- Auto-generates: `id` (movie-{next number}), `inventoryNumber` (max + 1), `sortTitle` (strip leading articles)
- Appends a new row to the Catalog sheet in the workbook
- Returns the full movie record

### Validation
- Title must not be empty
- Title must not duplicate an existing title (warn but allow override)

---

## Feature: Value Estimation System

### Goal
Track what each title is worth and see collection value at a glance.

### New Spreadsheet Columns
| Column | Type | Example |
|--------|------|---------|
| Purchase Price | Number | 24.99 |
| Estimated Value | Number | 45.00 |
| Value Source | Text | eBay sold avg |
| Value Date | Date | 2026-06-15 |
| Condition | Text | Mint / Like New / Good / Fair |

### UI - Detail Panel
New "Value & Condition" block in the detail panel:
- Purchase price input (currency)
- Estimated value input (currency)
- Condition dropdown
- Value source text + date (read-only display or editable)
- Visual indicator: green up arrow if value > purchase price, red down if less

### UI - Stats Dashboard
- New stat card: "Collection Value" showing sum of all estimated values
- New stat card: "Total Invested" showing sum of purchase prices
- Optional: "Appreciation" showing the delta

### UI - Sorting & Filtering
- New sort option: "Most Valuable"
- New quick filter: "Appreciating" (value > purchase price)
- New quick filter: "Needs Valuation" (estimated value is empty)

### Backend
- Add columns to `catalogColumns` in `catalog-workbook.mjs`
- Add fields to `editableMovieFields`
- PATCH endpoint already supports arbitrary fields once registered

---

## Feature: Special Features Catalog

### Goal
Record what bonus content is included with each physical disc, enabling search and filtering by special feature type.

### Data Model
New spreadsheet column: `Special Features` (pipe-separated)

Predefined feature types:
- Audio Commentary
- Behind the Scenes
- Deleted Scenes
- Documentary
- Featurette
- Interview
- Trailer
- Booklet / Insert
- Slipcover
- Poster / Art Cards
- Digital Copy
- Director's Cut
- Alternate Ending
- Storyboards
- Isolated Score

### UI - Detail Panel
New "Special Features" block:
- Chip/tag display of current features
- "Edit Features" button opens a checkbox grid of predefined types
- "Add Custom" text input for unlisted features
- Changes save to spreadsheet on toggle

### UI - Filtering
- New group-by option: "By Special Feature"
- Search should match special feature names
- Possible quick filter: "Has Commentary" or "Has Booklet"

### Backend
- Store as pipe-separated string in Excel (consistent with Tags and Edition Notes)
- Add to searchBlob construction in `buildMovieIndex()`
- Add to `editableMovieFields`

---

## Feature: Watch Status & Rating

### Goal
Track what you've watched and your personal ratings. Data columns already exist - just need UI.

### UI - Detail Panel
New controls in the detail panel:
- **Watch Status**: segmented button group (Unwatched | Watched | Rewatching)
- **Personal Rating**: 5-star clickable rating (maps to 1-10 internally, displayed as half-stars)

### UI - Sorting & Filtering  
- New sort option: "Highest Rated"
- New quick filter: "Unwatched"
- New quick filter: "Top Rated" (rating >= 8)

### Backend
- Add `watchStatus` and `personalRating` to `editableMovieFields`
- PATCH endpoint handles these the same as other fields

---

## Feature: Favorites & Lists Persistence

### Goal
Sync browser favorites and list membership back to the spreadsheet so they survive device/browser changes.

### Approach
When `toggleFavorite()` fires:
1. Update localStorage (existing behavior)
2. PATCH the movie with `{ seedFavorite: true/false }`

When `toggleMovieInList()` fires:
1. Update localStorage (existing behavior)  
2. Rebuild the pipe-separated `Seed Lists` string for that movie
3. PATCH with `{ seedLists: "List A | List B" }`

### Migration
- On first load after this feature ships, if localStorage has favorites/lists that differ from the spreadsheet seed data, write them all to the spreadsheet (one-time sync)

---

## Feature: Auto-Backup

### Goal
Prevent data loss if the Excel file corrupts.

### Implementation
In `serve.mjs`, on server start:
1. Check if workbook file exists
2. Copy it to `outputs/catalog/backups/Movie Collection Catalog - {ISO date}.xlsx`
3. Keep last 10 backups, delete older ones

### Restore
- Manual: copy a backup file over the main workbook path and restart server

---

## Feature: TMDb Integration (Future)

### Goal
Auto-fill metadata from The Movie Database API.

### Workflow
1. User clicks "Look Up" on a movie (or during Add Movie)
2. App searches TMDb by title
3. User picks the correct result from a list
4. Auto-fills: year, director, runtime, genre, poster URL, overview
5. Poster URL used to display real cover art instead of generated gradient

### New Fields
| Column | Type | Example |
|--------|------|---------|
| TMDb ID | Number | 550 |
| Year | Number | 1999 |
| Director | Text | David Fincher |
| Runtime | Number | 139 |
| Genre | Text | Drama, Thriller |
| Poster URL | Text | https://image.tmdb.org/... |
| Overview | Text | (plot summary) |

### Requirements
- TMDb API key (free for personal use)
- Proxy through the Node server to avoid exposing the key client-side
- Rate limiting (TMDb allows 40 requests per 10 seconds)
