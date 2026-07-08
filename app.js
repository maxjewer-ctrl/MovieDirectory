const STORAGE_KEY = "movie-directory-state-v6";
const WATCHLISTS = [
  { id: "list-max-watchlist", name: "Max's Watchlist" },
  { id: "list-kate-watchlist", name: "Kate's Watchlist" },
];
const DEFAULT_LISTS = WATCHLISTS.map((l) => ({ id: l.id, name: l.name, movieIds: [] }));

// Ensure the two named watchlists always exist (adds them for returning users
// whose saved state predates them).
function ensureWatchlists() {
  for (const wl of WATCHLISTS) {
    if (!appState.lists.some((l) => l.id === wl.id)) {
      appState.lists.push({ id: wl.id, name: wl.name, movieIds: [] });
    }
  }
}

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
  mobileAllView: false,
  mobileTab: "shelf",
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
  sidebarBackdrop: document.querySelector("#sidebar-backdrop"),
  sidebarClose: document.querySelector("#sidebar-close"),
  detailPanel: document.querySelector(".detail-panel"),
  themeSelectM: document.querySelector("#theme-select-m"),
  sortSelectM: document.querySelector("#sort-select-m"),
  groupSelectM: document.querySelector("#group-select-m"),
  viewSelectM: document.querySelector("#view-select-m"),
  addMovieButtonM: document.querySelector("#add-movie-button-m"),
  detailIconRail: document.querySelector("#detail-icon-rail"),
  detailQuickInfo: document.querySelector("#detail-quick-info"),
  detailHeroTitle: document.querySelector("#detail-hero-title"),
  heroCollapse: document.querySelector("#hero-collapse"),
  detailCloseBottom: document.querySelector("#detail-close-bottom"),
  sheetBackdrop: document.querySelector("#sheet-backdrop"),
  fullDescBtn: document.querySelector("#full-desc-btn"),
  addPlaylistBtn: document.querySelector("#add-playlist-btn"),
  changeCoverBtn: document.querySelector("#change-cover-btn"),
  playlistModal: document.querySelector("#playlist-modal"),
  playlistPicker: document.querySelector("#playlist-picker"),
  playlistNewBtn: document.querySelector("#playlist-new-btn"),
  essayModal: document.querySelector("#essay-modal"),
  essayModalTitle: document.querySelector("#essay-modal-title"),
  essayBody: document.querySelector("#essay-body"),
  essaySource: document.querySelector("#essay-source"),
  essayAnother: document.querySelector("#essay-another"),
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
    setRuntimeState("fallback", false, "");
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
  // If the playlist picker is open, refresh it to show the new playlist
  if (dom.playlistModal && !dom.playlistModal.hidden) {
    renderPlaylistPicker(appState.selectedMovieId);
  }
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
  // Update carousel active outline without a full re-render
  document.querySelectorAll(".carousel-card.carousel-active").forEach((el) => el.classList.remove("carousel-active"));
  document.querySelectorAll(`.carousel-card[data-movie-id="${movieId}"]`).forEach((el) => el.classList.add("carousel-active"));
  openSpotlight();
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

  // Mobile renders per bottom-bar tab: Shelf carousels, Find, Lists, Stats
  if (window.innerWidth <= 1100) {
    const tab = appState.mobileTab || "shelf";
    if (tab === "find") {
      renderFindTab();
    } else if (tab === "lists") {
      renderListsTab();
    } else if (tab === "stats") {
      renderStatsTab();
    } else {
      renderShelfTab(groups.flatMap((g) => g.movies));
    }
    return;
  }

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

// Predefined mobile carousel categories (a movie can appear in several)
// Japanese classic auteurs (live-action + notable animation directors)
const JAPANESE_DIRECTORS = [
  "Akira Kurosawa", "Yasujiro Ozu", "Kenji Mizoguchi", "Masaki Kobayashi",
  "Hayao Miyazaki", "Isao Takahata", "Katsuhiro Otomo", "Mamoru Oshii",
  "Satoshi Kon", "Takashi Miike", "Takeshi Kitano", "Hirokazu Kore-eda",
  "Seijun Suzuki", "Nobuhiko Obayashi", "Kaneto Shindo", "Hideo Nakata",
  "Kon Ichikawa", "Shohei Imamura", "Mikio Naruse",
];

const genreSet = (m) => new Set(getMovieGenres(m));

// Thematic categories, in display order (most engaging first). A movie can
// appear in several.
const CAROUSEL_CATEGORIES = [
  { label: "Romantic Comedies", match: (m, g) => g.has("Romance") && g.has("Comedy") },
  { label: "Japanese Classics", match: (m) => JAPANESE_DIRECTORS.includes(m.director || "") || m.section === "Studio Ghibli" },
  { label: "Sci-Fi & Fantasy", match: (m, g) => g.has("Science Fiction") || g.has("Fantasy") },
  { label: "Action & Adventure", match: (m, g) => g.has("Action") || g.has("Adventure") },
  { label: "Crime & Thrillers", match: (m, g) => g.has("Crime") || g.has("Thriller") || g.has("Mystery") },
  { label: "Horror", match: (m, g) => g.has("Horror") },
  { label: "Dramas", match: (m, g) => g.has("Drama") },
  { label: "Comedies", match: (m, g) => g.has("Comedy") },
  { label: "Animation & Family", match: (m, g) => g.has("Animation") || g.has("Family") },
  { label: "Documentaries", match: (m, g) => g.has("Documentary") },
  { label: "Westerns", match: (m, g) => g.has("Western") },
];

// Studio / collection categories (after thematic + director collections)
const STUDIO_CATEGORIES = [
  { label: "Criterion Collection", match: (m) => m.criterion },
  { label: "Studio Ghibli", match: (m) => m.section === "Studio Ghibli" },
  { label: "Marvel / Superhero", match: (m) => m.section === "Marvel / Superhero" },
];

// Curated "viewing guides" — richer editorial rows farther down, each with
// a blurb explaining why to watch and how the titles connect.
const GUIDE_CAROUSELS = [
  {
    label: "Date Night In",
    match: (m, g) => g.has("Romance"),
    blurb: "Dim the lights and pour something nice. These are the swooners, the slow-burns and the grand gestures — pictures built around two people and the space between them. Start light, end with a good cry, and let the credits roll without checking your phone.",
  },
  {
    label: "Adrenaline Rush",
    match: (m, g) => g.has("Action") && (g.has("Thriller") || g.has("Adventure")),
    blurb: "Set-pieces over subtext. This run is engineered for momentum — chases, shootouts and last-second escapes that never let the tension go slack. Best watched loud, ideally with someone who gasps at the near-misses.",
  },
  {
    label: "Mind-Bending Sci-Fi",
    match: (m, g) => g.has("Science Fiction") && (g.has("Mystery") || g.has("Drama") || g.has("Thriller")),
    blurb: "Sci-fi that treats ideas as the main event. Expect unreliable realities, moral puzzles and endings you'll be arguing about at breakfast. They reward attention — and often a second viewing once you know where they're headed.",
  },
  {
    label: "Family Movie Night",
    match: (m, g) => g.has("Family"),
    blurb: "The all-ages crowd-pleasers: bright, warm and quotable, with just enough wit for the grown-ups. Line up two, make popcorn, and pick the one with the best sing-along for the encore.",
  },
  {
    label: "Late-Night Frights",
    match: (m, g) => g.has("Horror") && (g.has("Thriller") || g.has("Mystery")),
    blurb: "For when the house is quiet and you want it a little less so. These lean on dread and the slow reveal rather than cheap jolts — the kind that follow you to the light switch. Watch back-to-back at your own risk.",
  },
  {
    label: "Feel-Good Comedies",
    match: (m, g) => g.has("Comedy") && (g.has("Family") || g.has("Music") || g.has("Romance") || g.has("Adventure")),
    blurb: "Guaranteed serotonin. No dread, no homework — just sharp jokes, big hearts and characters you'd happily spend a sequel with. The perfect palate-cleanser after something heavy.",
  },
  {
    label: "Epic Sagas",
    match: (m) => (m.runtime || 0) >= 150,
    blurb: "Clear the evening. These are the sprawling, big-canvas pictures — worlds and lifetimes that earn their runtime and reward your patience. Commit to one and let it fully take over the room.",
  },
  {
    label: "Short & Sweet",
    match: (m) => m.runtime && m.runtime <= 95,
    blurb: "Tight, economical and done before bedtime. Not a wasted frame between them — proof that a lean 90 minutes can hit harder than a bloated three hours. Ideal for a school night.",
  },
  {
    label: "Neon '80s",
    match: (m) => m.year >= 1980 && m.year <= 1989,
    blurb: "Synths, practical effects and unfiltered ambition. The decade that gave blockbusters their swagger and horror its slasher — a shelf soaked in nostalgia and still endlessly rewatchable.",
  },
  {
    label: "The '90s Shelf",
    match: (m) => m.year >= 1990 && m.year <= 1999,
    blurb: "The indie boom meets the last great age of the video store. Sharper dialogue, riskier stories and the films that shaped a generation of movie brains. Double-feature two and feel the era.",
  },
  {
    label: "Y2K & Beyond",
    match: (m) => m.year >= 2000 && m.year <= 2009,
    blurb: "The digital turn: franchises going epic, dramas getting bolder, and effects catching up to imagination. A decade that swung big — this is where a lot of modern comfort-watches were born.",
  },
  {
    label: "Modern Masterpieces",
    match: (m) => m.year >= 2010,
    blurb: "The recent greats worth revisiting. Ambitious, beautifully made and already earning their place in the canon. If you missed one in theaters, this is your second chance to catch up.",
  },
  {
    label: "Vintage Vault",
    match: (m) => m.year && m.year < 1970,
    blurb: "The foundations. Black-and-white masters, Golden-Age craft and the classics every later film is quietly in conversation with. Watch one and you'll start spotting its DNA everywhere else on the shelf.",
  },
  {
    label: "Auteur Theory",
    match: (m) => Boolean(m.directorCollection) || m.criterion,
    blurb: "Director-driven cinema, where a single vision runs through every frame. Pair two from the same filmmaker to hear their obsessions rhyme — the recurring themes, the signature shots, the throughline of a career.",
  },
  {
    label: "Crime & Noir",
    match: (m, g) => g.has("Crime") && (g.has("Mystery") || g.has("Thriller") || g.has("Drama")),
    blurb: "Shadows, schemers and the long fall. Heists, investigations and morally slippery anti-heroes — stories where everyone wants something and nobody's clean. Cool, tense, and endlessly stylish.",
  },
];

// Format categories — lowest priority (Steelbooks lives way down here)
const FORMAT_CATEGORIES = [
  { label: "4K UHD", match: (m) => (m.primaryFormat || "").includes("4K") },
  { label: "Steelbooks", match: (m) => m.steelbook },
];

/* -------------------- Mobile bottom-bar tabs -------------------- */

// Quick filters surfaced as chips on the Shelf tab
const SHELF_CHIP_IDS = [
  "all", "favorites", "format-4k", "format-bluray", "format-dvd",
  "criterion", "steelbook", "unwatched", "top-rated",
];

function renderShelfTab(movieList) {
  const head = document.createElement("div");
  head.className = "shelf-head shelf-head-main";
  head.innerHTML = `<h2>Max's Movies</h2>`;
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "shelf-add-btn";
  addBtn.textContent = "＋ Add";
  addBtn.addEventListener("click", openAddMovieModal);
  head.append(addBtn);
  dom.collectionContainer.append(head);

  const chips = document.createElement("div");
  chips.className = "shelf-chips";
  const filter = appState.activeFilter;

  // Active search or a filter picked on another tab shows as a clear chip
  if (appState.search.trim()) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "shelf-chip is-clear";
    clear.textContent = `✕ “${appState.search.trim()}”`;
    clear.addEventListener("click", () => {
      appState.search = "";
      if (dom.searchInput) dom.searchInput.value = "";
      saveState();
      render();
    });
    chips.append(clear);
  }
  if (filter.type !== "preset") {
    const meta = getActiveSelectionMeta();
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "shelf-chip is-clear";
    clear.textContent = `✕ ${meta.heading}`;
    clear.addEventListener("click", () => setActiveFilter("preset", "all"));
    chips.append(clear);
  }

  for (const id of SHELF_CHIP_IDS) {
    const def = getLibraryFilterDefinition(id);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "shelf-chip";
    chip.classList.toggle("is-active", filter.type === "preset" && filter.value === id);
    chip.textContent = def.label;
    chip.addEventListener("click", () => setActiveFilter("preset", id));
    chips.append(chip);
  }
  dom.collectionContainer.append(chips);

  if (!movieList.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>No titles matched</h3><p>Try a different chip, clear the search, or add a movie.</p>";
    dom.collectionContainer.append(empty);
    return;
  }
  renderMobileCarousels(movieList);
}

function renderFindTab() {
  const wrap = document.createElement("div");

  const input = document.createElement("input");
  input.type = "search";
  input.className = "find-search";
  input.placeholder = "Titles, directors, genres, UPC…";
  input.value = appState.search;
  wrap.append(input);

  // Repeat directors as one-tap filters
  const dirs = getDirectorFilters().slice(0, 12);
  if (dirs.length) {
    const chips = document.createElement("div");
    chips.className = "find-chips";
    for (const d of dirs) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "shelf-chip";
      chip.textContent = `${d.label} · ${d.count}`;
      chip.addEventListener("click", () => {
        setActiveFilter("director", d.label);
        setMobileTab("shelf");
      });
      chips.append(chip);
    }
    wrap.append(chips);
  }

  const results = document.createElement("div");
  wrap.append(results);
  dom.collectionContainer.append(wrap);

  const renderResults = () => {
    results.innerHTML = "";
    const term = appState.search.trim().toLowerCase();
    const matched = movies
      .filter((m) => !term || m.searchBlob.includes(term))
      .sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));

    if (!matched.length) {
      results.innerHTML = '<p class="find-empty">Nothing matched. Check the spelling or try a director, genre, or UPC.</p>';
      return;
    }

    const grid = document.createElement("div");
    grid.className = "all-grid";
    const letterEls = new Map();
    let currentLetter = "";
    for (const movie of matched) {
      const first = (movie.sortTitle[0] || "#").toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      if (letter !== currentLetter) {
        currentLetter = letter;
        const h = document.createElement("div");
        h.className = "find-letter";
        h.textContent = letter;
        letterEls.set(letter, h);
        grid.append(h);
      }
      grid.append(renderCarouselCard(movie));
    }
    results.append(grid);

    // Alphabet fast-scroll rail (only worth showing on a long list)
    if (letterEls.size >= 5) {
      const rail = document.createElement("div");
      rail.className = "find-rail";
      for (const [letter, el] of letterEls) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = letter;
        btn.addEventListener("click", () => {
          el.scrollIntoView({ block: "start", behavior: "smooth" });
        });
        rail.append(btn);
      }
      results.append(rail);
    }
  };

  // Re-render only the results while typing so the input keeps focus
  let findTimer = null;
  input.addEventListener("input", () => {
    appState.search = input.value;
    if (dom.searchInput) dom.searchInput.value = input.value;
    saveState();
    clearTimeout(findTimer);
    findTimer = setTimeout(renderResults, 160);
  });

  renderResults();
}

function renderListsTab() {
  const head = document.createElement("div");
  head.className = "shelf-head";
  head.innerHTML = "<h2>Lists</h2>";
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.className = "shelf-add-btn";
  newBtn.textContent = "＋ New list";
  newBtn.addEventListener("click", () => openModal("list-modal"));
  head.append(newBtn);
  dom.collectionContainer.append(head);

  const addRows = (title, items, emptyMessage) => {
    const section = document.createElement("section");
    section.className = "mtab-section";
    section.innerHTML = `<h3>${escapeHtml(title)}</h3>`;
    const rows = document.createElement("div");
    rows.className = "mtab-rows";
    if (!items.length) {
      rows.innerHTML = `<p class="find-empty">${escapeHtml(emptyMessage)}</p>`;
    }
    for (const item of items) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "mtab-row";
      row.classList.toggle("is-active", item.active);
      row.innerHTML = `
        <span><span class="row-label">${escapeHtml(item.label)}</span>
        ${item.sub ? `<span class="row-sub">${escapeHtml(item.sub)}</span>` : ""}</span>
        <span class="row-count">${item.count}</span>
      `;
      row.addEventListener("click", item.onClick);
      rows.append(row);
    }
    section.append(rows);
    dom.collectionContainer.append(section);
  };

  addRows(
    "Your Lists",
    appState.lists.map((list) => ({
      label: list.name,
      count: list.movieIds.length,
      active: appState.activeFilter.type === "list" && appState.activeFilter.value === list.id,
      onClick: () => {
        setActiveFilter("list", list.id);
        setMobileTab("shelf");
      },
    })),
    "No lists yet. Create one with the button above."
  );

  addRows(
    "AI Playlists",
    buildAiPlaylists().map((playlist) => ({
      label: playlist.label,
      sub: playlist.description,
      count: playlist.movieIds.length,
      active: appState.activeFilter.type === "playlist" && appState.activeFilter.value === playlist.id,
      onClick: () => {
        setActiveFilter("playlist", playlist.id);
        setMobileTab("shelf");
      },
    })),
    "Playlists appear once the catalog loads."
  );

  addRows(
    "Genres",
    getGenreFilters().map((genre) => ({
      label: genre.label,
      count: genre.count,
      active: appState.activeFilter.type === "genre" && appState.activeFilter.value === genre.label,
      onClick: () => {
        setActiveFilter("genre", genre.label);
        setMobileTab("shelf");
      },
    })),
    "No genres found."
  );
}

function renderStatsTab() {
  const head = document.createElement("div");
  head.className = "shelf-head";
  head.innerHTML = "<h2>Stats</h2>";
  dom.collectionContainer.append(head);

  const grid = document.createElement("div");
  grid.className = "stats-grid";
  for (const stat of getStats()) {
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    tile.innerHTML = `
      <div class="stat-value">${escapeHtml(String(stat.value))}</div>
      <div class="stat-label">${escapeHtml(stat.label)}</div>
    `;
    grid.append(tile);
  }
  dom.collectionContainer.append(grid);

  const settings = document.createElement("section");
  settings.className = "mtab-section";
  settings.innerHTML = "<h3>Sort &amp; View</h3>";
  const sg = document.createElement("div");
  sg.className = "settings-grid";

  const makeSelect = (label, options, current, onChange) => {
    const field = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = label;
    const select = document.createElement("select");
    for (const [value, text] of options) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      select.append(opt);
    }
    select.value = current;
    select.addEventListener("change", () => onChange(select.value));
    field.append(span, select);
    sg.append(field);
  };

  makeSelect("Theme", [
    ["warm", "Warm"], ["midnight", "Midnight"], ["ocean", "Ocean"],
    ["forest", "Forest"], ["rose", "Rosé"],
  ], appState.theme, (value) => {
    appState.theme = value;
    if (dom.themeSelect) dom.themeSelect.value = value;
    if (dom.themeSelectM) dom.themeSelectM.value = value;
    applyTheme();
    saveState();
  });

  makeSelect("Sort", [
    ["inventory", "Inventory Order"], ["title", "Title A-Z"], ["section", "Category"],
    ["favorites", "Favorites First"], ["value", "Most Valuable"], ["rating", "Highest Rated"],
  ], appState.sort, (value) => {
    appState.sort = value;
    if (dom.sortSelect) dom.sortSelect.value = value;
    saveState();
    render();
  });

  makeSelect("Organize", [
    ["none", "Flat View"], ["section", "By Category"], ["format", "By Format"],
    ["director", "By Director"], ["tag", "By Collection Tag"],
  ], appState.group, (value) => {
    appState.group = value;
    if (dom.groupSelect) dom.groupSelect.value = value;
    saveState();
    render();
  });

  settings.append(sg);
  dom.collectionContainer.append(settings);
}

function renderMobileCarousels(movieList) {
  // Dedupe by id
  const seen = new Set();
  const unique = [];
  for (const m of movieList) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      unique.push(m);
    }
  }

  // Full-page A-Z grid (reached via a carousel's "See all")
  if (appState.mobileAllView) {
    renderAllMoviesGrid(unique);
    return;
  }

  const MIN_THEME = 4; // min titles to justify a thematic carousel
  const sections = [];

  for (const cat of CAROUSEL_CATEGORIES) {
    const matched = unique.filter((m) => cat.match(m, genreSet(m)));
    if (matched.length >= MIN_THEME) sections.push({ label: cat.label, movies: matched });
  }

  // Director collections — one carousel each
  const collMap = new Map();
  for (const m of unique) {
    if (!m.directorCollection) continue;
    if (!collMap.has(m.directorCollection)) collMap.set(m.directorCollection, []);
    collMap.get(m.directorCollection).push(m);
  }
  const dirSections = [...collMap.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([label, list]) => ({ label: `${label} Collection`, movies: list }));

  const studioSections = [];
  for (const cat of STUDIO_CATEGORIES) {
    const matched = unique.filter(cat.match);
    if (matched.length >= 2) studioSections.push({ label: cat.label, movies: matched });
  }

  // Curated viewing guides (with "why watch" blurbs)
  const guideSections = [];
  for (const guide of GUIDE_CAROUSELS) {
    const matched = unique.filter((m) => guide.match(m, genreSet(m)));
    if (matched.length >= 3) guideSections.push({ label: guide.label, blurb: guide.blurb, movies: matched });
  }

  const formatSections = [];
  for (const cat of FORMAT_CATEGORIES) {
    const matched = unique.filter(cat.match);
    if (matched.length >= 2) formatSections.push({ label: cat.label, movies: matched });
  }

  // Shuffle the main pool randomly (stable within a page load, reshuffled on
  // reload), keep the "All Movies A-Z" row a few down, and pin formats
  // (Steelbooks) to the very bottom.
  const pool = [...sections, ...dirSections, ...studioSections, ...guideSections];
  pool.sort((a, b) => carouselRank(a.label) - carouselRank(b.label));

  // Personal playlist carousels (non-empty) — pinned near the top
  const playlistSections = appState.lists
    .map((list) => ({
      label: list.name,
      isPlaylist: true,
      filter: { type: "list", value: list.id },
      movies: list.movieIds.map((id) => getMovieById(id)).filter(Boolean),
    }))
    .filter((s) => s.movies.length);

  const ordered = [...pool];
  ordered.unshift(...playlistSections);

  // Guarantee "All Movies A-Z" sits within the top 3 rows every reload.
  const azSection = {
    label: "All Movies A-Z",
    seeAll: true,
    movies: [...unique].sort((a, b) => a.sortTitle.localeCompare(b.sortTitle)),
  };
  const azPos = Math.floor(carouselRank("__all-az__") * 3); // 0, 1, or 2 (stable per load)
  ordered.splice(Math.min(azPos, ordered.length), 0, azSection);
  ordered.push(...formatSections);

  for (const section of ordered) renderCarouselSection(section);
}

// Random-but-stable ordering per page load: each label gets a random rank the
// first time it's seen; the map is fresh on every reload, so carousels
// reshuffle on reload but don't jump around during a session.
const _carouselRank = new Map();
function carouselRank(label) {
  if (!_carouselRank.has(label)) _carouselRank.set(label, Math.random());
  return _carouselRank.get(label);
}

function renderCarouselSection(section) {
  const wrap = document.createElement("section");
  wrap.className = section.isPlaylist ? "carousel-section carousel-playlist" : "carousel-section";

  const head = document.createElement("div");
  head.className = "carousel-head";
  const guideBtn = section.blurb
    ? '<button class="carousel-guide-toggle" type="button" aria-label="Why watch these" aria-expanded="false">i</button>'
    : "";
  const trailing = section.seeAll
    ? '<button class="carousel-see-all" type="button">See all →</button>'
    : `<span class="carousel-count">${section.movies.length}</span>`;
  head.innerHTML = `<div class="carousel-head-main"><h3>${escapeHtml(section.label)}</h3>${guideBtn}</div>${trailing}`;
  wrap.append(head);

  if (section.seeAll) {
    head.querySelector(".carousel-see-all").addEventListener("click", () => {
      appState.mobileAllView = true;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Expandable "why watch" guide blurb
  if (section.blurb) {
    const guide = document.createElement("div");
    guide.className = "carousel-guide";
    guide.hidden = true;
    guide.innerHTML = `<p>${escapeHtml(section.blurb)}</p>`;
    wrap.append(guide);

    const btn = head.querySelector(".carousel-guide-toggle");
    btn.addEventListener("click", () => {
      const open = guide.hidden;
      guide.hidden = !open;
      btn.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  }

  const track = document.createElement("div");
  track.className = "carousel-track";
  // Cap cards per carousel to keep the DOM light (thousands of posters froze
  // the page). Full lists remain reachable via "All Movies A-Z → See all".
  const CAROUSEL_CAP = 24;
  for (const movie of section.movies.slice(0, CAROUSEL_CAP)) track.append(renderCarouselCard(movie));
  wrap.append(track);
  dom.collectionContainer.append(wrap);
}

function renderAllMoviesGrid(list) {
  const byTitle = [...list].sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));

  const header = document.createElement("div");
  header.className = "all-grid-header";
  header.innerHTML = `
    <button class="all-grid-back" type="button">← Back</button>
    <h3>All Movies A-Z</h3>
    <span class="carousel-count">${byTitle.length}</span>
  `;
  header.querySelector(".all-grid-back").addEventListener("click", () => {
    appState.mobileAllView = false;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  dom.collectionContainer.append(header);

  const grid = document.createElement("div");
  grid.className = "all-grid";
  for (const movie of byTitle) grid.append(renderCarouselCard(movie));
  dom.collectionContainer.append(grid);
}

function renderCarouselCard(movie) {
  const card = document.createElement("div");
  card.className = "carousel-card";
  card.dataset.movieId = movie.id;
  if (movie.id === appState.selectedMovieId) card.classList.add("carousel-active");

  const poster = document.createElement("div");
  poster.className = "carousel-poster";
  if (movie.posterUrl) {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = movie.posterUrl;
    img.alt = movie.title;
    poster.append(img);
  } else {
    applyPosterStyle(poster, movie.posterPalette);
    const fallback = document.createElement("div");
    fallback.className = "carousel-poster-fallback";
    fallback.textContent = movie.title;
    poster.append(fallback);
  }

  const badges = document.createElement("div");
  badges.className = "carousel-badges";
  renderFormatBadges(badges, movie);
  poster.append(badges);

  const watchBtn = document.createElement("button");
  watchBtn.type = "button";
  watchBtn.className = "carousel-watch";
  updateWatchToggle(watchBtn, movie.watchStatus);
  watchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = movie.watchStatus === "Watched" ? "Unwatched" : "Watched";
    movie.watchStatus = next;
    updateWatchToggle(watchBtn, next);
    saveMovieMetadata(movie.id, { watchStatus: next });
  });
  poster.append(watchBtn);

  const title = document.createElement("p");
  title.className = "carousel-card-title";
  title.textContent = movie.title;

  card.append(poster, title);
  card.addEventListener("click", () => selectMovie(movie.id));
  return card;
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
  renderFormatBadges(node.querySelector(".format-badges"), movie);
  const watchBtn = node.querySelector(".watch-toggle");
  updateWatchToggle(watchBtn, movie.watchStatus);
  watchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = movie.watchStatus === "Watched" ? "Unwatched" : "Watched";
    movie.watchStatus = next;
    updateWatchToggle(watchBtn, next);
    saveMovieMetadata(movie.id, { watchStatus: next });
  });
  node.querySelector(".poster-button").addEventListener("click", () => selectMovie(movie.id));
  node.querySelector(".open-detail-button").addEventListener("click", () => {
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

function renderFormatBadges(container, movie) {
  container.innerHTML = "";
  const fmt = movie.primaryFormat || "";
  const defs = [];
  if (fmt.includes("4K")) defs.push({ cls: "fmt-4k", label: "4K", title: "4K UHD" });
  if (fmt.includes("Blu-ray")) defs.push({ cls: "fmt-bd", label: "BD", title: "Blu-ray" });
  if (fmt === "DVD") defs.push({ cls: "fmt-dvd", label: "DVD", title: "DVD" });
  if (movie.criterion) defs.push({ cls: "fmt-cc", label: "CC", title: "Criterion Collection" });
  if (movie.steelbook) defs.push({ cls: "fmt-sb", label: "SB", title: "Steelbook" });
  if (movie.moviesAnywhere) defs.push({ cls: "fmt-ma", label: "MA", title: "Movies Anywhere" });
  for (const d of defs) {
    const span = document.createElement("span");
    span.className = `fmt-badge ${d.cls}`;
    span.textContent = d.label;
    span.title = d.title;
    container.append(span);
  }
}

function updateWatchToggle(btn, watchStatus) {
  const watched = watchStatus === "Watched";
  btn.classList.toggle("is-watched", watched);
  btn.innerHTML = watched
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  btn.title = watched ? "Watched — click to mark unwatched" : "Mark as watched";
  btn.setAttribute("aria-label", watched ? "Mark unwatched" : "Mark watched");
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
  renderDetailIconRail(movie);
  if (dom.detailHeroTitle) dom.detailHeroTitle.textContent = movie.title;
  if (dom.detailQuickInfo) {
    const metaParts = [
      movie.year,
      movie.director,
      movie.runtime ? `${movie.runtime} min` : null,
      movie.primaryFormat,
    ].filter(Boolean).join(" · ");
    dom.detailQuickInfo.hidden = false;
    dom.detailQuickInfo.innerHTML = `
      <p class="detail-quick-title">${escapeHtml(movie.title)}</p>
      ${metaParts ? `<p class="detail-quick-meta">${escapeHtml(metaParts)}</p>` : ""}
      ${movie.overview ? `<p class="detail-quick-overview">${escapeHtml(movie.overview)}</p>` : ""}
    `;
  }
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
  // Editors stay enabled even without a live API — changes apply in memory.
  const isReadOnly = false;
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

// Small designed trait icons shown in the detail rail (and reused elsewhere)
function movieTraitIcons(movie) {
  const icons = [];
  const fmt = movie.primaryFormat || "";
  if (fmt.includes("4K")) icons.push({ text: "4K", cls: "tag-4k", label: "4K UHD" });
  if (fmt.includes("Blu-ray")) icons.push({ text: "BD", cls: "tag-bd", label: "Blu-ray" });
  if (fmt === "DVD") icons.push({ text: "DVD", cls: "tag-dvd", label: "DVD" });
  if (movie.criterion) icons.push({ text: "C", cls: "tag-cc", label: "Criterion" });
  if (movie.steelbook) icons.push({ text: "S", cls: "tag-sb", label: "Steelbook" });
  if (movie.moviesAnywhere) icons.push({ text: "MA", cls: "tag-ma", label: "Movies Anywhere" });
  return icons;
}

/* -------------------- Spotlight sheet (mobile) -------------------- */

function isMobileViewport() {
  return window.innerWidth <= 1100;
}

function openSpotlight() {
  if (!isMobileViewport() || !dom.detailPanel) return;
  dom.detailPanel.classList.add("is-open");
  dom.detailPanel.scrollTop = 0;
  dom.sheetBackdrop?.removeAttribute("hidden");
  dom.sheetBackdrop?.classList.add("is-visible");
  document.body.classList.add("sheet-locked");
}

function closeSpotlight() {
  dom.detailPanel?.classList.remove("is-open");
  dom.sheetBackdrop?.classList.remove("is-visible");
  document.body.classList.remove("sheet-locked");
}

function setMobileTab(tab) {
  appState.mobileTab = tab;
  closeSpotlight();
  document.querySelectorAll("#mobile-tabbar .mtab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  });
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function makeRailIcon(ariaLabel, svgInner) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "rail-icon";
  btn.setAttribute("aria-label", ariaLabel);
  btn.title = ariaLabel;
  btn.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgInner}</svg>`;
  return btn;
}

function renderDetailIconRail(movie) {
  const rail = dom.detailIconRail;
  if (!rail) return;
  rail.innerHTML = "";

  // Watched toggle
  const watched = movie.watchStatus === "Watched";
  const watch = document.createElement("button");
  watch.type = "button";
  watch.className = "rail-icon";
  watch.classList.toggle("is-watched", watched);
  updateWatchToggle(watch, movie.watchStatus);
  watch.setAttribute("aria-label", watched ? "Watched — tap to unmark" : "Mark as watched");
  watch.addEventListener("click", () => {
    const next = watched ? "Unwatched" : "Watched";
    movie.watchStatus = next;
    saveMovieMetadata(movie.id, { watchStatus: next });
    renderDetailIconRail(getMovieById(movie.id) || movie);
  });

  // Full description (book icon)
  const desc = makeRailIcon("Full description",
    `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`
  );
  desc.addEventListener("click", openEssayModal);

  // Add to playlist (plus icon)
  const playlist = makeRailIcon("Add to playlist",
    `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`
  );
  playlist.addEventListener("click", openPlaylistModal);

  rail.append(watch, desc, playlist);

  // Change cover — only when a TMDB ID exists
  if (movie.tmdbId) {
    const cover = makeRailIcon("Change cover art",
      `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>`
    );
    cover.addEventListener("click", () => openPosterCarousel(movie));
    rail.append(cover);
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
          <div class="detail-case-back-band" aria-hidden="true"></div>
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

  // The cover picker is reachable from the "Change cover" button in the hero
  // action row (discoverable on mobile), enabled when alternate covers can be
  // fetched for this title.
  if (dom.changeCoverBtn) {
    dom.changeCoverBtn.hidden = !movie.tmdbId;
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
    const tryDownload = async (url, body) => {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return resp.ok ? resp.json() : { localUrl: null };
      } catch {
        return { localUrl: null };
      }
    };

    const [frontDownload, backDownload, spineDownload] = await Promise.all([
      tryDownload("./api/poster/download", { remoteUrl: poster.frontUrl, movieId: movie.id }),
      poster.backUrl
        ? tryDownload("./api/artwork/download", { remoteUrl: poster.backUrl, movieId: movie.id, role: "back" })
        : Promise.resolve({ localUrl: "" }),
      poster.spineUrl
        ? tryDownload("./api/artwork/download", { remoteUrl: poster.spineUrl, movieId: movie.id, role: "spine" })
        : Promise.resolve({ localUrl: "" }),
    ]);

    const changes = {
      posterUrl: frontDownload.localUrl || poster.frontUrl,
      backCoverUrl: backDownload.localUrl || poster.backUrl || "",
      spineArtUrl: spineDownload.localUrl || poster.spineUrl || "",
      artworkSourceName: poster.sourceName || "",
      artworkSourceUrl: poster.sourceUrl || "",
    };

    try {
      await patchMovie(movie.id, changes);
    } catch {
      Object.assign(movie, changes);
    }

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
  if (dom.themeSelectM) dom.themeSelectM.value = appState.theme;
  if (dom.sortSelectM) dom.sortSelectM.value = appState.sort;
  if (dom.groupSelectM) dom.groupSelectM.value = appState.group;
  if (dom.viewSelectM) dom.viewSelectM.value = appState.view;
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

/* -------------------- Add to playlist -------------------- */

function openPlaylistModal() {
  const movie = getMovieById(appState.selectedMovieId);
  if (!movie) return;
  renderPlaylistPicker(movie.id);
  openModal("playlist-modal");
}

function renderPlaylistPicker(movieId) {
  const picker = dom.playlistPicker;
  if (!picker) return;
  picker.innerHTML = "";
  if (!appState.lists.length) {
    picker.innerHTML = '<p class="muted-text">No playlists yet. Create one below.</p>';
    return;
  }
  for (const list of appState.lists) {
    const inList = list.movieIds.includes(movieId);
    const row = document.createElement("div");
    row.className = "playlist-row";
    row.innerHTML = `
      <div class="playlist-row-info">
        <h4>${escapeHtml(list.name)}</h4>
        <p>${list.movieIds.length} ${list.movieIds.length === 1 ? "film" : "films"}</p>
      </div>
      <button class="list-toggle${inList ? " is-on" : ""}" type="button">${inList ? "✓ Added" : "Add"}</button>
    `;
    row.querySelector(".list-toggle").addEventListener("click", async () => {
      await toggleMovieInList(list.id, movieId);
      renderPlaylistPicker(movieId);
    });
    picker.append(row);
  }
}

/* -------------------- Full description / film essay -------------------- */

const essayState = { movieId: null, altIndex: 0 };

// Local cache so essays persist across reloads even without the catalog API.
const ESSAY_CACHE_KEY = "md-essays-v1";
function readEssayCache() {
  try {
    return JSON.parse(window.localStorage.getItem(ESSAY_CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function getCachedEssay(movieId) {
  return readEssayCache()[movieId] || null;
}
function setCachedEssay(movieId, data) {
  try {
    const cache = readEssayCache();
    cache[movieId] = data;
    window.localStorage.setItem(ESSAY_CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full or unavailable — ignore */ }
}

// Build a readable essay (lead + critical-reception praise) from a Wikipedia
// plain-text article extract.
function composeEssay(extract) {
  if (!extract) return "";
  const headerRe = /^={2,}\s*(.+?)\s*={2,}\s*$/;
  const lead = [];
  const sections = new Map();
  let current = null;
  for (const line of extract.split("\n")) {
    const m = line.match(headerRe);
    if (m) {
      current = m[1].trim();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current === null) lead.push(line);
    else sections.get(current).push(line);
  }
  let essay = lead.join("\n").trim();
  // Prefer sections that carry critical praise / legacy
  let praise = "";
  for (const [title, body] of sections) {
    if (!/recept|critical|response|acclaim|praise|legacy|impact/i.test(title)) continue;
    const text = body.join("\n").trim();
    if (!text) continue;
    praise += `${praise ? "\n\n" : ""}${text}`;
    if (praise.length > 1800) break;
  }
  if (praise) essay += `\n\n${praise}`;
  essay = essay.replace(/\n{3,}/g, "\n\n").trim();
  if (essay.length > 4200) essay = `${essay.slice(0, 4200).replace(/\s+\S*$/, "")}…`;
  return essay;
}

async function fetchFilmEssay(movie, altIndex = 0) {
  const query = encodeURIComponent(`${movie.title} ${movie.year || ""} film`.trim());
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srlimit=6&srsearch=${query}`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error("search failed");
  const searchData = await searchRes.json();
  const results = searchData?.query?.search || [];
  if (!results.length) throw new Error("No article found for this title.");
  const pick = results[altIndex % results.length];
  const pageTitle = pick.title;

  const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=${encodeURIComponent(pageTitle)}`;
  const exRes = await fetch(extractUrl);
  if (!exRes.ok) throw new Error("extract failed");
  const exData = await exRes.json();
  const page = Object.values(exData?.query?.pages || {})[0];
  const essay = composeEssay(page?.extract || "");
  if (!essay) throw new Error("Couldn't build an essay from that article.");

  return {
    text: essay,
    sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`,
    sourceTitle: pageTitle,
  };
}

function renderEssay(text, sourceUrl, sourceTitle) {
  dom.essayBody.innerHTML = "";
  for (const para of String(text).split(/\n+/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const p = document.createElement("p");
    p.textContent = trimmed;
    dom.essayBody.append(p);
  }
  if (sourceUrl) {
    dom.essaySource.innerHTML = `Source: <a href="${escapeAttr(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceTitle || "Wikipedia")}</a> · text from Wikipedia (CC BY-SA)`;
    dom.essaySource.hidden = false;
  } else {
    dom.essaySource.hidden = true;
  }
}

function setEssayLoading(message) {
  dom.essayBody.innerHTML = `<p class="essay-loading">${escapeHtml(message)}</p>`;
  dom.essaySource.hidden = true;
}

async function loadEssay({ replace = false } = {}) {
  const movie = getMovieById(essayState.movieId);
  if (!movie) return;

  // Show the cached essay instantly unless the user asked for a new one
  if (!replace && movie.essay) {
    renderEssay(movie.essay, movie.essaySource, movie.essaySourceTitle);
    return;
  }
  if (!replace) {
    const cached = getCachedEssay(movie.id);
    if (cached) {
      movie.essay = cached.text;
      movie.essaySource = cached.sourceUrl;
      movie.essaySourceTitle = cached.sourceTitle;
      renderEssay(cached.text, cached.sourceUrl, cached.sourceTitle);
      return;
    }
  }

  if (replace) essayState.altIndex += 1;
  dom.essayAnother.disabled = true;
  setEssayLoading(replace ? "Finding another essay online…" : "Fetching a full description online…");

  try {
    const result = await fetchFilmEssay(movie, essayState.altIndex);
    renderEssay(result.text, result.sourceUrl, result.sourceTitle);
    // Cache to the film record (persists to the DB when the catalog API is live)
    saveMovieMetadataQuiet(movie.id, {
      essay: result.text,
      essaySource: result.sourceUrl,
      essaySourceTitle: result.sourceTitle,
    });
    movie.essay = result.text;
    movie.essaySource = result.sourceUrl;
    movie.essaySourceTitle = result.sourceTitle;
    setCachedEssay(movie.id, { text: result.text, sourceUrl: result.sourceUrl, sourceTitle: result.sourceTitle });
  } catch (error) {
    console.error("Essay fetch failed:", error);
    dom.essayBody.innerHTML = `<p class="essay-loading">Couldn't load an essay right now (${escapeHtml(error.message || "network error")}). Please try again.</p>`;
    dom.essaySource.hidden = true;
  } finally {
    dom.essayAnother.disabled = false;
  }
}

function openEssayModal() {
  const movie = getMovieById(appState.selectedMovieId);
  if (!movie) return;
  essayState.movieId = movie.id;
  essayState.altIndex = 0;
  dom.essayModalTitle.textContent = movie.title;
  openModal("essay-modal");
  loadEssay({ replace: false });
}

function openSidebar() {
  dom.sidebar?.classList.add("sidebar-open");
  dom.sidebarBackdrop?.classList.add("is-visible");
  dom.sidebarToggle?.classList.add("is-open");
  dom.sidebarToggle?.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  dom.sidebar?.classList.remove("sidebar-open");
  dom.sidebarBackdrop?.classList.remove("is-visible");
  dom.sidebarToggle?.classList.remove("is-open");
  dom.sidebarToggle?.setAttribute("aria-expanded", "false");
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
    // No live catalog API (e.g. static deploy) — apply changes in memory only.
    Object.assign(movie, changes);
    setSaveStatus("Saved locally", "idle");
    renderDetail();
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
    // Degrade gracefully to in-memory changes without surfacing an error banner.
    Object.assign(movie, changes);
    setRuntimeState("fallback", false, "");
    setSaveStatus("Saved locally", "idle");
    renderDetail();
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
      dom.sidebar.classList.contains("sidebar-open") ? closeSidebar() : openSidebar();
    });
  }
  if (dom.sidebarBackdrop) {
    dom.sidebarBackdrop.addEventListener("click", closeSidebar);
  }
  if (dom.sidebarClose) {
    dom.sidebarClose.addEventListener("click", closeSidebar);
  }
  // Close the drawer after picking a filter on mobile
  if (dom.sidebar) {
    dom.sidebar.addEventListener("click", (event) => {
      if (event.target.closest(".nav-button") && window.innerWidth <= 1100) {
        closeSidebar();
      }
    });
  }

  // Master details expand/collapse control
  const detailToggle = document.querySelector("#detail-toggle");
  const detailEditorial = document.querySelector("#detail-editorial");
  if (detailToggle && detailEditorial) {
    detailToggle.addEventListener("click", () => {
      const collapsed = detailEditorial.classList.toggle("is-collapsed");
      detailToggle.setAttribute("aria-expanded", String(!collapsed));
      detailToggle.querySelector(".detail-toggle-label").textContent = collapsed ? "Show details" : "Hide details";
    });
  }

  // Spotlight sheet: grabber and backdrop both dismiss
  if (dom.heroCollapse) {
    dom.heroCollapse.addEventListener("click", closeSpotlight);
  }
  if (dom.detailCloseBottom) {
    dom.detailCloseBottom.addEventListener("click", closeSpotlight);
  }
  if (dom.sheetBackdrop) {
    dom.sheetBackdrop.addEventListener("click", closeSpotlight);
  }

  // Bottom tab bar
  document.querySelectorAll("#mobile-tabbar .mtab").forEach((btn) => {
    btn.addEventListener("click", () => setMobileTab(btn.dataset.tab));
  });

  // Add to playlist
  if (dom.addPlaylistBtn) {
    dom.addPlaylistBtn.addEventListener("click", openPlaylistModal);
  }
  if (dom.playlistNewBtn) {
    dom.playlistNewBtn.addEventListener("click", () => openModal("list-modal"));
  }

  // Change cover art — opens the alternate-cover picker for the selection.
  if (dom.changeCoverBtn) {
    dom.changeCoverBtn.addEventListener("click", () => {
      const movie = getMovieById(appState.selectedMovieId);
      if (movie) openPosterCarousel(movie);
    });
  }

  // Double-tap / double-click the cover to flip it and show the back. The
  // WebGL viewer handles its own flip; this covers the CSS-case fallback that
  // renders when the 3D viewer isn't active.
  if (dom.detailPoster) {
    let lastPosterTap = 0;
    let posterDownX = 0;
    let posterDownY = 0;
    let posterMoved = false;
    dom.detailPoster.addEventListener("pointerdown", (e) => {
      posterDownX = e.clientX;
      posterDownY = e.clientY;
      posterMoved = false;
    });
    dom.detailPoster.addEventListener("pointermove", (e) => {
      if (!posterMoved && Math.hypot(e.clientX - posterDownX, e.clientY - posterDownY) > 8) {
        posterMoved = true;
      }
    });
    dom.detailPoster.addEventListener("pointerup", () => {
      if (posterMoved) return;
      // The 3D viewer owns the flip when its canvas is present.
      if (dom.detailPoster.querySelector(".case-viewer-canvas")) return;
      const caseObj = dom.detailPoster.querySelector(".detail-case-object");
      if (!caseObj) return;
      const now = performance.now();
      if (now - lastPosterTap < 320) {
        lastPosterTap = 0;
        caseObj.classList.toggle("is-flipped");
      } else {
        lastPosterTap = now;
      }
    });
  }

  // Full description / film essay
  if (dom.fullDescBtn) {
    dom.fullDescBtn.addEventListener("click", openEssayModal);
  }
  if (dom.essayAnother) {
    dom.essayAnother.addEventListener("click", () => loadEssay({ replace: true }));
  }

  // Re-render when crossing the mobile/desktop breakpoint
  let lastIsMobile = window.innerWidth <= 1100;
  window.addEventListener("resize", () => {
    const isMobile = window.innerWidth <= 1100;
    if (isMobile !== lastIsMobile) {
      lastIsMobile = isMobile;
      if (!isMobile) closeSpotlight();
      render();
    }
  });

  // Mobile sidebar view controls
  if (dom.themeSelectM) {
    dom.themeSelectM.addEventListener("change", (e) => {
      appState.theme = e.target.value;
      dom.themeSelect.value = e.target.value;
      applyTheme();
      saveState();
    });
  }
  if (dom.sortSelectM) {
    dom.sortSelectM.addEventListener("change", (e) => {
      appState.sort = e.target.value;
      dom.sortSelect.value = e.target.value;
      saveState();
      render();
    });
  }
  if (dom.groupSelectM) {
    dom.groupSelectM.addEventListener("change", (e) => {
      appState.group = e.target.value;
      dom.groupSelect.value = e.target.value;
      saveState();
      render();
    });
  }
  if (dom.viewSelectM) {
    dom.viewSelectM.addEventListener("change", (e) => {
      setView(e.target.value);
    });
  }
  if (dom.addMovieButtonM) {
    dom.addMovieButtonM.addEventListener("click", () => {
      closeSidebar();
      openAddMovieModal();
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
      closeSidebar();
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
  ensureWatchlists();
  applyTheme();
  ensureSelectedMovie();
  bindEvents();
  render();
  runPosterBackfill();
}

init();
