# Movie Directory

A personalized web app to catalog your physical media collection — DVDs, Blu-rays, 4K discs. Track value, special features, watch status, ratings, and organize into custom lists.

## Features

- **Browse & Search** — grid or list view, search by title, director, genre, UPC, tags
- **Add Movies** — manual entry, TMDb search with auto-fill, or UPC barcode lookup
- **Formats** — DVD, Blu-ray, 4K, 4K + Blu-ray
- **Value Tracking** — purchase price, estimated value, condition, collection totals
- **Special Features** — catalog disc contents (commentaries, documentaries, booklets, etc.)
- **Watch Status & Rating** — mark watched/unwatched, rate 1-10
- **Custom Lists** — create lists, add/remove movies
- **Favorites** — persisted to the spreadsheet
- **Stats Dashboard** — total titles, collection value, total invested, average rating
- **TMDb Integration** — auto-fill metadata, posters, director, year, runtime, genre
- **UPC Lookup** — scan or type a barcode to identify the disc
- **Auto-Backup** — workbook backed up on each server start (keeps last 10)

## Quick Start

```bash
npm run serve
```

Open `http://127.0.0.1:4173`

## API Keys (Optional)

Copy `.env.example` to `.env` and fill in your keys:

```bash
# TMDb — free at https://www.themoviedb.org/settings/api
TMDB_API_KEY=your_key_here

# OMDb — free at https://www.omdbapi.com/apikey.aspx
OMDB_API_KEY=your_key_here
```

Run the server with env vars:

```bash
# Linux/Mac
TMDB_API_KEY=xxx OMDB_API_KEY=yyy npm run serve

# Windows PowerShell
$env:TMDB_API_KEY="xxx"; $env:OMDB_API_KEY="yyy"; npm run serve
```

UPC lookup uses the free upcitemdb.com trial API (no key needed, rate-limited).

## Backfill poster art for your existing library

Real poster art only appears when a movie has a `Poster URL` saved in the workbook.

New titles can get that from the TMDb search flow in the app. For your existing collection, run:

```bash
# Windows PowerShell
$env:TMDB_API_KEY="your_key_here"; npm run catalog:posters
```

Optional:

```bash
# Preview matches without writing
$env:TMDB_API_KEY="your_key_here"; node ./scripts/backfill-posters-from-tmdb.mjs --dry-run --limit=25
```

After it finishes, refresh `http://127.0.0.1:4173` and the matched titles will show real poster art.

## Data Storage

Everything lives in the Excel workbook at `outputs/catalog/Movie Collection Catalog.xlsx`.

The browser app reads from it and writes back to it. Favorites, lists, value data, ratings — all persisted in the spreadsheet.

## Deploying to Vercel

This app has a Node.js server that writes to an Excel file, so standard Vercel static hosting won't support live editing. Options:

1. **Static read-only deploy** — run `npm run catalog:sync` to generate `movies-data.js`, then deploy as static. Editing won't save.
2. **Serverless with external storage** — convert the data layer from Excel to a database (Supabase, PlanetScale, Turso) for a full Vercel deployment.
3. **Vercel + persistent backend** — deploy the frontend to Vercel and the API to Railway/Render/Fly.io with disk storage.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run serve` | Start dev server with live Excel read/write |
| `npm run catalog:sync` | Export workbook data to static JS/JSON files |
| `npm run catalog:bootstrap` | Generate a new workbook from existing movie data |
