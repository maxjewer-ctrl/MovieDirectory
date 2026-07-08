// Vercel serverless function — mirrors the /api/tmdb/director logic from serve.mjs.
// Resolves a director by name and returns their directed filmography from TMDb.
// Uses Node 18+ global fetch; no filesystem access needed.

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";

async function fetchWithTimeout(url, opts = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function fetchJson(url) {
  return fetchWithTimeout(url, { headers: { "User-Agent": "MovieDirectory/1.0" } })
    .then((r) => r.json())
    .catch(() => null);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const name = req.query?.name;
  if (!name) { res.status(400).json({ error: "Missing query param name" }); return; }
  if (!TMDB_API_KEY) { res.status(503).json({ error: "TMDb API key not configured." }); return; }

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&include_adult=false`;
    const searchData = await fetchJson(searchUrl);
    const people = searchData?.results || [];
    // Prefer people whose primary craft is directing, then by popularity.
    const person = [...people].sort((a, b) => {
      const aDir = a.known_for_department === "Directing" ? 1 : 0;
      const bDir = b.known_for_department === "Directing" ? 1 : 0;
      if (aDir !== bDir) return bDir - aDir;
      return (b.popularity || 0) - (a.popularity || 0);
    })[0];

    if (!person) { res.status(200).json({ directorName: name, films: [] }); return; }

    const creditsUrl = `https://api.themoviedb.org/3/person/${person.id}/movie_credits?api_key=${TMDB_API_KEY}`;
    const creditsData = await fetchJson(creditsUrl);
    const crew = creditsData?.crew || [];
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

    res.status(200).json({ directorId: person.id, directorName: person.name || name, films });
  } catch (error) {
    console.error("Director filmography error:", error);
    res.status(502).json({ error: "Failed to load director filmography." });
  }
}
