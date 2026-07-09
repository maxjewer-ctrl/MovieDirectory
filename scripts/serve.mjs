import http from "node:http";
import https from "node:https";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  catalogRecordsToClientScript,
  loadCatalogRecords,
  updateCatalogMovie,
  addCatalogMovie,
  workbookPath,
} from "./catalog-workbook.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

try {
  const envFile = readFileSync(path.join(rootDir, ".env"), "utf8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch { /* no .env file, that's fine */ }

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const jsOutputPath = path.join(rootDir, "movies-data.js");
const jsonOutputPath = path.join(rootDir, "movies-data.json");

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const OMDB_API_KEY = process.env.OMDB_API_KEY || "";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function getNetworkUrls(portNumber) {
  const results = [];
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) {
        results.push(`http://${address.address}:${portNumber}`);
      }
    }
  }
  return results;
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  response.end(JSON.stringify(payload));
}

async function persistStaticCatalog(records) {
  const sanitizedRecords = records.map(({ rowIndex, ...record }) => record);
  await fs.writeFile(jsOutputPath, catalogRecordsToClientScript(sanitizedRecords), "utf8");
  await fs.writeFile(jsonOutputPath, `${JSON.stringify(sanitizedRecords, null, 2)}\n`, "utf8");
  return sanitizedRecords;
}

function sanitizeEditablePayload(payload) {
  const next = {};
  const stringFields = [
    "primaryFormat", "watchStatus", "notes", "valueSource", "valueDate",
    "condition", "upc", "director", "genre", "posterUrl", "backCoverUrl",
    "spineArtUrl", "artworkSourceName", "artworkSourceUrl", "overview",
    "essay", "essaySource", "essaySourceTitle",
  ];
  const boolFields = ["steelbook", "criterion", "moviesAnywhere", "seedFavorite"];
  const numberFields = ["personalRating", "purchasePrice", "estimatedValue", "tmdbId", "year", "runtime"];
  const arrayFields = ["specialFeatures", "seedLists"];

  for (const field of stringFields) {
    if (field in payload) next[field] = String(payload[field] ?? "").trim();
  }
  for (const field of boolFields) {
    if (field in payload) next[field] = Boolean(payload[field]);
  }
  for (const field of numberFields) {
    if (field in payload) {
      const val = payload[field];
      next[field] = (val === null || val === "" || val === undefined) ? "" : Number(val);
    }
  }
  for (const field of arrayFields) {
    if (field in payload) {
      next[field] = Array.isArray(payload[field]) ? payload[field] : String(payload[field] ?? "");
    }
  }

  return next;
}

const postersDir = path.join(rootDir, "posters");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, { headers: { "User-Agent": "MovieDirectory/1.0" } }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: null, raw: body });
        }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, { headers: { "User-Agent": "MovieDirectory/1.0", ...headers } }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        text: Buffer.concat(chunks).toString("utf8"),
      }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, { headers: { "User-Agent": "MovieDirectory/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks) }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTitleForSearch(title) {
  return String(title || "")
    .replace(/[•·]/g, " ")
    .replace(/&/g, "and")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildArtworkTitleSearchVariants(title) {
  const original = String(title || "").trim();
  const normalized = normalizeTitleForSearch(title);
  const collapsed = normalized.replace(/\s+/g, "");
  return [...new Set([original, normalized, collapsed].filter(Boolean))];
}

async function searchBluRayDirectly(title) {
  const url = `https://www.blu-ray.com/search/?keyword=${encodeURIComponent(title)}&type=movies`;
  const result = await fetchText(url, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.blu-ray.com/",
  });
  if (result.status !== 200) return [];
  const seen = new Set();
  const results = [];
  for (const match of result.text.matchAll(/href="(\/movies\/[^"]+\/\d+\/)"/g)) {
    const path = match[1];
    if (seen.has(path)) continue;
    seen.add(path);
    results.push({ url: `https://www.blu-ray.com${path}` });
  }
  return results;
}

function extractFirstMatch(text, regex) {
  const match = text.match(regex);
  return match?.[1] || null;
}

function normalizeImageUrl(url) {
  if (!url) return null;
  return url.replace(/&amp;/g, "&").replace(/\?[^?]*$/, "");
}

async function fetchBluRayReleaseArtwork(releaseUrl) {
  const result = await fetchText(releaseUrl, { "User-Agent": "Mozilla/5.0" });
  if (result.status !== 200) return null;

  const html = result.text;
  const title = decodeHtmlEntities(extractFirstMatch(html, /<title>([^<]+)<\/title>/i) || "");
  const description = decodeHtmlEntities(extractFirstMatch(html, /<meta name="description" content="([^"]+)"/i) || "");
  const largeUrl = normalizeImageUrl(extractFirstMatch(html, /property="og:image" content="([^"]+)"/i));
  const frontUrl = normalizeImageUrl(extractFirstMatch(html, /(https:\/\/images\.static-bluray\.com\/movies\/covers\/\d+_front\.jpg[^"'\\<\s]*)/i));
  const backUrl = normalizeImageUrl(extractFirstMatch(html, /(https:\/\/images\.static-bluray\.com\/movies\/covers\/\d+_back\.jpg[^"'\\<\s]*)/i));
  const slipUrl = normalizeImageUrl(extractFirstMatch(html, /(https:\/\/images\.static-bluray\.com\/movies\/covers\/\d+_slip\.jpg[^"'\\<\s]*)/i));

  return {
    releaseUrl,
    title,
    description,
    frontUrl: frontUrl || largeUrl,
    backUrl,
    slipUrl,
  };
}

function buildTitleWordRegex(title) {
  return normalizeTitleForSearch(title)
    .split(/\s+/)
    .filter((word) => word.length >= 3)
    .slice(0, 6)
    .map((word) => new RegExp(`\\b${escapeRegExp(word.toLowerCase())}\\b`, "i"));
}

function scoreReleaseMatch(movie, release) {
  const format = String(movie.primaryFormat || "").toLowerCase();
  const is4k = format.includes("4k");
  const haystack = `${release.title} ${release.description}`.toLowerCase();
  let score = 0;

  const titleRegexes = buildTitleWordRegex(movie.title);
  const matchedWords = titleRegexes.filter((regex) => regex.test(haystack)).length;
  score += matchedWords * 14;

  if (movie.steelbook) score += haystack.includes("steelbook") ? 42 : -8;
  else if (haystack.includes("steelbook")) score -= 14;

  if (movie.criterion) score += haystack.includes("criterion") ? 46 : -10;
  else if (haystack.includes("criterion")) score -= 18;

  if (is4k) score += haystack.includes("4k") ? 28 : -8;
  else if (haystack.includes("4k")) score -= 6;

  if (haystack.includes("blu-ray")) score += 8;
  if (movie.year && haystack.includes(String(movie.year))) score += 6;
  if (/temporary cover art/i.test(haystack)) score -= 10;
  if (/dvd/i.test(haystack) && !haystack.includes("blu-ray")) score -= 10;

  return score;
}

function buildArtworkCandidateId(parts) {
  return parts.map((part) => String(part || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()).join("-");
}

function normalizeDuplicateKey(frontUrl, backUrl = "", spineUrl = "") {
  const normalize = (url) => String(url || "").replace(/\?[^?]*$/, "").toLowerCase();
  return [normalize(frontUrl), normalize(backUrl), normalize(spineUrl)].join("|");
}

function dedupeArtworkCandidates(candidates) {
  const deduped = new Map();

  for (const candidate of candidates) {
    const key = normalizeDuplicateKey(candidate.frontUrl, candidate.backUrl, candidate.spineUrl);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, candidate);
      continue;
    }

    const existingCompleteness = [existing.frontUrl, existing.backUrl, existing.spineUrl].filter(Boolean).length;
    const candidateCompleteness = [candidate.frontUrl, candidate.backUrl, candidate.spineUrl].filter(Boolean).length;
    const shouldReplace = (candidate.score || 0) > (existing.score || 0)
      || ((candidate.score || 0) === (existing.score || 0) && candidateCompleteness > existingCompleteness);

    deduped.set(key, shouldReplace ? {
      ...candidate,
      backUrl: candidate.backUrl || existing.backUrl || null,
      spineUrl: candidate.spineUrl || existing.spineUrl || null,
    } : {
      ...existing,
      backUrl: existing.backUrl || candidate.backUrl || null,
      spineUrl: existing.spineUrl || candidate.spineUrl || null,
    });
  }

  return [...deduped.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
}

function buildTmdbPosterCandidates(movie, posters, fallbackCaseArt) {
  return posters.map((poster, index) => ({
    id: buildArtworkCandidateId([movie.id, "tmdb", index + 1]),
    sourceName: "TMDb",
    sourceUrl: `https://www.themoviedb.org/movie/${movie.tmdbId}`,
    releaseTitle: movie.title,
    faceLabel: index === 0 ? "Poster" : `Poster ${index + 1}`,
    frontUrl: poster.url,
    backUrl: fallbackCaseArt?.backdropUrl || null,
    spineUrl: fallbackCaseArt?.logoUrl || null,
    score: 10 - index,
  }));
}

async function getTmdbCaseArt(tmdbId) {
  if (!TMDB_API_KEY || !tmdbId) return { backdropUrl: null, logoUrl: null };
  const tmdbUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`;
  const result = await fetchJson(tmdbUrl);
  const backdrops = sortTmdbImages(result.data?.backdrops || [], [null]);
  const logos = sortTmdbImages(result.data?.logos || [], ["en", null]);
  return {
    backdropUrl: backdrops[0]?.file_path ? `https://image.tmdb.org/t/p/w780${backdrops[0].file_path}` : null,
    logoUrl: logos[0]?.file_path ? `https://image.tmdb.org/t/p/original${logos[0].file_path}` : null,
  };
}

async function buildBluRayArtworkCandidates(movie, fallbackCaseArt) {
  const releaseUrls = [];
  for (const title of buildArtworkTitleSearchVariants(movie.title).slice(0, 2)) {
    const results = await searchBluRayDirectly(title);
    for (const result of results) {
      if (!result.url?.includes("blu-ray.com/movies/")) continue;
      if (!releaseUrls.includes(result.url)) releaseUrls.push(result.url);
      if (releaseUrls.length >= 8) break;
    }
    if (releaseUrls.length >= 8) break;
  }

  const candidates = [];
  for (const releaseUrl of releaseUrls) {
    const release = await fetchBluRayReleaseArtwork(releaseUrl);
    if (!release?.frontUrl && !release?.slipUrl) continue;

    const score = scoreReleaseMatch(movie, release);
    const shared = {
      sourceName: "Blu-ray.com",
      sourceUrl: release.releaseUrl,
      releaseTitle: release.title || movie.title,
      backUrl: release.backUrl || fallbackCaseArt?.backdropUrl || null,
      spineUrl: fallbackCaseArt?.logoUrl || null,
      score,
    };

    if (release.frontUrl) {
      candidates.push({
        id: buildArtworkCandidateId([movie.id, "bluray", "front", candidates.length + 1]),
        ...shared,
        faceLabel: "Front",
        frontUrl: release.frontUrl,
      });
    }

    if (release.slipUrl) {
      candidates.push({
        id: buildArtworkCandidateId([movie.id, "bluray", "slip", candidates.length + 1]),
        ...shared,
        faceLabel: "Slip",
        frontUrl: release.slipUrl,
        score: score + 2,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

async function downloadArtworkAsset(remoteUrl, movieId, role = "asset") {
  await fs.mkdir(postersDir, { recursive: true });
  const ext = path.extname(new URL(remoteUrl).pathname) || ".jpg";
  const filename = `${movieId}-${role}${ext}`;
  const localPath = path.join(postersDir, filename);
  const result = await fetchBuffer(remoteUrl);
  if (result.status !== 200 || result.buffer.length < 100) return null;
  await fs.writeFile(localPath, result.buffer);
  return `./posters/${filename}`;
}

function sortTmdbImages(images, preferredLanguages = []) {
  const languageRank = new Map(preferredLanguages.map((language, index) => [language, index]));
  return [...(images || [])].sort((a, b) => {
    const aLanguage = languageRank.has(a.iso_639_1) ? languageRank.get(a.iso_639_1) : preferredLanguages.length;
    const bLanguage = languageRank.has(b.iso_639_1) ? languageRank.get(b.iso_639_1) : preferredLanguages.length;
    if (aLanguage !== bLanguage) return aLanguage - bLanguage;

    const aScore = (a.vote_average || 0) * 1000 + (a.vote_count || 0);
    const bScore = (b.vote_average || 0) * 1000 + (b.vote_count || 0);
    if (aScore !== bScore) return bScore - aScore;

    const aArea = (a.width || 0) * (a.height || 0);
    const bArea = (b.width || 0) * (b.height || 0);
    return bArea - aArea;
  });
}

async function downloadPoster(remoteUrl, movieId) {
  await fs.mkdir(postersDir, { recursive: true });
  const ext = path.extname(new URL(remoteUrl).pathname) || ".jpg";
  const filename = `${movieId}${ext}`;
  const localPath = path.join(postersDir, filename);

  try {
    const files = await fs.readdir(postersDir);
    for (const f of files) {
      if (f.startsWith(`${movieId}.`) && f !== filename) {
        await fs.unlink(path.join(postersDir, f)).catch(() => {});
      }
    }
  } catch { /* ignore */ }

  const result = await fetchBuffer(remoteUrl);
  if (result.status !== 200 || result.buffer.length < 1000) return null;
  await fs.writeFile(localPath, result.buffer);
  return `./posters/${filename}`;
}

async function backupWorkbook() {
  try {
    const exists = await fs.access(workbookPath).then(() => true).catch(() => false);
    if (!exists) return;
    const backupDir = path.join(path.dirname(workbookPath), "backups");
    await fs.mkdir(backupDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const backupPath = path.join(backupDir, `Movie Collection Catalog - ${date}.xlsx`);
    await fs.copyFile(workbookPath, backupPath);
    const files = await fs.readdir(backupDir);
    const backups = files.filter((f) => f.endsWith(".xlsx")).sort().reverse();
    for (const old of backups.slice(10)) {
      await fs.unlink(path.join(backupDir, old));
    }
    console.log(`Backup saved: ${backupPath}`);
  } catch (error) {
    console.warn("Backup failed:", error.message);
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/catalog") {
      const records = await loadCatalogRecords();
      const sanitizedRecords = await persistStaticCatalog(records);
      json(response, 200, { movies: sanitizedRecords });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/catalog") {
      const body = await readRequestBody(request);
      const payload = body ? JSON.parse(body) : {};
      const movie = await addCatalogMovie(payload);
      const records = await loadCatalogRecords();
      await persistStaticCatalog(records);
      json(response, 201, { movie: movie ? { ...movie, rowIndex: undefined } : null });
      return;
    }

    if (request.method === "PATCH" && url.pathname.startsWith("/api/catalog/")) {
      const movieId = decodeURIComponent(url.pathname.replace("/api/catalog/", ""));
      const body = await readRequestBody(request);
      const payload = body ? JSON.parse(body) : {};
      const updatedMovie = await updateCatalogMovie(movieId, sanitizeEditablePayload(payload));
      const records = await loadCatalogRecords();
      await persistStaticCatalog(records);
      json(response, 200, { movie: updatedMovie ? { ...updatedMovie, rowIndex: undefined } : null });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tmdb/search") {
      const query = url.searchParams.get("q");
      if (!query) { json(response, 400, { error: "Missing query param q" }); return; }
      if (!TMDB_API_KEY) { json(response, 503, { error: "TMDb API key not configured. Set TMDB_API_KEY env var." }); return; }
      const tmdbUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`;
      const result = await fetchJson(tmdbUrl);
      json(response, result.status === 200 ? 200 : 502, result.data);
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/tmdb/movie/")) {
      const tmdbId = url.pathname.replace("/api/tmdb/movie/", "");
      if (!TMDB_API_KEY) { json(response, 503, { error: "TMDb API key not configured." }); return; }
      const tmdbUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,release_dates,keywords`;
      const result = await fetchJson(tmdbUrl);
      json(response, result.status === 200 ? 200 : 502, result.data);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tmdb/director") {
      const name = url.searchParams.get("name");
      if (!name) { json(response, 400, { error: "Missing query param name" }); return; }
      if (!TMDB_API_KEY) { json(response, 503, { error: "TMDb API key not configured." }); return; }

      const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&include_adult=false`;
      const searchResult = await fetchJson(searchUrl);
      const people = searchResult.data?.results || [];
      // Prefer people whose primary craft is directing, then by popularity.
      const person = [...people].sort((a, b) => {
        const aDir = a.known_for_department === "Directing" ? 1 : 0;
        const bDir = b.known_for_department === "Directing" ? 1 : 0;
        if (aDir !== bDir) return bDir - aDir;
        return (b.popularity || 0) - (a.popularity || 0);
      })[0];

      if (!person) { json(response, 200, { directorName: name, films: [] }); return; }

      const creditsUrl = `https://api.themoviedb.org/3/person/${person.id}/movie_credits?api_key=${TMDB_API_KEY}`;
      const creditsResult = await fetchJson(creditsUrl);
      const crew = creditsResult.data?.crew || [];
      const seen = new Set();
      const films = crew
        .filter((c) => c.job === "Director" && !c.adult)
        .filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })
        .map((c) => ({
          tmdbId: c.id,
          title: c.title || c.original_title || "Untitled",
          year: c.release_date ? Number(c.release_date.slice(0, 4)) : null,
          posterUrl: c.poster_path ? `https://image.tmdb.org/t/p/w500${c.poster_path}` : null,
          overview: c.overview || "",
          voteCount: c.vote_count || 0,
        }))
        .sort((a, b) => (b.year || 0) - (a.year || 0));

      json(response, 200, { directorId: person.id, directorName: person.name || name, films });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/tmdb/posters/")) {
      const tmdbId = url.pathname.replace("/api/tmdb/posters/", "");
      if (!TMDB_API_KEY) { json(response, 503, { error: "TMDb API key not configured." }); return; }
      const tmdbUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`;
      const result = await fetchJson(tmdbUrl);
      const posters = (result.data?.posters || []).map((p) => ({
        url: `https://image.tmdb.org/t/p/w500${p.file_path}`,
        width: p.width,
        height: p.height,
        language: p.iso_639_1 || null,
        voteAverage: p.vote_average,
      }));
      json(response, 200, { posters });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/tmdb/case-art/")) {
      const tmdbId = url.pathname.replace("/api/tmdb/case-art/", "");
      if (!TMDB_API_KEY) { json(response, 503, { error: "TMDb API key not configured." }); return; }
      json(response, 200, await getTmdbCaseArt(tmdbId));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/artwork/candidates") {
      const body = await readRequestBody(request);
      const payload = body ? JSON.parse(body) : {};
      const fallbackCaseArt = await getTmdbCaseArt(payload.tmdbId);

      let tmdbPosters = [];
      if (TMDB_API_KEY && payload.tmdbId) {
        const tmdbUrl = `https://api.themoviedb.org/3/movie/${payload.tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`;
        const result = await fetchJson(tmdbUrl);
        tmdbPosters = sortTmdbImages(result.data?.posters || [], ["en", null])
          .slice(0, 10)
          .map((poster) => ({
            url: `https://image.tmdb.org/t/p/w500${poster.file_path}`,
            width: poster.width,
            height: poster.height,
          }));
      }

      const bluRayCandidates = await buildBluRayArtworkCandidates(payload, fallbackCaseArt);
      const tmdbCandidates = buildTmdbPosterCandidates(payload, tmdbPosters, fallbackCaseArt);
      const candidates = dedupeArtworkCandidates([...bluRayCandidates, ...tmdbCandidates]);
      json(response, 200, { candidates });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/omdb/search") {
      const query = url.searchParams.get("q");
      const imdbId = url.searchParams.get("imdbId");
      if (!OMDB_API_KEY) { json(response, 503, { error: "OMDb API key not configured. Set OMDB_API_KEY env var." }); return; }
      let omdbUrl;
      if (imdbId) {
        omdbUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${encodeURIComponent(imdbId)}&plot=full`;
      } else if (query) {
        omdbUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(query)}&type=movie`;
      } else {
        json(response, 400, { error: "Missing query param q or imdbId" }); return;
      }
      const result = await fetchJson(omdbUrl);
      json(response, 200, result.data);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/upc/lookup") {
      const upc = url.searchParams.get("upc");
      if (!upc) { json(response, 400, { error: "Missing query param upc" }); return; }
      const upcUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`;
      const result = await fetchJson(upcUrl);
      json(response, result.status === 200 ? 200 : 502, result.data);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tmdb/auto-poster") {
      if (!TMDB_API_KEY) { json(response, 503, { error: "TMDb API key not configured." }); return; }
      const body = await readRequestBody(request);
      const { movieId, title, year, variant } = body ? JSON.parse(body) : {};
      if (!movieId || !title) { json(response, 400, { error: "movieId and title required" }); return; }
      const yearParam = year ? `&year=${year}` : "";
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}${yearParam}&include_adult=false`;
      const searchResult = await fetchJson(searchUrl);
      const results = searchResult.data?.results || [];
      if (!results.length) { json(response, 200, { matched: false, movieId }); return; }
      const best = results[0];

      let remotePosterUrl = best.poster_path ? `https://image.tmdb.org/t/p/w500${best.poster_path}` : null;

      if (remotePosterUrl && (variant === "criterion" || variant === "steelbook")) {
        try {
          const imagesUrl = `https://api.themoviedb.org/3/movie/${best.id}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`;
          const imagesResult = await fetchJson(imagesUrl);
          const allPosters = imagesResult.data?.posters || [];
          if (allPosters.length > 1) {
            const sorted = [...allPosters].sort((a, b) => (a.vote_count || 0) - (b.vote_count || 0));
            const altPoster = variant === "criterion"
              ? sorted.find(p => p.file_path !== best.poster_path && (p.iso_639_1 === "en" || p.iso_639_1 === null))
              : sorted.find(p => p.file_path !== best.poster_path);
            if (altPoster) {
              remotePosterUrl = `https://image.tmdb.org/t/p/w500${altPoster.file_path}`;
            }
          }
        } catch { /* fall back to default poster */ }
      }

      if (!remotePosterUrl) { json(response, 200, { matched: false, movieId }); return; }
      const localPosterUrl = await downloadPoster(remotePosterUrl, movieId);
      if (!localPosterUrl) { json(response, 200, { matched: false, movieId }); return; }
      const detailUrl = `https://api.themoviedb.org/3/movie/${best.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
      const detailResult = await fetchJson(detailUrl);
      const detail = detailResult.data || {};
      const director = detail.credits?.crew?.find((c) => c.job === "Director")?.name || null;
      const genres = detail.genres?.map((g) => g.name).join(", ") || null;
      const changes = { posterUrl: localPosterUrl, tmdbId: best.id };
      if (!year && best.release_date) changes.year = Number(best.release_date.slice(0, 4));
      if (director) changes.director = director;
      if (genres) changes.genre = genres;
      if (detail.runtime) changes.runtime = detail.runtime;
      if (detail.overview) changes.overview = detail.overview;
      const updated = await updateCatalogMovie(movieId, sanitizeEditablePayload(changes));
      const records = await loadCatalogRecords();
      await persistStaticCatalog(records);
      json(response, 200, { matched: true, movieId, movie: updated ? { ...updated, rowIndex: undefined } : null });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/poster/download") {
      const body = await readRequestBody(request);
      const { remoteUrl, movieId } = body ? JSON.parse(body) : {};
      if (!remoteUrl || !movieId) { json(response, 400, { error: "remoteUrl and movieId required" }); return; }
      const localUrl = await downloadPoster(remoteUrl, movieId);
      json(response, 200, { localUrl });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/artwork/download") {
      const body = await readRequestBody(request);
      const { remoteUrl, movieId, role } = body ? JSON.parse(body) : {};
      if (!remoteUrl || !movieId) { json(response, 400, { error: "remoteUrl and movieId required" }); return; }
      const localUrl = await downloadArtworkAsset(remoteUrl, movieId, role || "asset");
      json(response, 200, { localUrl });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/config") {
      json(response, 200, {
        hasTmdbKey: Boolean(TMDB_API_KEY),
        hasOmdbKey: Boolean(OMDB_API_KEY),
      });
      return;
    }

    const requestedPath = decodeURIComponent(url.pathname);
    const safePath = requestedPath === "/" ? "/index.html" : requestedPath;
    const filePath = path.normalize(path.join(rootDir, safePath));

    if (!filePath.startsWith(rootDir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=300",
    });
    response.end(file);
  } catch (error) {
    console.error(error);
    if (error?.code === "ENOENT") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const statusCode = error instanceof SyntaxError ? 400 : 500;
    json(response, statusCode, {
      error: statusCode === 400 ? "Invalid request body." : "Server error.",
    });
  }
});

await backupWorkbook();

server.listen(port, host, () => {
  console.log(`Movie Directory is running at http://127.0.0.1:${port}`);
  for (const url of getNetworkUrls(port)) {
    console.log(`Mobile test URL: ${url}`);
  }
  if (!TMDB_API_KEY) console.log("Note: Set TMDB_API_KEY env var for movie metadata lookups.");
  if (!OMDB_API_KEY) console.log("Note: Set OMDB_API_KEY env var for OMDb integration.");
});
