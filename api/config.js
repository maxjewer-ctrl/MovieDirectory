export default function handler(req, res) {
  res.status(200).json({
    hasTmdbKey: Boolean(process.env.TMDB_API_KEY),
    hasOmdbKey: Boolean(process.env.OMDB_API_KEY),
  });
}
