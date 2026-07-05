import {
  loadCatalogRecords,
  updateCatalogMovie,
} from "./catalog-workbook.mjs";

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const SEARCH_DELAY_MS = 250;

function printHelp() {
  console.log(`Backfill poster art from TMDb for movies missing Poster URL.

Usage:
  node ./scripts/backfill-posters-from-tmdb.mjs [--limit=25] [--dry-run]

Options:
  --limit=N    Only process the first N missing-poster titles.
  --dry-run    Find matches and print them without writing to the workbook.
  --help       Show this help text.

Environment:
  TMDB_API_KEY must be set before running this script.

Example (PowerShell):
  $env:TMDB_API_KEY="your_key_here"; node ./scripts/backfill-posters-from-tmdb.mjs --limit=50
`);
}

function parseArgs(argv) {
  const args = {
    limit: Infinity,
    dryRun: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (Number.isFinite(value) && value > 0) {
        args.limit = Math.floor(value);
      }
    }
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTitle(title) {
  return String(title ?? "")
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/^a\s+/i, "")
    .replace(/^an\s+/i, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildSearchQuery(movie) {
  return movie.title
    .replace(/[:].*$/, "")
    .replace(/\b(collection|trilogy|series)\b/gi, "")
    .trim();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MovieDirectory/1.0",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TMDb request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  return response.json();
}

function pickBestSearchResult(movie, results) {
  if (!Array.isArray(results) || results.length === 0) return null;

  const normalizedMovieTitle = normalizeTitle(movie.title);
  const movieYear = Number(movie.year) || null;

  const scored = results
    .filter((result) => result?.poster_path)
    .map((result) => {
      const normalizedResultTitle = normalizeTitle(result.title || result.name || "");
      const resultYear = Number(String(result.release_date || "").slice(0, 4)) || null;
      let score = 0;

      if (normalizedResultTitle === normalizedMovieTitle) score += 100;
      if (normalizedResultTitle.includes(normalizedMovieTitle)) score += 40;
      if (normalizedMovieTitle.includes(normalizedResultTitle)) score += 25;
      if (movieYear && resultYear && movieYear === resultYear) score += 20;
      if (result.popularity) score += Math.min(15, result.popularity / 10);

      return { result, score };
    })
    .sort((left, right) => right.score - left.score);

  return scored[0]?.result || null;
}

async function fetchMovieDetails(tmdbId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
  return fetchJson(url);
}

async function searchTmdb(movie) {
  const query = buildSearchQuery(movie);
  if (!query) return null;

  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    query,
    include_adult: "false",
  });

  if (movie.year) {
    params.set("year", String(movie.year));
  }

  const url = `https://api.themoviedb.org/3/search/movie?${params.toString()}`;
  const payload = await fetchJson(url);
  const best = pickBestSearchResult(movie, payload.results || []);
  if (!best) return null;

  const details = await fetchMovieDetails(best.id);
  const director = details.credits?.crew?.find((person) => person.job === "Director")?.name || null;
  const genre = Array.isArray(details.genres) ? details.genres.map((item) => item.name).join(", ") : null;

  return {
    tmdbId: best.id,
    posterUrl: best.poster_path ? `${TMDB_IMAGE_BASE}${best.poster_path}` : null,
    overview: details.overview || null,
    director,
    runtime: details.runtime || null,
    genre,
    year: Number(String(details.release_date || "").slice(0, 4)) || movie.year || null,
    matchedTitle: best.title || null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!TMDB_API_KEY) {
    console.error("Missing TMDB_API_KEY. Set it before running this script.");
    process.exitCode = 1;
    return;
  }

  const records = await loadCatalogRecords();
  const targets = records
    .filter((movie) => !movie.posterUrl)
    .slice(0, args.limit);

  if (targets.length === 0) {
    console.log("No movies are missing poster art.");
    return;
  }

  console.log(`Scanning ${targets.length} movie(s) for missing poster art...`);

  let matched = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, movie] of targets.entries()) {
    console.log(`[${index + 1}/${targets.length}] ${movie.title}`);
    try {
      const found = await searchTmdb(movie);
      if (!found?.posterUrl) {
        skipped += 1;
        console.log("  No poster match found.");
        await sleep(SEARCH_DELAY_MS);
        continue;
      }

      matched += 1;
      console.log(`  Match: ${found.matchedTitle || movie.title}`);
      console.log(`  Poster: ${found.posterUrl}`);

      if (!args.dryRun) {
        await updateCatalogMovie(movie.id, {
          tmdbId: found.tmdbId,
          posterUrl: found.posterUrl,
          overview: movie.overview || found.overview,
          director: movie.director || found.director,
          runtime: movie.runtime || found.runtime,
          genre: movie.genre || found.genre,
          year: movie.year || found.year,
        });
      }
    } catch (error) {
      failed += 1;
      console.log(`  Failed: ${error.message}`);
    }

    await sleep(SEARCH_DELAY_MS);
  }

  console.log("");
  console.log(`Matched: ${matched}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  if (args.dryRun) {
    console.log("Dry run only: no workbook changes were written.");
  } else {
    console.log("Workbook updated. Reload the live site to see poster art.");
  }
}

await main();
