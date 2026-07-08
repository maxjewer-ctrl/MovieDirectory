// Vercel serverless function — mirrors the /api/artwork/candidates logic from serve.mjs.
// Uses Node 18+ global fetch; no filesystem access needed.

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";

// ── helpers ──────────────────────────────────────────────────────────────────

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
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

function buildArtworkSearchQueries(movie) {
  const titleVariants = buildArtworkTitleSearchVariants(movie.title);
  const format = String(movie.primaryFormat || "").toLowerCase();
  const is4k = format.includes("4k");
  const queries = [];

  for (const title of titleVariants.slice(0, 2)) {
    if (movie.steelbook) {
      queries.push(`site:blu-ray.com/movies ${title} steelbook ${is4k ? "4K " : ""}blu-ray`);
    }
    if (movie.criterion) {
      queries.push(`site:blu-ray.com/movies ${title} criterion collection`);
    }
    if (is4k) {
      queries.push(`site:blu-ray.com/movies ${title} 4K blu-ray`);
    }
    queries.push(`site:blu-ray.com/movies ${title} blu-ray`);
    if (movie.year) {
      queries.push(`site:blu-ray.com/movies ${title} ${movie.year}`);
    }
  }

  return [...new Set(queries)];
}

function decodeXmlEntities(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

function extractFirstMatch(text, regex) {
  const match = text?.match(regex);
  return match?.[1] || null;
}

function normalizeImageUrl(url) {
  if (!url) return null;
  return url.replace(/&amp;/g, "&").replace(/\?[^?]*$/, "");
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchBingRssLinks(query) {
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }, 5000);
    if (!response.ok) return [];
    const text = await response.text();
    if (!/<rss/i.test(text)) return [];
    return [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
      const itemXml = match[1];
      return {
        url: decodeXmlEntities(extractFirstMatch(itemXml, /<link>([\s\S]*?)<\/link>/i)),
        title: decodeXmlEntities(extractFirstMatch(itemXml, /<title>([\s\S]*?)<\/title>/i)),
        description: decodeXmlEntities(extractFirstMatch(itemXml, /<description>([\s\S]*?)<\/description>/i)),
      };
    }).filter((item) => item.url);
  } catch {
    return [];
  }
}

async function fetchBluRayReleaseArtwork(releaseUrl) {
  try {
    const response = await fetchWithTimeout(releaseUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }, 5000);
    if (!response.ok) return null;
    const html = await response.text();
    const title = decodeHtmlEntities(extractFirstMatch(html, /<title>([^<]+)<\/title>/i) || "");
    const description = decodeHtmlEntities(extractFirstMatch(html, /<meta name="description" content="([^"]+)"/i) || "");
    const largeUrl = normalizeImageUrl(extractFirstMatch(html, /property="og:image" content="([^"]+)"/i));
    const frontUrl = normalizeImageUrl(extractFirstMatch(html, /(https:\/\/images\.static-bluray\.com\/movies\/covers\/\d+_front\.jpg[^"'\\<\s]*)/i));
    const backUrl = normalizeImageUrl(extractFirstMatch(html, /(https:\/\/images\.static-bluray\.com\/movies\/covers\/\d+_back\.jpg[^"'\\<\s]*)/i));
    const slipUrl = normalizeImageUrl(extractFirstMatch(html, /(https:\/\/images\.static-bluray\.com\/movies\/covers\/\d+_slip\.jpg[^"'\\<\s]*)/i));
    return { releaseUrl, title, description, frontUrl: frontUrl || largeUrl, backUrl, slipUrl };
  } catch {
    return null;
  }
}

// Words excluded from title-word matching (too common or format-specific to be discriminating)
const TITLE_STOP = new Set([
  "the","a","an","of","in","is","it","to","and","or","for","at","by","its","on","as","with","from",
]);
const FORMAT_TERMS = new Set([
  "blu-ray","bluray","4k","ultra","uhd","dvd","disc","digital","remastered","remaster",
]);

function significantTitleWords(title) {
  return normalizeTitleForSearch(title)
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !TITLE_STOP.has(w) && !FORMAT_TERMS.has(w) && !/^\d{4}$/.test(w));
}

function buildTitleWordRegex(title) {
  return significantTitleWords(title)
    .slice(0, 6)
    .map((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "i"));
}

function extraWordPenalty(movieTitle, releaseTitle) {
  const movieWords = new Set(significantTitleWords(movieTitle));
  const releaseWords = significantTitleWords(releaseTitle || "");
  return releaseWords.filter((w) => !movieWords.has(w)).length * -10;
}

function scoreReleaseMatch(movie, release) {
  const format = String(movie.primaryFormat || "").toLowerCase();
  const is4k = format.includes("4k");
  const haystack = `${release.title} ${release.description}`.toLowerCase();
  let score = 0;
  const titleRegexes = buildTitleWordRegex(movie.title);
  const matchCount = titleRegexes.filter((rx) => rx.test(haystack)).length;
  score += matchCount * 14;
  // Bonus when every significant title word is found — rewards exact/complete matches
  if (titleRegexes.length > 0 && matchCount === titleRegexes.length) score += 18;
  // Penalty for extra significant words in the release title not present in the movie title
  score += extraWordPenalty(movie.title, release.title);
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
    if (!existing) { deduped.set(key, candidate); continue; }
    const ec = [existing.frontUrl, existing.backUrl, existing.spineUrl].filter(Boolean).length;
    const cc = [candidate.frontUrl, candidate.backUrl, candidate.spineUrl].filter(Boolean).length;
    const replace = (candidate.score || 0) > (existing.score || 0) || ((candidate.score || 0) === (existing.score || 0) && cc > ec);
    deduped.set(key, replace
      ? { ...candidate, backUrl: candidate.backUrl || existing.backUrl || null, spineUrl: candidate.spineUrl || existing.spineUrl || null }
      : { ...existing,  backUrl: existing.backUrl  || candidate.backUrl  || null, spineUrl: existing.spineUrl  || candidate.spineUrl  || null });
  }
  return [...deduped.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
}

function sortTmdbImages(images, preferredLanguages = []) {
  const languageRank = new Map(preferredLanguages.map((lang, i) => [lang, i]));
  return [...(images || [])].sort((a, b) => {
    const al = languageRank.has(a.iso_639_1) ? languageRank.get(a.iso_639_1) : preferredLanguages.length;
    const bl = languageRank.has(b.iso_639_1) ? languageRank.get(b.iso_639_1) : preferredLanguages.length;
    if (al !== bl) return al - bl;
    const as = (a.vote_average || 0) * 1000 + (a.vote_count || 0);
    const bs = (b.vote_average || 0) * 1000 + (b.vote_count || 0);
    if (as !== bs) return bs - as;
    return (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0);
  });
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
  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`;
    const resp = await fetchWithTimeout(url, { headers: { "User-Agent": "MovieDirectory/1.0" } }, 5000);
    const data = await resp.json();
    const backdrops = sortTmdbImages(data?.backdrops || [], [null]);
    const logos = sortTmdbImages(data?.logos || [], ["en", null]);
    return {
      backdropUrl: backdrops[0]?.file_path ? `https://image.tmdb.org/t/p/w780${backdrops[0].file_path}` : null,
      logoUrl: logos[0]?.file_path ? `https://image.tmdb.org/t/p/original${logos[0].file_path}` : null,
    };
  } catch {
    return { backdropUrl: null, logoUrl: null };
  }
}

async function buildBluRayArtworkCandidates(movie, fallbackCaseArt) {
  const queries = buildArtworkSearchQueries(movie).slice(0, 4);

  // Run searches in parallel to stay within Vercel's function timeout
  const searchResults = await Promise.all(queries.map((q) => searchBingRssLinks(q)));
  const releaseUrls = [];
  for (const results of searchResults) {
    for (const result of results) {
      if (!result.url?.includes("blu-ray.com/movies/")) continue;
      if (!releaseUrls.includes(result.url)) releaseUrls.push(result.url);
      if (releaseUrls.length >= 5) break;
    }
    if (releaseUrls.length >= 5) break;
  }

  const releases = await Promise.all(releaseUrls.map((url) => fetchBluRayReleaseArtwork(url)));
  const candidates = [];
  for (const release of releases) {
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
        ...shared, faceLabel: "Front", frontUrl: release.frontUrl,
      });
    }
    if (release.slipUrl) {
      candidates.push({
        id: buildArtworkCandidateId([movie.id, "bluray", "slip", candidates.length + 1]),
        ...shared, faceLabel: "Slip", frontUrl: release.slipUrl, score: score + 2,
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}

// ── handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload = req.body || {};

    const [fallbackCaseArt, tmdbImagesData] = await Promise.all([
      getTmdbCaseArt(payload.tmdbId),
      (TMDB_API_KEY && payload.tmdbId)
        ? fetchWithTimeout(
            `https://api.themoviedb.org/3/movie/${payload.tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`,
            { headers: { "User-Agent": "MovieDirectory/1.0" } },
            5000
          ).then((r) => r.json()).catch(() => null)
        : Promise.resolve(null),
    ]);

    const tmdbPosters = tmdbImagesData
      ? sortTmdbImages(tmdbImagesData.posters || [], ["en", null]).slice(0, 10).map((p) => ({
          url: `https://image.tmdb.org/t/p/w500${p.file_path}`,
          width: p.width,
          height: p.height,
        }))
      : [];

    const [bluRayCandidates, tmdbCandidates] = await Promise.all([
      buildBluRayArtworkCandidates(payload, fallbackCaseArt),
      Promise.resolve(buildTmdbPosterCandidates(payload, tmdbPosters, fallbackCaseArt)),
    ]);

    const candidates = dedupeArtworkCandidates([...bluRayCandidates, ...tmdbCandidates]);
    res.status(200).json({ candidates });
  } catch (error) {
    console.error("Artwork candidates error:", error);
    res.status(500).json({ candidates: [] });
  }
}
