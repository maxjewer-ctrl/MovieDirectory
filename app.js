const STORAGE_KEY = "movie-directory-state-v6";
const DEFAULT_LISTS = [
  { id: "list-friday-night-picks", name: "Friday Night Picks", movieIds: [] },
  { id: "list-criterion-queue", name: "Criterion Queue", movieIds: [] },
  { id: "list-family-watch", name: "Family Watch", movieIds: [] },
  { id: "list-halloween", name: "Halloween", movieIds: [] },
];

const SPECIAL_FEATURE_PRESETS = [
  "Audio Commentary",
  "Behind the Scenes",
  "Deleted Scenes",
  "Documentary",
  "Featurette",
  "Interview",
  "Trailer",
  "Booklet / Insert",
  "Slipcover",
  "Poster / Art Cards",
  "Digital Copy",
  "Director's Cut",
  "Alternate Ending",
  "Storyboards",
  "Isolated Score",
];

const appState = {
  theme: "warm",
  search: "",
  view: "grid",
  sort: "inventory",
  group: "none",
  selectedMovieId: null,
  activeFilter: { type: "preset", value: "all" },
  activeQuickFilter: "all",
  favorites: new Set(),
  lists: [],
  saveStatus: { text: "Live from catalog", tone: "idle" },
  addMovieTab: "manual",
  pendingSpecialFeatures: [],
};

let movies = [];
let apiConfig = { hasTmdbKey: false, hasOmdbKey: false };
const runtimeState = {
  mode: "loading",
  canSave: true,
  message: "",
};

const dom = {
  libraryNav: document.querySelector("#library-nav"),
  genreNav: document.querySelector("#genre-nav"),
  listNav: document.querySelector("#list-nav"),
  playlistNav: document.querySelector("#playlist-nav"),
  directorNav: document.querySelector("#director-nav"),
  searchInput: document.querySelector("#search-input"),
  themeSelect: document.querySelector("#theme-select"),
  sortSelect: document.querySelector("#sort-select"),
  groupSelect: document.querySelector("#group-select"),
  viewsMenuButton: document.querySelector("#views-menu-button"),
  viewsMenuCurrent: document.querySelector("#views-menu-current"),
  viewsMenuPanel: document.querySelector("#views-menu-panel"),
  viewOptions: [...document.querySelectorAll("[data-view-option]")],
  addMovieButton: document.querySelector("#add-movie-button"),
  newListButton: document.querySelector("#new-list-button"),
  detailCreateListButton: document.querySelector("#detail-create-list-button"),
  runtimeBanner: document.querySelector("#runtime-banner"),
  activeContextLabel: document.querySelector("#active-context-label"),
  resultsHeading: document.querySelector("#results-heading"),
  resultsSummary: document.querySelector("#results-summary"),
  collectionContainer: document.querySelector("#collection-container"),
  detailEmpty: document.querySelector("#detail-empty"),
  detailContent: document.querySelector("#detail-content"),
  detailPoster: document.querySelector("#detail-poster"),
  detailSection: document.querySelector("#detail-section"),
  detailTitle: document.querySelector("#detail-title"),
  detailSubtitle: document.querySelector("#detail-subtitle"),
  detailTags: document.querySelector("#detail-tags"),
  detailFavoriteButton: document.querySelector("#detail-favorite-button"),
  detailLists: document.querySelector("#detail-lists"),
  detailNumber: document.querySelector("#detail-number"),
  detailCollection: document.querySelector("#detail-collection"),
  detailEdition: document.querySelector("#detail-edition"),
  detailYear: document.querySelector("#detail-year"),
  detailDirector: document.querySelector("#detail-director"),
  detailRuntime: document.querySelector("#detail-runtime"),
  detailUpc: document.querySelector("#detail-upc"),
  detailOverviewBlock: document.querySelector("#detail-overview-block"),
  detailOverview: document.querySelector("#detail-overview"),
  detailSaveStatus: document.querySelector("#detail-save-status"),
  detailPrimaryFormat: document.querySelector("#detail-primary-format"),
  detailSteelbook: document.querySelector("#detail-steelbook"),
  detailCriterion: document.querySelector("#detail-criterion"),
  detailMoviesAnywhere: document.querySelector("#detail-movies-anywhere"),
  detailWatchStatus: document.querySelector("#detail-watch-status"),
  detailRating: document.querySelector("#detail-rating"),
  detailNotes: document.querySelector("#detail-notes"),
  detailPurchasePrice: document.querySelector("#detail-purchase-price"),
  detailEstimatedValue: document.querySelector("#detail-estimated-value"),
  detailCondition: document.querySelector("#detail-condition"),
  detailValueSource: document.querySelector("#detail-value-source"),
  detailSpecialFeatures: document.querySelector("#detail-special-features"),
  detailEditFeaturesButton: document.querySelector("#detail-edit-features-button"),
  listModal: document.querySelector("#list-modal"),
  listForm: document.querySelector("#list-form"),
  listNameInput: document.querySelector("#list-name-input"),
  addMovieModal: document.querySelector("#add-movie-modal"),
  addMovieForm: document.querySelector("#add-movie-form"),
  tmdbSearchInput: document.querySelector("#tmdb-search-input"),
  tmdbSearchButton: document.querySelector("#tmdb-search-button"),
  tmdbResults: document.querySelector("#tmdb-results"),
  upcInput: document.querySelector("#upc-input"),
  upcLookupButton: document.querySelector("#upc-lookup-button"),
  upcResults: document.querySelector("#upc-results"),
  featuresModal: document.querySelector("#features-modal"),
  featuresChecklist: document.querySelector("#features-checklist"),
  customFeatureInput: document.querySelector("#custom-feature-input"),
  addCustomFeatureButton: document.querySelector("#add-custom-feature-button"),
  saveFeaturesButton: document.querySelector("#save-features-button"),
  addSpecialFeatures: document.querySelector("#add-special-features"),
  addSpecialFeaturesInput: document.querySelector("#add-special-features-input"),
  cardTemplate: document.querySelector("#movie-card-template"),
  rowTemplate: document.querySelector("#movie-row-template"),
  sidebarToggle: document.querySelector("#sidebar-toggle"),
  sidebar: document.querySelector("#sidebar"),
};

const libraryFilterDefinitions = [
  {
    id: "all",
    label: "All Movies",
    kindLabel: "Library",
    description: "Every title in the collection.",
    matches: () => true,
  },
  {
    id: "favorites",
    label: "Favorites",
    kindLabel: "Collection",
    description: "Pinned favorites from the library.",
    matches: (movie) => appState.favorites.has(movie.id),
  },
  {
    id: "recent",
    label: "Recently Added",
    kindLabel: "Collection",
    description: "Latest catalog additions.",
    matches: (movie) => movie.inventoryNumber > movies.length - 16,
  },
  {
    id: "format-4k",
    label: "4K",
    kindLabel: "Format",
    description: "Ultra HD editions and combo packs.",
    matches: (movie) => String(movie.primaryFormat || "").includes("4K"),
  },
  {
    id: "format-bluray",
    label: "Blu-ray",
    kindLabel: "Format",
    description: "Standard Blu-ray titles.",
    matches: (movie) => String(movie.primaryFormat || "").includes("Blu-ray"),
  },
  {
    id: "format-dvd",
    label: "DVD",
    kindLabel: "Format",
    description: "DVD shelf picks.",
    matches: (movie) => movie.primaryFormat === "DVD",
  },
  {
    id: "criterion",
    label: "Criterion",
    kindLabel: "Edition",
    description: "Criterion editions and releases.",
    matches: (movie) => movie.criterion || movie.tags.includes("Criterion"),
  },
  {
    id: "steelbook",
    label: "Steelbook",
    kindLabel: "Edition",
    description: "Steelbook packaging variants.",
    matches: (movie) => movie.steelbook || movie.tags.includes("Steelbook"),
  },
  {
    id: "disney",
    label: "Disney",
    kindLabel: "Studio",
    description: "Disney-branded titles when present.",
    matches: (movie) => movie.searchBlob.includes("disney"),
  },
  {
    id: "marvel",
    label: "Marvel",
    kindLabel: "Franchise",
    description: "Marvel and superhero titles.",
    matches: (movie) => movie.section === "Marvel / Superhero" || movie.tags.includes("Superhero") || movie.searchBlob.includes("marvel"),
  },
  {
    id: "ghibli",
    label: "Studio Ghibli",
    kindLabel: "Studio",
    description: "Animated Studio Ghibli films.",
    matches: (movie) => movie.section === "Studio Ghibli" || movie.tags.includes("Studio Ghibli"),
  },
  {
    id: "movies-anywhere",
    label: "Movies Anywhere",
    kindLabel: "Service",
    description: "Titles connected to Movies Anywhere.",
    matches: (movie) => Boolean(movie.moviesAnywhere),
  },
  {
    id: "unwatched",
    label: "Unwatched",
    kindLabel: "Watch Status",
    description: "Titles still waiting for a watch.",
    matches: (movie) => !movie.watchStatus || movie.watchStatus === "Unwatched",
  },
  {
    id: "top-rated",
    label: "Top Rated",
    kindLabel: "Rating",
    description: "Your 8/10-and-up picks.",
    matches: (movie) => movie.personalRating != null && movie.personalRating >= 8,
  },
  {
    id: "needs-value",
    label: "Needs Value",
    kindLabel: "Value Tracking",
    description: "Titles missing an estimated value.",
    matches: (movie) => movie.estimatedValue == null || movie.estimatedValue === 0,
  },
];

const sectionOrder = [
  "General 4K / Blu-ray",
  "Animation / Family",
  "Studio Ghibli",
  "Action / Drama / Sci-Fi",
  "Horror",
  "Criterion Collection",
  "Director Collections",
  "Marvel / Superhero",
];

const formatOrder = ["DVD", "Blu-ray", "4K", "4K + Blu-ray"];

function getLibraryFilterDefinition(filterId) {
  return libraryFilterDefinitions.find((definition) => definition.id === filterId) || libraryFilterDefinitions[0];
}

function getMovieGenres(movie) {
  return String(movie.genre || "")
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
}

function getGenreFilters() {
  const genreCounts = new Map();
  for (const movie of movies) {
    for (const genre of getMovieGenres(movie)) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }
  }

  return [...genreCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }));
}

function getDirectorFilters() {
  const directorCounts = new Map();
  for (const movie of movies) {
    if (!movie.director) continue;
    directorCounts.set(movie.director, (directorCounts.get(movie.director) || 0) + 1);
  }

  return [...directorCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }));
}

function buildAiPlaylists() {
  const playlists = [
    {
      id: "ai-family-night",
      label: "Family Movie Night",
      description: "Animation and family-friendly picks for an easy watch.",
      movieIds: sortMovies(movies.filter((movie) => {
        const genres = getMovieGenres(movie);
        return genres.includes("Family") || genres.includes("Animation") || movie.tags.includes("Family");
      })).map((movie) => movie.id),
    },
    {
      id: "ai-blockbuster-run",
      label: "Blockbuster Run",
      description: "Action, sci-fi, superhero, and big-screen spectacle.",
      movieIds: sortMovies(movies.filter((movie) => {
        const genres = getMovieGenres(movie);
        return movie.tags.includes("Superhero")
          || genres.includes("Action")
          || genres.includes("Science Fiction")
          || genres.includes("Adventure");
      })).map((movie) => movie.id),
    },
    {
      id: "ai-criterion-corner",
      label: "Criterion Corner",
      description: "Criterion-heavy auteur and prestige picks.",
      movieIds: sortMovies(movies.filter((movie) => movie.criterion || movie.tags.includes("Criterion"))).map((movie) => movie.id),
    },
    {
      id: "ai-after-midnight",
      label: "After Midnight",
      description: "Horror, thrillers, and darker late-night watches.",
      movieIds: sortMovies(movies.filter((movie) => {
        const genres = getMovieGenres(movie);
        return movie.section === "Horror" || genres.includes("Horror") || genres.includes("Thriller");
      })).map((movie) => movie.id),
    },
  ];

  const [topDirector] = getDirectorFilters();
  if (topDirector) {
    playlists.unshift({
      id: "ai-director-deep-dive",
      label: `${topDirector.label} Deep Dive`,
      description: "A concentrated run through the largest director shelf in the library.",
      movieIds: sortMovies(movies.filter((movie) => movie.director === topDirector.label)).map((movie) => movie.id),
    });
  }

  return playlists.filter((playlist) => playlist.movieIds.length > 0);
}

function getAiPlaylistById(playlistId) {
  return buildAiPlaylists().find((playlist) => playlist.id === playlistId) || null;
}

function slugifyListName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setSaveStatus(text, tone = "idle") {
  appState.saveStatus = { text, tone };
  if (!dom.detailSaveStatus) return;
  dom.detailSaveStatus.textContent = text;
  dom.detailSaveStatus.classList.toggle("is-error", tone === "error");
  dom.detailSaveStatus.classList.toggle("is-saving", tone === "saving");
}

function setRuntimeState(mode, canSave, message = "") {
  runtimeState.mode = mode;
  runtimeState.canSave = canSave;
  runtimeState.message = message;
}

function renderRuntimeBanner() {
  if (!dom.runtimeBanner) return;
  if (!runtimeState.message) {
    dom.runtimeBanner.hidden = true;
    dom.runtimeBanner.textContent = "";
    return;
  }

  dom.runtimeBanner.hidden = false;
  dom.runtimeBanner.innerHTML = `
    <div>
      <strong>${runtimeState.canSave ? "Connected mode" : "Read-only mode"}</strong>
      <span>${escapeHtml(runtimeState.message)}</span>
    </div>
  `;
}

function getPrimaryFormat(movie) {
  if (movie.primaryFormat) return movie.primaryFormat;
  return "Blu-ray";
}

function getCollectionType(movie) {
  if (movie.collectionType) return movie.collectionType;
  if (movie.tags.includes("Series")) return "Series";
  if (movie.tags.includes("Trilogy")) return "Trilogy";
  if (movie.tags.includes("Collection")) return "Collection";
  if (movie.directorCollection) return "Director Set";
  return "Single Feature";
}

function buildPosterPalette(seedText) {
  let hash = 0;
  for (const char of seedText) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  const start = `hsl(${hue} 38% 24%)`;
  const end = `hsl(${(hue + 48) % 360} 42% 36%)`;
  return { start, end };
}

function buildMovieIndex(rawMovies) {
  return rawMovies.map((movie) => {
    const collectionType = getCollectionType(movie);
    const primaryFormat = getPrimaryFormat(movie);
    const searchBlob = [
      movie.title,
      movie.rawTitle,
      movie.section,
      movie.subsection,
      collectionType,
      primaryFormat,
      movie.criterion ? "criterion" : "",
      movie.steelbook ? "steelbook" : "",
      movie.moviesAnywhere ? "movies anywhere" : "",
      movie.director || "",
      movie.upc || "",
      movie.genre || "",
      ...(movie.tags || []),
      ...(movie.editionNotes || []),
      ...(movie.specialFeatures || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      ...movie,
      collectionType,
      primaryFormat,
      searchBlob,
      posterPalette: buildPosterPalette(movie.title),
    };
  });
}

function setMovies(rawMovies) {
  movies = buildMovieIndex(rawMovies);
}

function buildSeedLists() {
  const seededLists = new Map(
    DEFAULT_LISTS.map((list) => [list.name, { id: list.id, name: list.name, movieIds: [] }]),
  );

  for (const movie of movies) {
    const names = Array.isArray(movie.seedLists) ? movie.seedLists : [];
    for (const name of names) {
      const trimmed = String(name).trim();
      if (!trimmed) continue;
      if (!seededLists.has(trimmed)) {
        seededLists.set(trimmed, {
          id: `list-${slugifyListName(trimmed) || "custom"}`,
          name: trimmed,
          movieIds: [],
        });
      }
      seededLists.get(trimmed).movieIds.push(movie.id);
    }
  }

  return [...seededLists.values()];
}

function buildSeedFavorites() {
  return new Set(
    movies.filter((movie) => Boolean(movie.seedFavorite)).map((movie) => movie.id),
  );
}

function migrateActiveFilter(rawFilter, rawQuickFilter) {
  if (!rawFilter || typeof rawFilter !== "object") {
    if (rawQuickFilter && rawQuickFilter !== "all") {
      return migrateActiveFilter({ type: rawQuickFilter, value: null }, "all");
    }
    return { type: "preset", value: "all" };
  }

  if (rawFilter.type === "preset" && rawFilter.value) {
    return rawFilter;
  }

  if (rawFilter.type === "all") return { type: "preset", value: "all" };
  if (rawFilter.type === "favorites") return { type: "preset", value: "favorites" };
  if (rawFilter.type === "recent") return { type: "preset", value: "recent" };
  if (rawFilter.type === "criterion") return { type: "preset", value: "criterion" };
  if (rawFilter.type === "steelbook") return { type: "preset", value: "steelbook" };
  if (rawFilter.type === "studio-ghibli") return { type: "preset", value: "ghibli" };
  if (rawFilter.type === "unwatched") return { type: "preset", value: "unwatched" };
  if (rawFilter.type === "top-rated") return { type: "preset", value: "top-rated" };
  if (rawFilter.type === "needs-value") return { type: "preset", value: "needs-value" };
  if (rawFilter.type === "lists") return { type: "preset", value: "all" };

  if (["list", "director", "genre", "playlist", "section"].includes(rawFilter.type)) {
    return rawFilter;
  }

  if (rawFilter.type === "format" && rawFilter.value) {
    if (rawFilter.value === "DVD") return { type: "preset", value: "format-dvd" };
    if (rawFilter.value === "Blu-ray") return { type: "preset", value: "format-bluray" };
    if (String(rawFilter.value).includes("4K")) return { type: "preset", value: "format-4k" };
  }

  if (rawQuickFilter && rawQuickFilter !== "all") {
    return migrateActiveFilter({ type: rawQuickFilter, value: null }, "all");
  }

  return { type: "preset", value: "all" };
}

function loadState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    appState.lists = buildSeedLists();
    appState.favorites = buildSeedFavorites();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    appState.theme = parsed.theme || "warm";
    appState.view = parsed.view || appState.view;
    appState.sort = parsed.sort || appState.sort;
    appState.group = parsed.group || appState.group;
    appState.search = parsed.search || "";
    appState.activeFilter = migrateActiveFilter(parsed.activeFilter, parsed.activeQuickFilter);
    appState.activeQuickFilter = parsed.activeQuickFilter || "all";
    appState.selectedMovieId = parsed.selectedMovieId || null;
    appState.favorites = new Set(parsed.favorites || [...buildSeedFavorites()]);
    const storedLists = Array.isArray(parsed.lists) && parsed.lists.length
      ? parsed.lists
      : buildSeedLists();
    appState.lists = storedLists.map((list) => ({
      id: list.id,
      name: list.name,
      movieIds: Array.isArray(list.movieIds) ? list.movieIds : [],
    }));
  } catch (error) {
    console.error("Could not parse saved app state.", error);
    appState.lists = buildSeedLists();
    appState.favorites = buildSeedFavorites();
  }
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", appState.theme);
  dom.themeSelect.value = appState.theme;
}

function saveState() {
  const payload = {
    theme: appState.theme,
    view: appState.view,
    sort: appState.sort,
    group: appState.group,
    search: appState.search,
    activeFilter: appState.activeFilter,
    activeQuickFilter: appState.activeQuickFilter,
    selectedMovieId: appState.selectedMovieId,
    favorites: [...appState.favorites],
    lists: appState.lists,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function getMovieById(movieId) {
  return movies.find((movie) => movie.id === movieId) || null;
}

function replaceMovie(updatedMovie) {
  if (!updatedMovie) return;
  const indexedMovie = buildMovieIndex([updatedMovie])[0];
  movies = movies.map((movie) => (movie.id === updatedMovie.id ? indexedMovie : movie));
}

async function loadCatalogFromSource() {
  try {
    const response = await fetch("./api/catalog", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Catalog request failed with ${response.status}`);
    }
    const payload = await response.json();
    setRuntimeState("api", true, "");
    return payload.movies || [];
  } catch (error) {
    console.warn("Falling back to bundled movie data.", error);
    setRuntimeState(
      "fallback",
      false,
      "This page is not connected to the live catalog server. Open http://127.0.0.1:4173 after running npm run serve if you want changes to save.",
    );
    return window.MOVIE_DATA || [];
  }
}

async function loadApiConfig() {
  try {
    const response = await fetch("./api/config");
    if (response.ok) apiConfig = await response.json();
  } catch { /* ignore */ }
}

function ensureSelectedMovie() {
  if (movies.length === 0) {
    appState.selectedMovieId = null;
    return;
  }
  if (!getMovieById(appState.selectedMovieId)) {
    appState.selectedMovieId = movies[0].id;
  }
}

function getVisibleMovies() {
  const search = appState.search.trim().toLowerCase();
  let visible = movies.filter((movie) => matchesPrimaryFilter(movie));

  if (search) {
    visible = visible.filter((movie) => movie.searchBlob.includes(search));
  }

  return sortMovies(visible);
}

function matchesPrimaryFilter(movie) {
  const filter = appState.activeFilter;
  switch (filter.type) {
    case "preset":
      return getLibraryFilterDefinition(filter.value)?.matches(movie) ?? true;
    case "section":
      return movie.section === filter.value;
    case "genre":
      return getMovieGenres(movie).includes(filter.value);
    case "director":
      return movie.director === filter.value || movie.directorCollection === filter.value;
    case "list":
      return getListById(filter.value)?.movieIds.includes(movie.id) ?? false;
    case "playlist":
      return getAiPlaylistById(filter.value)?.movieIds.includes(movie.id) ?? false;
    default:
      return true;
  }
}

function sortMovies(movieList) {
  const sorted = [...movieList];
  sorted.sort((left, right) => {
    if (appState.sort === "title") {
      return left.sortTitle.localeCompare(right.sortTitle);
    }
    if (appState.sort === "section") {
      const sectionDiff = left.section.localeCompare(right.section);
      return sectionDiff || left.sortTitle.localeCompare(right.sortTitle);
    }
    if (appState.sort === "favorites") {
      const favDiff = Number(appState.favorites.has(right.id)) - Number(appState.favorites.has(left.id));
      return favDiff || left.sortTitle.localeCompare(right.sortTitle);
    }
    if (appState.sort === "value") {
      const valDiff = (right.estimatedValue || 0) - (left.estimatedValue || 0);
      return valDiff || left.sortTitle.localeCompare(right.sortTitle);
    }
    if (appState.sort === "rating") {
      const ratDiff = (right.personalRating || 0) - (left.personalRating || 0);
      return ratDiff || left.sortTitle.localeCompare(right.sortTitle);
    }
    return left.inventoryNumber - right.inventoryNumber;
  });
  return sorted;
}

function groupMovies(movieList) {
  if (appState.group === "none") {
    return [{ key: "all", label: "All Titles", movies: movieList }];
  }

  const groups = new Map();
  for (const movie of movieList) {
    let key = "";
    let label = "";
    if (appState.group === "section") {
      key = movie.section;
      label = movie.section;
    } else if (appState.group === "format") {
      key = movie.primaryFormat;
      label = movie.primaryFormat;
    } else if (appState.group === "director") {
      key = movie.director || "Unknown Director";
      label = movie.director || "Unknown Director";
    } else {
      key = movie.collectionType;
      label = movie.collectionType;
    }

    if (!groups.has(key)) {
      groups.set(key, { key, label, movies: [] });
    }
    groups.get(key).movies.push(movie);
  }

  return [...groups.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function getStats() {
  const totalValue = movies.reduce((sum, m) => sum + (m.estimatedValue || 0), 0);
  const totalInvested = movies.reduce((sum, m) => sum + (m.purchasePrice || 0), 0);
  const ratedMovies = movies.filter((m) => m.personalRating != null);
  const avgRating = ratedMovies.length
    ? (ratedMovies.reduce((sum, m) => sum + m.personalRating, 0) / ratedMovies.length).toFixed(1)
    : "—";

  return [
    { label: "Total Titles", value: movies.length },
    { label: "Favorites", value: appState.favorites.size },
    { label: "Collection Value", value: totalValue ? `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—" },
    { label: "Total Invested", value: totalInvested ? `$${totalInvested.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—" },
    { label: "Avg Rating", value: avgRating },
  ];
}

function getActiveSelectionMeta() {
  const filter = appState.activeFilter;

  if (filter.type === "preset") {
    const preset = getLibraryFilterDefinition(filter.value);
    return {
      contextLabel: preset.kindLabel,
      heading: preset.label,
      description: preset.description,
      isAll: preset.id === "all",
      type: filter.type,
    };
  }

  if (filter.type === "genre") {
    return {
      contextLabel: "Genre",
      heading: filter.value,
      description: "Titles matching this genre.",
      isAll: false,
      type: filter.type,
    };
  }

  if (filter.type === "director") {
    return {
      contextLabel: "Director",
      heading: filter.value,
      description: "Titles directed by this filmmaker.",
      isAll: false,
      type: filter.type,
    };
  }

  if (filter.type === "list") {
    return {
      contextLabel: "Custom List",
      heading: getListById(filter.value)?.name || "Custom List",
      description: "Titles saved to this user-created list.",
      isAll: false,
      type: filter.type,
    };
  }

  if (filter.type === "playlist") {
    const playlist = getAiPlaylistById(filter.value);
    return {
      contextLabel: "AI Playlist",
      heading: playlist?.label || "AI Playlist",
      description: playlist?.description || "AI-generated recommendations from your collection metadata.",
      isAll: false,
      type: filter.type,
    };
  }

  if (filter.type === "section") {
    return {
      contextLabel: "Category",
      heading: filter.value,
      description: "Titles in this catalog section.",
      isAll: false,
      type: filter.type,
    };
  }

  return {
    contextLabel: "Library",
    heading: "All Movies",
    description: "Every title in the collection.",
    isAll: true,
    type: "preset",
  };
}

function buildResultsSummary(meta, totalVisible) {
  const search = appState.search.trim();
  const countLabel = `${totalVisible} title${totalVisible === 1 ? "" : "s"}`;

  if (search && meta.isAll) {
    return `${countLabel} match "${search}".`;
  }

  if (search) {
    return `${countLabel} in ${meta.heading} matching "${search}".`;
  }

  if (meta.type === "list") {
    return `${countLabel} saved in this list.`;
  }

  if (meta.type === "playlist") {
    return `${countLabel} in this AI-generated playlist.`;
  }

  return `${countLabel} visible.`;
}

function getListById(listId) {
  return appState.lists.find((list) => list.id === listId) || null;
}

async function toggleFavorite(movieId) {
  if (appState.favorites.has(movieId)) {
    appState.favorites.delete(movieId);
  } else {
    appState.favorites.add(movieId);
  }
  saveState();
  render();
  await saveMovieMetadata(movieId, { seedFavorite: appState.favorites.has(movieId) });
}

async function toggleMovieInList(listId, movieId) {
  const list = getListById(listId);
  if (!list) return;
  if (list.movieIds.includes(movieId)) {
    list.movieIds = list.movieIds.filter((id) => id !== movieId);
  } else {
    list.movieIds = [...list.movieIds, movieId];
  }
  saveState();
  render();
  const movie = getMovieById(movieId);
  if (movie) {
    const memberLists = appState.lists
      .filter((l) => l.movieIds.includes(movieId))
      .map((l) => l.name);
    await saveMovieMetadata(movieId, { seedLists: memberLists });
  }
}

function createList(name) {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  const slug = slugifyListName(trimmedName);
  const uniqueId = `list-${slug || "custom"}-${Date.now().toString(36)}`;
  appState.lists.unshift({
    id: uniqueId,
    name: trimmedName,
    movieIds: appState.selectedMovieId ? [appState.selectedMovieId] : [],
  });
  appState.activeFilter = { type: "list", value: uniqueId };
  saveState();
  closeModal("list-modal");
  render();
}

function setActiveFilter(type, value = null) {
  appState.activeFilter = { type, value };
  if ((type === "list" || type === "playlist") && value) {
    appState.group = "none";
  }
  saveState();
  render();
}

function selectMovie(movieId) {
  appState.selectedMovieId = movieId;
  saveState();
  renderDetail();
}

function render() {
  const visibleMovies = getVisibleMovies();
  const groups = groupMovies(visibleMovies);

  renderNav();
  renderRuntimeBanner();
  renderHeader(visibleMovies);
  renderCollection(groups);
  renderDetail();
  syncControls();
}

function renderNav() {
  renderNavGroup(dom.libraryNav, libraryFilterDefinitions.map((filter) => ({
    label: filter.label,
    description: filter.description,
    count: movies.filter((movie) => filter.matches(movie)).length,
    active: appState.activeFilter.type === "preset" && appState.activeFilter.value === filter.id,
    onClick: () => setActiveFilter("preset", filter.id),
  })));

  renderNavGroup(dom.genreNav, getGenreFilters().map((genre) => ({
    label: genre.label,
    count: genre.count,
    active: appState.activeFilter.type === "genre" && appState.activeFilter.value === genre.label,
    onClick: () => setActiveFilter("genre", genre.label),
  })));

  renderNavGroup(dom.listNav, appState.lists.map((list) => ({
    label: list.name,
    description: list.movieIds.length ? buildListPreview(list) : "Empty list. Add titles from the detail panel.",
    count: list.movieIds.length,
    active: appState.activeFilter.type === "list" && appState.activeFilter.value === list.id,
    onClick: () => setActiveFilter("list", list.id),
  })), "No lists yet. Create one from the button above.");

  renderNavGroup(dom.playlistNav, buildAiPlaylists().map((playlist) => ({
    label: playlist.label,
    description: playlist.description,
    count: playlist.movieIds.length,
    active: appState.activeFilter.type === "playlist" && appState.activeFilter.value === playlist.id,
    onClick: () => setActiveFilter("playlist", playlist.id),
  })));

  renderNavGroup(dom.directorNav, getDirectorFilters().map((director) => ({
    label: director.label,
    count: director.count,
    active: appState.activeFilter.type === "director" && appState.activeFilter.value === director.label,
    onClick: () => setActiveFilter("director", director.label),
  })), "No repeat directors yet.");
}

function renderNavGroup(container, items, emptyMessage = "Nothing to show here yet.") {
  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "nav-empty";
    empty.textContent = emptyMessage;
    container.append(empty);
    return;
  }

  for (const item of items) {
    const button = document.createElement("button");
    button.className = `nav-button${item.active ? " is-active" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <span class="nav-copy">
        <span class="nav-label">${escapeHtml(item.label)}</span>
        ${item.description ? `<span class="nav-subtitle">${escapeHtml(item.description)}</span>` : ""}
      </span>
      <span class="nav-meta">${item.count}</span>
    `;
    button.addEventListener("click", item.onClick);
    container.append(button);
  }
}

function getCountForFilter(type, value) {
  return movies.filter((movie) => {
    if (type === "favorites") return appState.favorites.has(movie.id);
    if (type === "recent") return movie.inventoryNumber > movies.length - 16;
    if (type === "list") return getListById(value)?.movieIds.includes(movie.id) ?? false;
    if (type === "lists") return false;
    return true;
  }).length;
}

function renderHeader(visibleMovies) {
  const meta = getActiveSelectionMeta();
  const search = appState.search.trim();

  if (search && meta.isAll) {
    dom.activeContextLabel.textContent = "Search";
    dom.resultsHeading.textContent = `Results for "${search}"`;
  } else {
    dom.activeContextLabel.textContent = meta.contextLabel;
    dom.resultsHeading.textContent = meta.heading;
  }

  dom.resultsSummary.textContent = buildResultsSummary(meta, visibleMovies.length);
}

function renderCollection(groups) {
  dom.collectionContainer.innerHTML = "";

  if (!groups.some((group) => group.movies.length)) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>No titles matched</h3><p>Try a broader search, a different sidebar selection, or clear the current search.</p>";
    dom.collectionContainer.append(empty);
    return;
  }

  for (const group of groups) {
    if (!group.movies.length) continue;
    const block = document.createElement("section");
    block.className = "group-block";

    if (appState.group !== "none") {
      const header = document.createElement("div");
      header.className = "group-header";
      header.innerHTML = `<h3>${escapeHtml(group.label)}</h3><p>${group.movies.length} titles</p>`;
      block.append(header);
    }

    const list = document.createElement("div");
    list.className = appState.view === "grid" ? "movie-grid" : "movie-list";

    for (const movie of group.movies) {
      list.append(appState.view === "grid" ? renderMovieCard(movie) : renderMovieRow(movie));
    }

    block.append(list);
    dom.collectionContainer.append(block);
  }
}

function renderListOverview() {
  const wrapper = document.createElement("div");
  wrapper.className = "movie-grid";

  for (const list of appState.lists) {
    const card = document.createElement("article");
    card.className = "movie-card fade-in";
    card.innerHTML = `
      <div class="movie-card-body">
        <p class="movie-section">Custom List</p>
        <div class="movie-card-header">
          <div>
            <h3 class="movie-title">${escapeHtml(list.name)}</h3>
          </div>
          <span class="nav-meta">${list.movieIds.length}</span>
        </div>
        <p class="results-summary">${escapeHtml(buildListPreview(list))}</p>
        <div class="movie-card-footer">
          <button class="ghost-button open-list-button" type="button">Open List</button>
        </div>
      </div>
    `;
    card.querySelector(".open-list-button").addEventListener("click", () => setActiveFilter("list", list.id));
    wrapper.append(card);
  }

  dom.collectionContainer.append(wrapper);
}

function buildListPreview(list) {
  if (!list.movieIds.length) {
    return "Empty list. Add titles from any movie detail panel.";
  }
  const titles = list.movieIds
    .slice(0, 3)
    .map((movieId) => getMovieById(movieId)?.title)
    .filter(Boolean);
  return `${titles.join(", ")}${list.movieIds.length > 3 ? "..." : ""}`;
}

function renderMovieCard(movie) {
  const node = dom.cardTemplate.content.firstElementChild.cloneNode(true);
  const posterArt = node.querySelector(".poster-art");
  if (movie.posterUrl) {
    const img = node.querySelector(".poster-img");
    img.src = movie.posterUrl;
    img.alt = movie.title;
    img.hidden = false;
    posterArt.classList.add("has-poster-img");
    node.querySelector(".poster-copy").hidden = true;
  } else {
    applyPosterStyle(posterArt, movie.posterPalette);
    node.querySelector(".poster-format").textContent = movie.primaryFormat;
    node.querySelector(".poster-title").textContent = movie.title;
  }
  node.querySelector(".movie-section").textContent = movie.subsection || movie.section;
  node.querySelector(".movie-title").textContent = movie.title;
  decorateFavoriteButton(node.querySelector(".favorite-button"), movie.id);
  renderTags(node.querySelector(".movie-chip-row"), getVisibleTags(movie));
  node.querySelector(".poster-button").addEventListener("click", () => selectMovie(movie.id));
  node.querySelector(".open-detail-button").addEventListener("click", () => {
    selectMovie(movie.id);
    focusDetailPanel();
  });
  node.querySelector(".add-list-button").addEventListener("click", () => {
    selectMovie(movie.id);
    focusDetailPanel();
  });
  return node;
}

function renderMovieRow(movie) {
  const node = dom.rowTemplate.content.firstElementChild.cloneNode(true);
  applyPosterStyle(node.querySelector(".row-poster"), movie.posterPalette);
  node.querySelector(".movie-section").textContent = movie.subsection || movie.section;
  node.querySelector(".movie-title").textContent = movie.title;
  decorateFavoriteButton(node.querySelector(".favorite-button"), movie.id);
  renderTags(node.querySelector(".movie-chip-row"), getVisibleTags(movie));
  node.querySelector(".row-poster-button").addEventListener("click", () => selectMovie(movie.id));
  node.querySelector(".open-detail-button").addEventListener("click", () => {
    selectMovie(movie.id);
    focusDetailPanel();
  });
  return node;
}

function applyPosterStyle(element, palette) {
  element.style.setProperty("--poster-start", palette.start);
  element.style.setProperty("--poster-end", palette.end);
}

function decorateFavoriteButton(button, movieId) {
  const isFavorite = appState.favorites.has(movieId);
  button.classList.toggle("is-favorite", isFavorite);
  button.textContent = isFavorite ? "★" : "☆";
  button.onclick = () => toggleFavorite(movieId);
}

function renderTags(container, tags) {
  container.innerHTML = "";
  for (const tag of tags) {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = tag;
    container.append(chip);
  }
}

function getVisibleTags(movie) {
  const visible = [];
  if (movie.primaryFormat) visible.push(movie.primaryFormat);
  if (movie.steelbook) visible.push("Steelbook");
  if (movie.criterion) visible.push("Criterion");
  if (movie.collectionType !== "Single Feature") visible.push(movie.collectionType);
  if (movie.moviesAnywhere) visible.push("Movies Anywhere");
  if (movie.tags.includes("Studio Ghibli")) visible.push("Studio Ghibli");
  if (movie.directorCollection) visible.push(movie.directorCollection);
  if (movie.year) visible.push(String(movie.year));
  return [...new Set(visible)].slice(0, 5);
}

function renderDetail() {
  const movie = getMovieById(appState.selectedMovieId);
  if (!movie) {
    dom.detailEmpty.hidden = false;
    dom.detailContent.hidden = true;
    return;
  }

  dom.detailEmpty.hidden = true;
  dom.detailContent.hidden = false;
  renderDetailPoster(movie);
  dom.detailSection.textContent = movie.subsection || movie.section;
  dom.detailTitle.textContent = movie.title;
  dom.detailSubtitle.textContent = movie.directorCollection
    ? `Part of your ${movie.directorCollection} director set`
    : movie.director
      ? `Directed by ${movie.director}`
      : `Filed under ${movie.section}`;
  renderTags(dom.detailTags, getVisibleTags(movie));
  decorateFavoriteButton(dom.detailFavoriteButton, movie.id);
  dom.detailNumber.textContent = String(movie.inventoryNumber);
  dom.detailCollection.textContent = movie.directorCollection || movie.section;
  dom.detailEdition.textContent = movie.editionNotes.join(", ") || movie.collectionType;
  dom.detailYear.textContent = movie.year ? String(movie.year) : "—";
  dom.detailDirector.textContent = movie.director || "—";
  dom.detailRuntime.textContent = movie.runtime ? `${movie.runtime} min` : "—";
  dom.detailUpc.textContent = movie.upc || "—";

  if (movie.overview) {
    dom.detailOverviewBlock.hidden = false;
    dom.detailOverview.textContent = movie.overview;
  } else {
    dom.detailOverviewBlock.hidden = true;
  }

  dom.detailPrimaryFormat.value = movie.primaryFormat || "Blu-ray";
  dom.detailSteelbook.checked = Boolean(movie.steelbook);
  dom.detailCriterion.checked = Boolean(movie.criterion);
  dom.detailMoviesAnywhere.checked = Boolean(movie.moviesAnywhere);
  dom.detailWatchStatus.value = movie.watchStatus || "";
  renderStarRating(dom.detailRating, movie.personalRating);
  dom.detailNotes.value = movie.notes || "";
  dom.detailPurchasePrice.value = movie.purchasePrice != null ? movie.purchasePrice : "";
  dom.detailEstimatedValue.value = movie.estimatedValue != null ? movie.estimatedValue : "";
  dom.detailCondition.value = movie.condition || "";
  dom.detailValueSource.value = movie.valueSource || "";
  syncEditorAvailability();

  renderDetailSpecialFeatures(movie);
  setSaveStatus(appState.saveStatus.text, appState.saveStatus.tone);
  renderDetailLists(movie);
}

function syncEditorAvailability() {
  const isReadOnly = !runtimeState.canSave;
  const controls = [
    dom.detailPrimaryFormat,
    dom.detailSteelbook,
    dom.detailCriterion,
    dom.detailMoviesAnywhere,
    dom.detailWatchStatus,
    dom.detailNotes,
    dom.detailPurchasePrice,
    dom.detailEstimatedValue,
    dom.detailCondition,
    dom.detailValueSource,
    dom.detailEditFeaturesButton,
  ];

  for (const control of controls) {
    if (!control) continue;
    control.disabled = isReadOnly;
    control.closest(".editor-field, .editor-toggle, .detail-block-heading")?.classList.toggle("editor-disabled", isReadOnly);
  }
}

function renderStarRating(container, rating) {
  container.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = `star-button${rating != null && i <= rating ? " is-filled" : ""}`;
    star.textContent = i <= (rating || 0) ? "★" : "☆";
    star.title = `${i}/10`;
    star.addEventListener("click", () => {
      const newRating = (rating === i) ? null : i;
      saveMovieMetadata(appState.selectedMovieId, { personalRating: newRating });
    });
    container.append(star);
  }
}

let posterCarousel = { movieId: null, posters: [], index: 0, saving: false };
const detailCaseArtCache = new Map();
const artworkCandidateCache = new Map();
const imagePreloadCache = new Map();

function preloadImage(url) {
  if (!url) return Promise.resolve(false);
  if (imagePreloadCache.has(url)) return imagePreloadCache.get(url);

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

  imagePreloadCache.set(url, promise);
  return promise;
}

function preloadArtworkCandidate(candidate) {
  if (!candidate) return Promise.resolve();
  return Promise.all([
    preloadImage(candidate.frontUrl),
    preloadImage(candidate.backUrl),
    preloadImage(candidate.spineUrl),
  ]);
}

function getPreviewArtworkCandidate(movie) {
  if (!movie || movie.posterUrl) return null;
  return artworkCandidateCache.get(movie.id)?.candidates?.[0] || null;
}

async function ensureArtworkCandidates(movie) {
  if (!movie?.tmdbId) return [];

  const cached = artworkCandidateCache.get(movie.id);
  if (cached?.status === "ready") return cached.candidates;
  if (cached?.status === "loading") return cached.promise;

  const promise = fetch("./api/artwork/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: movie.id,
      tmdbId: movie.tmdbId,
      title: movie.title,
      year: movie.year,
      primaryFormat: movie.primaryFormat,
      steelbook: movie.steelbook,
      criterion: movie.criterion,
    }),
  })
    .then((response) => response.json())
    .then(async (payload) => {
      const candidates = payload.candidates || [];
      artworkCandidateCache.set(movie.id, { status: "ready", candidates });
      await Promise.all(candidates.slice(0, 6).map((candidate) => preloadArtworkCandidate(candidate)));

      if (appState.selectedMovieId === movie.id) {
        renderDetailPoster(getMovieById(movie.id));
      }
      if (posterCarousel.movieId === movie.id) {
        posterCarousel.posters = candidates;
        renderPosterCarousel(getMovieById(movie.id));
      }

      return candidates;
    })
    .catch(() => {
      artworkCandidateCache.set(movie.id, { status: "error", candidates: [] });
      return [];
    });

  artworkCandidateCache.set(movie.id, { status: "loading", candidates: [], promise });
  return promise;
}

function getDetailCaseProfile(movie) {
  const format = String(movie.primaryFormat || "").toLowerCase();
  return {
    is4k: format.includes("4k"),
    isBluRay: format.includes("blu"),
    isSteelbook: Boolean(movie.steelbook),
    isCriterion: Boolean(movie.criterion),
  };
}

function getDetailCaseSpineLabel(movie, profile) {
  if (profile.isCriterion) return "Criterion Collection";
  if (profile.isSteelbook && profile.is4k) return "4K Steelbook";
  if (profile.isSteelbook) return "Steelbook";
  if (profile.is4k) return "4K Ultra HD";
  if (profile.isBluRay) return "Blu-ray";
  return movie.primaryFormat || "Collector's Edition";
}

function getDetailCaseBannerLabel(movie, profile) {
  if (profile.isCriterion) return "Criterion";
  if (profile.isSteelbook && profile.is4k) return "Steelbook 4K";
  if (profile.isSteelbook) return "Steelbook";
  if (profile.is4k) return "4K Ultra HD";
  if (profile.isBluRay) return "Blu-ray";
  return movie.primaryFormat || "Collector's Edition";
}

function getDetailCaseClassName(profile) {
  const classes = ["detail-case"];
  if (profile.is4k) classes.push("is-4k");
  if (profile.isBluRay) classes.push("is-bluray");
  if (profile.isSteelbook) classes.push("is-steelbook");
  if (profile.isCriterion) classes.push("is-criterion");
  return classes.join(" ");
}

function getDetailCaseArt(movie) {
  if (!movie?.tmdbId) return null;
  return detailCaseArtCache.get(movie.tmdbId) || null;
}

async function loadDetailCaseArt(movie) {
  if (!movie?.tmdbId || !apiConfig.hasTmdbKey) return;

  const cached = detailCaseArtCache.get(movie.tmdbId);
  if (cached?.status === "loading" || cached?.status === "ready") return;

  detailCaseArtCache.set(movie.tmdbId, { status: "loading" });

  try {
    const response = await fetch(`./api/tmdb/case-art/${movie.tmdbId}`);
    if (!response.ok) throw new Error(`Case art request failed with ${response.status}`);
    const payload = await response.json();
    detailCaseArtCache.set(movie.tmdbId, {
      status: "ready",
      backdropUrl: payload.backdropUrl || null,
      logoUrl: payload.logoUrl || null,
    });
  } catch {
    detailCaseArtCache.set(movie.tmdbId, { status: "error", backdropUrl: null, logoUrl: null });
  }

  if (appState.selectedMovieId === movie.id) {
    renderDetailPoster(getMovieById(movie.id));
  }
}

function renderDetailPoster(movie) {
  dom.detailPoster.innerHTML = "";
  const caseProfile = getDetailCaseProfile(movie);
  const caseArt = getDetailCaseArt(movie);
  const previewCandidate = getPreviewArtworkCandidate(movie);
  const activeFrontUrl = movie.posterUrl || previewCandidate?.frontUrl || null;
  const activeBackUrl = movie.backCoverUrl || previewCandidate?.backUrl || caseArt?.backdropUrl || null;
  const activeSpineUrl = movie.spineArtUrl || previewCandidate?.spineUrl || caseArt?.logoUrl || null;
  const wrapper = document.createElement("div");
  wrapper.className = "detail-poster-wrap detail-poster-scene";

  const caseNode = document.createElement("div");
  caseNode.className = getDetailCaseClassName(caseProfile);
  applyPosterStyle(caseNode, movie.posterPalette);

  const bannerLabel = getDetailCaseBannerLabel(movie, caseProfile);
  const spineLabel = getDetailCaseSpineLabel(movie, caseProfile);
  const posterMarkup = activeFrontUrl
    ? `<img class="detail-poster-img" src="${escapeAttr(activeFrontUrl)}${activeFrontUrl.startsWith("./") ? `?t=${Date.now()}` : ""}" alt="${escapeAttr(movie.title)}">`
    : `
      <div class="detail-poster-copy">
        <p class="poster-format">${escapeHtml(movie.primaryFormat || "Collector's Edition")}</p>
        <h3 class="detail-poster-title">${escapeHtml(movie.title)}</h3>
      </div>
    `;
  const backArtMarkup = activeBackUrl
    ? `
      <img
        class="detail-case-back-img"
        src="${escapeAttr(activeBackUrl)}"
        alt="${escapeAttr(`${movie.title} back cover art`)}"
      >
      <div class="detail-case-back-overlay" aria-hidden="true">
        <span class="detail-case-back-text">Back Cover</span>
      </div>
    `
    : `<span class="detail-case-back-text">Back Cover</span>`;
  const spineArtMarkup = activeSpineUrl
    ? `<img class="detail-case-spine-img" src="${escapeAttr(activeSpineUrl)}" alt="${escapeAttr(`${movie.title} spine art`)}">`
    : `<span class="detail-case-spine-text">${escapeHtml(spineLabel)}</span>`;

  caseNode.innerHTML = `
    <div class="detail-case-shadow" aria-hidden="true"></div>
    <div class="detail-case-object">
      <div class="detail-case-front">
        <div class="detail-case-banner" aria-hidden="true">
          <span class="detail-case-banner-text">${escapeHtml(bannerLabel)}</span>
        </div>
        <div class="detail-case-art">
          ${posterMarkup}
          <div class="detail-case-gloss" aria-hidden="true"></div>
        </div>
      </div>
      <div class="detail-case-back" aria-hidden="true">
        <div class="detail-case-back-art">
          ${backArtMarkup}
        </div>
      </div>
      <div class="detail-case-spine" aria-hidden="true">
        ${spineArtMarkup}
      </div>
      <div class="detail-case-edge" aria-hidden="true"></div>
      <div class="detail-case-top" aria-hidden="true"></div>
      <div class="detail-case-bottom" aria-hidden="true"></div>
    </div>
  `;
  wrapper.append(caseNode);

  if (movie.tmdbId && apiConfig.hasTmdbKey) {
    const browseBtn = document.createElement("button");
    browseBtn.type = "button";
    browseBtn.className = "poster-browse-button";
    browseBtn.textContent = "Browse Covers";
    browseBtn.addEventListener("click", () => openPosterCarousel(movie));
    wrapper.append(browseBtn);
  }

  dom.detailPoster.append(wrapper);
  loadDetailCaseArt(movie);
  ensureArtworkCandidates(movie);
  window.caseViewer?.updateMovie(movie);
}

async function openPosterCarousel(movie) {
  if (!movie.tmdbId) return;
  const modal = document.getElementById("poster-modal");
  const body = document.getElementById("poster-carousel-body");
  document.getElementById("poster-modal-title").textContent = movie.title;
  posterCarousel = { movieId: movie.id, posters: [], index: 0, saving: false };
  modal.hidden = false;
  body.innerHTML = '<p style="padding:28px;text-align:center;color:var(--muted);">Loading covers...</p>';

  posterCarousel.posters = await ensureArtworkCandidates(movie);

  if (!posterCarousel.posters.length) {
    body.innerHTML = '<p style="padding:28px;text-align:center;color:var(--muted);">No alternate covers found.</p>';
    return;
  }
  renderPosterCarousel(movie);
}

function renderPosterCarousel(movie) {
  const body = document.getElementById("poster-carousel-body");
  const { posters, index, saving } = posterCarousel;
  body.innerHTML = "";

  const currentPoster = posters[index];
  if (!currentPoster) return;
  preloadArtworkCandidate(currentPoster);
  preloadArtworkCandidate(posters[index - 1]);
  preloadArtworkCandidate(posters[index + 1]);

  const frame = document.createElement("div");
  frame.className = "carousel-poster-frame";

  const img = document.createElement("img");
  img.className = "carousel-poster-img";
  img.src = currentPoster.frontUrl;
  img.alt = `${currentPoster.releaseTitle} ${currentPoster.faceLabel}`;
  frame.append(img);
  body.append(frame);

  const meta = document.createElement("div");
  meta.className = "carousel-meta";
  meta.innerHTML = `
    <p class="carousel-source">${escapeHtml(currentPoster.sourceName)} · ${escapeHtml(currentPoster.faceLabel)}</p>
    <p class="carousel-release">${escapeHtml(currentPoster.releaseTitle)}</p>
  `;
  body.append(meta);

  const nav = document.createElement("div");
  nav.className = "carousel-nav";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "carousel-arrow";
  prevBtn.textContent = "‹";
  prevBtn.disabled = index === 0 || saving;
  prevBtn.addEventListener("click", () => {
    posterCarousel.index = Math.max(0, posterCarousel.index - 1);
    renderPosterCarousel(movie);
  });

  const counter = document.createElement("span");
  counter.className = "carousel-counter";
  counter.textContent = `${index + 1} / ${posters.length}`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "carousel-arrow";
  nextBtn.textContent = "›";
  nextBtn.disabled = index === posters.length - 1 || saving;
  nextBtn.addEventListener("click", () => {
    posterCarousel.index = Math.min(posterCarousel.posters.length - 1, posterCarousel.index + 1);
    renderPosterCarousel(movie);
  });

  nav.append(prevBtn, counter, nextBtn);
  body.append(nav);

  const actions = document.createElement("div");
  actions.className = "carousel-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "new-list-button carousel-save-button";
  saveBtn.textContent = saving ? "Saving..." : "Use This Artwork";
  saveBtn.disabled = saving;
  saveBtn.addEventListener("click", () => setPosterFromCarousel(movie, currentPoster));

  actions.append(saveBtn);
  if (currentPoster.sourceUrl) {
    const sourceLink = document.createElement("a");
    sourceLink.className = "text-action carousel-source-link";
    sourceLink.href = currentPoster.sourceUrl;
    sourceLink.target = "_blank";
    sourceLink.rel = "noreferrer";
    sourceLink.textContent = "Open source";
    actions.append(sourceLink);
  }
  body.append(actions);
}

async function setPosterFromCarousel(movie, poster) {
  posterCarousel.saving = true;
  renderPosterCarousel(movie);

  try {
    const [frontDownload, backDownload, spineDownload] = await Promise.all([
      fetch("./api/poster/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remoteUrl: poster.frontUrl, movieId: movie.id }),
      }).then((resp) => resp.json()),
      poster.backUrl
        ? fetch("./api/artwork/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remoteUrl: poster.backUrl, movieId: movie.id, role: "back" }),
        }).then((resp) => resp.json())
        : Promise.resolve({ localUrl: "" }),
      poster.spineUrl
        ? fetch("./api/artwork/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remoteUrl: poster.spineUrl, movieId: movie.id, role: "spine" }),
        }).then((resp) => resp.json())
        : Promise.resolve({ localUrl: "" }),
    ]);

    await patchMovie(movie.id, {
      posterUrl: frontDownload.localUrl || poster.frontUrl,
      backCoverUrl: backDownload.localUrl || poster.backUrl || "",
      spineArtUrl: spineDownload.localUrl || poster.spineUrl || "",
      artworkSourceName: poster.sourceName || "",
      artworkSourceUrl: poster.sourceUrl || "",
    });
    document.getElementById("poster-modal").hidden = true;
    posterCarousel = { movieId: null, posters: [], index: 0, saving: false };
    renderDetail();
    renderCollection(groupMovies(getVisibleMovies()));
  } catch (error) {
    console.error("Failed to set poster:", error);
    posterCarousel.saving = false;
    renderPosterCarousel(movie);
  }
}

function renderDetailSpecialFeatures(movie) {
  dom.detailSpecialFeatures.innerHTML = "";
  const features = movie.specialFeatures || [];
  if (features.length === 0) {
    const empty = document.createElement("span");
    empty.className = "muted-text";
    empty.textContent = "No special features cataloged";
    dom.detailSpecialFeatures.append(empty);
    return;
  }
  for (const feature of features) {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = feature;
    dom.detailSpecialFeatures.append(chip);
  }
}

function renderDetailLists(movie) {
  dom.detailLists.innerHTML = "";
  for (const list of appState.lists) {
    const row = document.createElement("div");
    row.className = "list-row";
    const isOn = list.movieIds.includes(movie.id);
    row.innerHTML = `
      <div class="list-row-info">
        <h4>${escapeHtml(list.name)}</h4>
        <p>${list.movieIds.length} titles saved</p>
      </div>
      <button class="list-toggle${isOn ? " is-on" : ""}" type="button">${isOn ? "In List" : "Add"}</button>
    `;
    row.querySelector(".list-toggle").addEventListener("click", () => toggleMovieInList(list.id, movie.id));
    dom.detailLists.append(row);
  }
}

function closeViewsMenu() {
  dom.viewsMenuPanel.hidden = true;
  dom.viewsMenuButton.setAttribute("aria-expanded", "false");
}

function toggleViewsMenu() {
  const willOpen = dom.viewsMenuPanel.hidden;
  dom.viewsMenuPanel.hidden = !willOpen;
  dom.viewsMenuButton.setAttribute("aria-expanded", String(willOpen));
}

function setView(view) {
  appState.view = view;
  saveState();
  closeViewsMenu();
  render();
}

function syncControls() {
  dom.searchInput.value = appState.search;
  dom.sortSelect.value = appState.sort;
  dom.groupSelect.value = appState.group;
  dom.viewsMenuCurrent.textContent = appState.view === "grid" ? "Grid" : "List";
  dom.viewOptions.forEach((button) => {
    const isActive = button.dataset.viewOption === appState.view;
    button.classList.toggle("is-active", isActive);
  });
}

function openModal(id) {
  const modal = document.querySelector(`#${id}`);
  if (modal) modal.hidden = false;
}

function closeModal(id) {
  const modal = document.querySelector(`#${id}`);
  if (modal) modal.hidden = true;
}

function focusDetailPanel() {
  document.querySelector(".detail-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function patchMovie(movieId, changes) {
  const response = await fetch(`./api/catalog/${encodeURIComponent(movieId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!response.ok) throw new Error(`Save failed with ${response.status}`);
  const payload = await response.json();
  if (payload.movie) replaceMovie(payload.movie);
  return payload.movie;
}

async function saveMovieMetadataQuiet(movieId, changes) {
  try {
    await patchMovie(movieId, changes);
  } catch { /* silent */ }
}

async function saveMovieMetadata(movieId, changes) {
  const movie = getMovieById(movieId || appState.selectedMovieId);
  if (!movie) return;
  if (!runtimeState.canSave) {
    setSaveStatus("Read-only mode: run npm run serve", "error");
    renderRuntimeBanner();
    return;
  }

  try {
    setSaveStatus("Saving...", "saving");
    await patchMovie(movie.id, changes);
    setRuntimeState("api", true, "");
    setSaveStatus("Saved", "idle");
    renderDetail();
  } catch (error) {
    console.error("Could not save movie metadata.", error);
    setRuntimeState(
      "fallback",
      false,
      "Save failed because the live catalog API is unavailable. Re-open the app from http://127.0.0.1:4173 or your Mobile test URL after starting npm run serve.",
    );
    setSaveStatus("Could not save changes", "error");
    render();
  }
}

// --- Add Movie ---

let addMovieSpecialFeatures = [];

function openAddMovieModal() {
  openModal("add-movie-modal");
  switchAddMovieTab("manual");
  resetAddMovieForm();
}

function resetAddMovieForm() {
  dom.addMovieForm.reset();
  document.querySelector("#add-tmdb-id").value = "";
  document.querySelector("#add-poster-url").value = "";
  document.querySelector("#add-overview").value = "";
  document.querySelector("#add-genre").value = "";
  document.querySelector("#add-runtime").value = "";
  addMovieSpecialFeatures = [];
  renderAddMovieFeatures();
}

function switchAddMovieTab(tab) {
  appState.addMovieTab = tab;
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.hidden = panel.id !== `tab-${tab}`;
  });
}

function renderAddMovieFeatures() {
  dom.addSpecialFeatures.innerHTML = "";
  for (const feature of addMovieSpecialFeatures) {
    const chip = document.createElement("span");
    chip.className = "tag-chip removable-chip";
    chip.innerHTML = `${escapeHtml(feature)} <button type="button" class="chip-remove">×</button>`;
    chip.querySelector(".chip-remove").addEventListener("click", () => {
      addMovieSpecialFeatures = addMovieSpecialFeatures.filter((f) => f !== feature);
      renderAddMovieFeatures();
    });
    dom.addSpecialFeatures.append(chip);
  }
}

async function handleAddMovieSubmit(event) {
  event.preventDefault();
  const movieData = {
    title: document.querySelector("#add-title").value.trim(),
    section: document.querySelector("#add-section").value,
    primaryFormat: document.querySelector("#add-format").value,
    year: document.querySelector("#add-year").value ? Number(document.querySelector("#add-year").value) : null,
    director: document.querySelector("#add-director").value.trim() || null,
    directorCollection: document.querySelector("#add-director-collection").value.trim() || null,
    collectionType: document.querySelector("#add-collection-type").value,
    upc: document.querySelector("#add-upc").value.trim() || null,
    purchasePrice: document.querySelector("#add-price").value ? Number(document.querySelector("#add-price").value) : null,
    condition: document.querySelector("#add-condition").value || null,
    steelbook: document.querySelector("#add-steelbook").checked,
    criterion: document.querySelector("#add-criterion").checked,
    moviesAnywhere: document.querySelector("#add-movies-anywhere").checked,
    specialFeatures: addMovieSpecialFeatures,
    notes: document.querySelector("#add-notes").value.trim() || null,
    tmdbId: document.querySelector("#add-tmdb-id").value ? Number(document.querySelector("#add-tmdb-id").value) : null,
    posterUrl: document.querySelector("#add-poster-url").value || null,
    overview: document.querySelector("#add-overview").value || null,
    genre: document.querySelector("#add-genre").value || null,
    runtime: document.querySelector("#add-runtime").value ? Number(document.querySelector("#add-runtime").value) : null,
  };

  if (!movieData.title) return;

  try {
    const response = await fetch("./api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(movieData),
    });
    if (!response.ok) throw new Error(`Add failed: ${response.status}`);
    const payload = await response.json();
    const records = await loadCatalogFromSource();
    setMovies(records);
    if (payload.movie) {
      appState.selectedMovieId = payload.movie.id;
    }
    saveState();
    closeModal("add-movie-modal");
    render();
  } catch (error) {
    console.error("Failed to add movie:", error);
    alert("Failed to add movie. Check the console for details.");
  }
}

// --- TMDb Search ---

async function handleTmdbSearch() {
  const query = dom.tmdbSearchInput.value.trim();
  if (!query) return;
  dom.tmdbResults.innerHTML = '<p class="muted-text">Searching...</p>';

  try {
    const response = await fetch(`./api/tmdb/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (!response.ok) {
      dom.tmdbResults.innerHTML = `<p class="muted-text">${escapeHtml(data.error || "Search failed")}</p>`;
      return;
    }
    renderTmdbResults(data.results || []);
  } catch (error) {
    dom.tmdbResults.innerHTML = '<p class="muted-text">Search failed. Check server connection.</p>';
  }
}

function renderTmdbResults(results) {
  dom.tmdbResults.innerHTML = "";
  if (!results.length) {
    dom.tmdbResults.innerHTML = '<p class="muted-text">No results found.</p>';
    return;
  }
  for (const result of results.slice(0, 10)) {
    const year = result.release_date ? result.release_date.slice(0, 4) : "";
    const card = document.createElement("div");
    card.className = "search-result-card";
    card.innerHTML = `
      <div class="search-result-poster">
        ${result.poster_path
          ? `<img src="https://image.tmdb.org/t/p/w92${result.poster_path}" alt="">`
          : '<div class="no-poster">?</div>'}
      </div>
      <div class="search-result-info">
        <h4>${escapeHtml(result.title)}</h4>
        <p>${year}${result.overview ? ` — ${escapeHtml(result.overview.slice(0, 100))}...` : ""}</p>
      </div>
      <button class="ghost-button select-result-button" type="button">Select</button>
    `;
    card.querySelector(".select-result-button").addEventListener("click", () => selectTmdbResult(result));
    dom.tmdbResults.append(card);
  }
}

async function selectTmdbResult(result) {
  try {
    const response = await fetch(`./api/tmdb/movie/${result.id}`);
    const detail = await response.json();

    const director = detail.credits?.crew?.find((c) => c.job === "Director")?.name || "";
    const genres = detail.genres?.map((g) => g.name).join(", ") || "";

    let posterUrl = "";
    if (result.poster_path) {
      const remoteUrl = `https://image.tmdb.org/t/p/w500${result.poster_path}`;
      const tempId = `movie-new-${result.id}`;
      try {
        const dlResp = await fetch("./api/poster/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remoteUrl, movieId: tempId }),
        });
        const dlData = await dlResp.json();
        posterUrl = dlData.localUrl || remoteUrl;
      } catch {
        posterUrl = remoteUrl;
      }
    }

    document.querySelector("#add-title").value = result.title;
    document.querySelector("#add-year").value = result.release_date ? result.release_date.slice(0, 4) : "";
    document.querySelector("#add-director").value = director;
    document.querySelector("#add-tmdb-id").value = result.id;
    document.querySelector("#add-poster-url").value = posterUrl;
    document.querySelector("#add-overview").value = result.overview || "";
    document.querySelector("#add-genre").value = genres;
    document.querySelector("#add-runtime").value = detail.runtime || "";

    switchAddMovieTab("manual");
  } catch (error) {
    console.error("TMDb detail fetch failed:", error);
  }
}

// --- UPC Lookup ---

async function handleUpcLookup() {
  const upc = dom.upcInput.value.trim();
  if (!upc) return;
  dom.upcResults.innerHTML = '<p class="muted-text">Looking up UPC...</p>';

  try {
    const response = await fetch(`./api/upc/lookup?upc=${encodeURIComponent(upc)}`);
    const data = await response.json();
    if (!response.ok || data.code === "INVALID") {
      dom.upcResults.innerHTML = '<p class="muted-text">UPC not found. Try entering the movie manually.</p>';
      return;
    }
    renderUpcResults(data, upc);
  } catch (error) {
    dom.upcResults.innerHTML = '<p class="muted-text">Lookup failed. Check server connection.</p>';
  }
}

function renderUpcResults(data, upc) {
  dom.upcResults.innerHTML = "";
  const items = data.items || [];
  if (!items.length) {
    dom.upcResults.innerHTML = '<p class="muted-text">No product found for this UPC.</p>';
    return;
  }

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "search-result-card";
    card.innerHTML = `
      <div class="search-result-poster">
        ${item.images?.[0]
          ? `<img src="${escapeAttr(item.images[0])}" alt="">`
          : '<div class="no-poster">?</div>'}
      </div>
      <div class="search-result-info">
        <h4>${escapeHtml(item.title || "Unknown Product")}</h4>
        <p>${escapeHtml(item.brand || "")} ${escapeHtml(item.description || "")}</p>
      </div>
      <button class="ghost-button select-result-button" type="button">Use This</button>
    `;
    card.querySelector(".select-result-button").addEventListener("click", () => {
      document.querySelector("#add-title").value = cleanUpcTitle(item.title || "");
      document.querySelector("#add-upc").value = upc;
      if (apiConfig.hasTmdbKey && item.title) {
        dom.tmdbSearchInput.value = cleanUpcTitle(item.title);
        handleTmdbSearch();
        switchAddMovieTab("search");
      } else {
        switchAddMovieTab("manual");
      }
    });
    dom.upcResults.append(card);
  }
}

function cleanUpcTitle(title) {
  return title
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?(blu-ray|dvd|4k|uhd|digital).*?\)/gi, "")
    .replace(/(blu-ray|dvd|4k|uhd|digital|steelbook)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- Special Features Modal ---

function openFeaturesModal() {
  const movie = getMovieById(appState.selectedMovieId);
  if (!movie) return;
  appState.pendingSpecialFeatures = [...(movie.specialFeatures || [])];
  renderFeaturesChecklist();
  openModal("features-modal");
}

function renderFeaturesChecklist() {
  dom.featuresChecklist.innerHTML = "";
  const allFeatures = [...new Set([...SPECIAL_FEATURE_PRESETS, ...appState.pendingSpecialFeatures])];
  for (const feature of allFeatures) {
    const label = document.createElement("label");
    label.className = "editor-toggle";
    const checked = appState.pendingSpecialFeatures.includes(feature);
    label.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""}><span>${escapeHtml(feature)}</span>`;
    label.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) {
        if (!appState.pendingSpecialFeatures.includes(feature)) {
          appState.pendingSpecialFeatures.push(feature);
        }
      } else {
        appState.pendingSpecialFeatures = appState.pendingSpecialFeatures.filter((f) => f !== feature);
      }
    });
    dom.featuresChecklist.append(label);
  }
}

function addCustomFeature() {
  const value = dom.customFeatureInput.value.trim();
  if (!value || appState.pendingSpecialFeatures.includes(value)) return;
  appState.pendingSpecialFeatures.push(value);
  dom.customFeatureInput.value = "";
  renderFeaturesChecklist();
}

async function saveSpecialFeatures() {
  await saveMovieMetadata(appState.selectedMovieId, { specialFeatures: appState.pendingSpecialFeatures });
  closeModal("features-modal");
}

// --- Utilities ---

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// --- Event Binding ---

function bindEvents() {
  if (dom.sidebarToggle) {
    dom.sidebarToggle.addEventListener("click", () => {
      const isOpen = dom.sidebar.classList.toggle("sidebar-open");
      dom.sidebarToggle.classList.toggle("is-open", isOpen);
      dom.sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  dom.searchInput.addEventListener("input", (event) => {
    appState.search = event.target.value;
    saveState();
    render();
  });

  dom.themeSelect.addEventListener("change", (event) => {
    appState.theme = event.target.value;
    applyTheme();
    saveState();
  });

  dom.sortSelect.addEventListener("change", (event) => {
    appState.sort = event.target.value;
    saveState();
    render();
  });

  dom.groupSelect.addEventListener("change", (event) => {
    appState.group = event.target.value;
    saveState();
    render();
  });

  dom.viewsMenuButton.addEventListener("click", () => toggleViewsMenu());
  dom.viewOptions.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.viewOption));
  });

  dom.addMovieButton.addEventListener("click", openAddMovieModal);
  dom.newListButton.addEventListener("click", () => openModal("list-modal"));
  dom.detailCreateListButton.addEventListener("click", () => openModal("list-modal"));

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".views-menu")) {
      closeViewsMenu();
    }

    const target = event.target.closest("[data-close-modal]");
    if (target) {
      closeModal(target.dataset.closeModal);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeViewsMenu();
      document.querySelectorAll(".modal:not([hidden])").forEach((modal) => {
        modal.hidden = true;
      });
    }
  });

  dom.listForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createList(dom.listNameInput.value);
    dom.listForm.reset();
  });

  dom.addMovieForm.addEventListener("submit", handleAddMovieSubmit);

  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.addEventListener("click", () => switchAddMovieTab(btn.dataset.tab));
  });

  dom.tmdbSearchButton.addEventListener("click", handleTmdbSearch);
  dom.tmdbSearchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleTmdbSearch(); } });

  dom.upcLookupButton.addEventListener("click", handleUpcLookup);
  dom.upcInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleUpcLookup(); } });

  dom.detailEditFeaturesButton.addEventListener("click", openFeaturesModal);
  dom.addCustomFeatureButton.addEventListener("click", addCustomFeature);
  dom.customFeatureInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addCustomFeature(); } });
  dom.saveFeaturesButton.addEventListener("click", saveSpecialFeatures);

  dom.addSpecialFeaturesInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && !addMovieSpecialFeatures.includes(val)) {
        addMovieSpecialFeatures.push(val);
        renderAddMovieFeatures();
      }
      e.target.value = "";
    }
  });

  // Detail panel editable fields
  let detailSaveTimer = null;
  function debouncedDetailSave(changes) {
    clearTimeout(detailSaveTimer);
    detailSaveTimer = setTimeout(() => saveMovieMetadata(appState.selectedMovieId, changes), 600);
  }

  dom.detailPrimaryFormat.addEventListener("change", (e) => {
    saveMovieMetadata(appState.selectedMovieId, { primaryFormat: e.target.value });
  });
  dom.detailSteelbook.addEventListener("change", (e) => {
    saveMovieMetadata(appState.selectedMovieId, { steelbook: e.target.checked });
  });
  dom.detailCriterion.addEventListener("change", (e) => {
    saveMovieMetadata(appState.selectedMovieId, { criterion: e.target.checked });
  });
  dom.detailMoviesAnywhere.addEventListener("change", (e) => {
    saveMovieMetadata(appState.selectedMovieId, { moviesAnywhere: e.target.checked });
  });
  dom.detailWatchStatus.addEventListener("change", (e) => {
    saveMovieMetadata(appState.selectedMovieId, { watchStatus: e.target.value });
  });
  dom.detailNotes.addEventListener("input", (e) => {
    debouncedDetailSave({ notes: e.target.value });
  });
  dom.detailPurchasePrice.addEventListener("change", (e) => {
    saveMovieMetadata(appState.selectedMovieId, { purchasePrice: e.target.value ? Number(e.target.value) : null });
  });
  dom.detailEstimatedValue.addEventListener("change", (e) => {
    saveMovieMetadata(appState.selectedMovieId, { estimatedValue: e.target.value ? Number(e.target.value) : null });
  });
  dom.detailCondition.addEventListener("change", (e) => {
    saveMovieMetadata(appState.selectedMovieId, { condition: e.target.value });
  });
  dom.detailValueSource.addEventListener("change", (e) => {
    saveMovieMetadata(appState.selectedMovieId, { valueSource: e.target.value });
  });
}

// --- Auto Poster Backfill ---

let posterBackfillRunning = false;

async function localizeRemotePoster(movie) {
  if (!movie.posterUrl || movie.posterUrl.startsWith("./posters/")) return false;
  try {
    const resp = await fetch("./api/poster/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remoteUrl: movie.posterUrl, movieId: movie.id }),
    });
    const data = await resp.json();
    if (data.localUrl) {
      await saveMovieMetadataQuiet(movie.id, { posterUrl: data.localUrl });
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

async function backfillPoster(movie) {
  try {
    const variant = movie.criterion ? "criterion" : movie.steelbook ? "steelbook" : undefined;
    const response = await fetch("./api/tmdb/auto-poster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieId: movie.id, title: movie.title, year: movie.year, variant }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (data.matched && data.movie) {
      replaceMovie(data.movie);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function runPosterBackfill() {
  if (posterBackfillRunning || !apiConfig.hasTmdbKey) return;
  posterBackfillRunning = true;

  const needsFetch = (m) => !m.posterUrl;
  const needsLocalize = (m) => m.posterUrl && !m.posterUrl.startsWith("./posters/");
  const selected = appState.selectedMovieId ? getMovieById(appState.selectedMovieId) : null;

  if (selected) {
    if (needsLocalize(selected)) {
      await localizeRemotePoster(selected);
      renderDetail();
    } else if (needsFetch(selected)) {
      const hit = await backfillPoster(selected);
      if (hit) renderDetail();
    }
  }

  const ordered = [...movies];
  let updated = 0;
  for (const movie of ordered) {
    if (movie.id === selected?.id) continue;
    const fresh = getMovieById(movie.id);
    if (!fresh) continue;

    if (needsLocalize(fresh)) {
      await localizeRemotePoster(fresh);
      updated++;
    } else if (needsFetch(fresh)) {
      await new Promise((r) => setTimeout(r, 280));
      const hit = await backfillPoster(fresh);
      if (hit) updated++;
    } else {
      continue;
    }

    if (updated % 10 === 0) renderCollection(groupMovies(getVisibleMovies()));
  }

  if (updated > 0) render();
  posterBackfillRunning = false;
}

async function init() {
  const [rawMovies] = await Promise.all([loadCatalogFromSource(), loadApiConfig()]);
  setMovies(rawMovies);
  loadState();
  applyTheme();
  ensureSelectedMovie();
  bindEvents();
  render();
  runPosterBackfill();
}

init();
