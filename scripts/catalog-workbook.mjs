import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const workbookPath = path.join(rootDir, "outputs", "catalog", "Movie Collection Catalog.xlsx");
export const catalogSheetName = "Catalog";

export const editableMovieFields = new Set([
  "primaryFormat",
  "steelbook",
  "criterion",
  "moviesAnywhere",
  "watchStatus",
  "personalRating",
  "notes",
  "purchasePrice",
  "estimatedValue",
  "valueSource",
  "valueDate",
  "condition",
  "specialFeatures",
  "seedFavorite",
  "seedLists",
  "upc",
  "tmdbId",
  "year",
  "director",
  "runtime",
  "genre",
  "posterUrl",
  "backCoverUrl",
  "spineArtUrl",
  "artworkSourceName",
  "artworkSourceUrl",
  "overview",
]);

const catalogColumns = [
  { header: "ID", key: "id", defaultValue: "" },
  { header: "Inventory #", key: "inventoryNumber", defaultValue: "" },
  { header: "Title", key: "title", defaultValue: "" },
  { header: "Raw Title", key: "rawTitle", defaultValue: "" },
  { header: "Sort Title", key: "sortTitle", defaultValue: "" },
  { header: "Section", key: "section", defaultValue: "" },
  { header: "Subsection", key: "subsection", defaultValue: "" },
  { header: "Director Collection", key: "directorCollection", defaultValue: "" },
  { header: "Primary Format", key: "primaryFormat", defaultValue: "Blu-ray" },
  { header: "Collection Type", key: "collectionType", defaultValue: "Single Feature" },
  { header: "Tags", key: "tags", defaultValue: "" },
  { header: "Edition Notes", key: "editionNotes", defaultValue: "" },
  { header: "Steelbook", key: "steelbook", defaultValue: false },
  { header: "Criterion", key: "criterion", defaultValue: false },
  { header: "Movies Anywhere", key: "moviesAnywhere", defaultValue: false },
  { header: "Seed Favorite", key: "seedFavorite", defaultValue: false },
  { header: "Seed Lists", key: "seedLists", defaultValue: "" },
  { header: "Watch Status", key: "watchStatus", defaultValue: "" },
  { header: "Personal Rating", key: "personalRating", defaultValue: "" },
  { header: "Notes", key: "notes", defaultValue: "" },
  { header: "Purchase Price", key: "purchasePrice", defaultValue: "" },
  { header: "Estimated Value", key: "estimatedValue", defaultValue: "" },
  { header: "Value Source", key: "valueSource", defaultValue: "" },
  { header: "Value Date", key: "valueDate", defaultValue: "" },
  { header: "Condition", key: "condition", defaultValue: "" },
  { header: "Special Features", key: "specialFeatures", defaultValue: "" },
  { header: "UPC", key: "upc", defaultValue: "" },
  { header: "TMDb ID", key: "tmdbId", defaultValue: "" },
  { header: "Year", key: "year", defaultValue: "" },
  { header: "Director", key: "director", defaultValue: "" },
  { header: "Runtime", key: "runtime", defaultValue: "" },
  { header: "Genre", key: "genre", defaultValue: "" },
  { header: "Poster URL", key: "posterUrl", defaultValue: "" },
  { header: "Back Cover URL", key: "backCoverUrl", defaultValue: "" },
  { header: "Spine Art URL", key: "spineArtUrl", defaultValue: "" },
  { header: "Artwork Source Name", key: "artworkSourceName", defaultValue: "" },
  { header: "Artwork Source URL", key: "artworkSourceUrl", defaultValue: "" },
  { header: "Overview", key: "overview", defaultValue: "" },
];

const FORMAT_NORMALIZE = {
  "4K / Blu-ray": "4K + Blu-ray",
  "Archive": "Blu-ray",
  "Criterion": "Blu-ray",
  "Steelbook": "Blu-ray",
  "Series": "Blu-ray",
  "Collection": "Blu-ray",
  "Trilogy": "Blu-ray",
  "Digital": "Blu-ray",
};

function normalizeFormat(format) {
  const trimmed = String(format ?? "").trim();
  return FORMAT_NORMALIZE[trimmed] || trimmed || "Blu-ray";
}

function splitPipeString(value) {
  return String(value ?? "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value) {
  return ["true", "yes", "1", "y"].includes(String(value ?? "").trim().toLowerCase());
}

function parseNumber(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTitle(title) {
  return String(title ?? "")
    .replace(/^The\s+/i, "")
    .replace(/^A\s+/i, "")
    .replace(/^An\s+/i, "")
    .trim();
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildMovieTags(rowObject) {
  const tagValues = splitPipeString(rowObject.Tags);
  const merged = [...tagValues];
  if (parseBoolean(rowObject.Steelbook) || tagValues.includes("Steelbook")) {
    if (!merged.includes("Steelbook")) merged.push("Steelbook");
  }
  if (
    parseBoolean(rowObject.Criterion) ||
    tagValues.includes("Criterion") ||
    String(rowObject["Primary Format"]).trim() === "Criterion"
  ) {
    if (!merged.includes("Criterion")) merged.push("Criterion");
  }
  return uniqueValues(merged);
}

function toRowObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
}

function ensureRowWidth(row, width) {
  const next = [...row];
  while (next.length < width) {
    next.push("");
  }
  return next;
}

export async function loadWorkbookFile() {
  const input = await FileBlob.load(workbookPath);
  return SpreadsheetFile.importXlsx(input);
}

export async function saveWorkbookFile(workbook) {
  await fs.mkdir(path.dirname(workbookPath), { recursive: true });
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(workbookPath);
}

export function ensureCatalogSchema(workbook) {
  const sheet = workbook.worksheets.getItem(catalogSheetName);
  const usedRange = sheet.getUsedRange(true);
  const rows = usedRange.values.map((row) => [...row]);
  if (!rows.length) {
    return { changed: false, sheet, rows: [], headers: [] };
  }

  const currentHeaders = rows[0].map((value) => String(value).trim());
  const nextHeaders = [...currentHeaders];
  let changed = false;

  for (const column of catalogColumns) {
    if (!nextHeaders.includes(column.header)) {
      nextHeaders.push(column.header);
      changed = true;
    }
  }

  if (changed) {
    rows[0] = nextHeaders;
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const originalRow = ensureRowWidth(rows[rowIndex], nextHeaders.length);
      for (const column of catalogColumns) {
        const targetIndex = nextHeaders.indexOf(column.header);
        const sourceIndex = currentHeaders.indexOf(column.header);
        if (sourceIndex === -1) {
          originalRow[targetIndex] = column.defaultValue;
        }
      }
      rows[rowIndex] = originalRow;
    }
    const lastColumnLetter = columnIndexToLetter(nextHeaders.length - 1);
    sheet.getRange(`A1:${lastColumnLetter}${rows.length}`).values = rows;
  }

  return { changed, sheet, rows, headers: rows[0].map((value) => String(value).trim()) };
}

function columnIndexToLetter(index) {
  let result = "";
  let remaining = index;
  while (remaining >= 0) {
    result = String.fromCharCode(65 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26) - 1;
  }
  return result;
}

export function readCatalogRecords(workbook) {
  const { sheet, rows, headers } = ensureCatalogSchema(workbook);
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const records = rows
    .slice(1)
    .map((row, rowOffset) => ({ rowIndex: rowOffset + 2, row }))
    .map(({ rowIndex, row }) => ({ rowIndex, object: toRowObject(headers, ensureRowWidth(row, headers.length)) }))
    .filter(({ object }) => String(object.Title ?? "").trim())
    .map(({ rowIndex, object }) => {
      const title = String(object.Title).trim();
      const rawTitle = String(object["Raw Title"] || title).trim();
      const primaryFormat = normalizeFormat(object["Primary Format"]);
      const steelbook = parseBoolean(object.Steelbook) || splitPipeString(object.Tags).includes("Steelbook");
      const criterion = (
        parseBoolean(object.Criterion) ||
        splitPipeString(object.Tags).includes("Criterion") ||
        primaryFormat === "Criterion"
      );
      return {
        id: String(object.ID).trim(),
        inventoryNumber: Number(object["Inventory #"]),
        title,
        rawTitle,
        sortTitle: String(object["Sort Title"] || normalizeTitle(title)).trim(),
        section: String(object.Section).trim(),
        subsection: String(object.Subsection).trim() || null,
        directorCollection: String(object["Director Collection"]).trim() || null,
        primaryFormat,
        collectionType: String(object["Collection Type"]).trim() || "Single Feature",
        editionNotes: splitPipeString(object["Edition Notes"]),
        tags: buildMovieTags(object),
        seedFavorite: parseBoolean(object["Seed Favorite"]),
        seedLists: splitPipeString(object["Seed Lists"]),
        watchStatus: String(object["Watch Status"]).trim() || null,
        personalRating: parseNumber(object["Personal Rating"]),
        notes: String(object.Notes).trim() || null,
        purchasePrice: parseNumber(object["Purchase Price"]),
        estimatedValue: parseNumber(object["Estimated Value"]),
        valueSource: String(object["Value Source"] ?? "").trim() || null,
        valueDate: String(object["Value Date"] ?? "").trim() || null,
        condition: String(object["Condition"] ?? "").trim() || null,
        specialFeatures: splitPipeString(object["Special Features"]),
        upc: String(object["UPC"] ?? "").trim() || null,
        tmdbId: parseNumber(object["TMDb ID"]),
        year: parseNumber(object["Year"]),
        director: String(object["Director"] ?? "").trim() || null,
        runtime: parseNumber(object["Runtime"]),
        genre: String(object["Genre"] ?? "").trim() || null,
        posterUrl: String(object["Poster URL"] ?? "").trim() || null,
        backCoverUrl: String(object["Back Cover URL"] ?? "").trim() || null,
        spineArtUrl: String(object["Spine Art URL"] ?? "").trim() || null,
        artworkSourceName: String(object["Artwork Source Name"] ?? "").trim() || null,
        artworkSourceUrl: String(object["Artwork Source URL"] ?? "").trim() || null,
        overview: String(object["Overview"] ?? "").trim() || null,
        steelbook,
        criterion,
        moviesAnywhere: parseBoolean(object["Movies Anywhere"]),
        rowIndex,
      };
    });

  return { sheet, rows, headers, headerIndex, records };
}

export async function loadCatalogRecords() {
  const workbook = await loadWorkbookFile();
  return readCatalogRecords(workbook).records;
}

export async function updateCatalogMovie(movieId, changes) {
  const workbook = await loadWorkbookFile();
  const { sheet, rows, headers, headerIndex, records } = readCatalogRecords(workbook);
  const record = records.find((item) => item.id === movieId);
  if (!record) {
    throw new Error(`Movie not found: ${movieId}`);
  }

  const nextRow = ensureRowWidth(rows[record.rowIndex - 1], headers.length);

  const fieldToHeader = {
    primaryFormat: "Primary Format",
    steelbook: "Steelbook",
    criterion: "Criterion",
    moviesAnywhere: "Movies Anywhere",
    watchStatus: "Watch Status",
    personalRating: "Personal Rating",
    notes: "Notes",
    purchasePrice: "Purchase Price",
    estimatedValue: "Estimated Value",
    valueSource: "Value Source",
    valueDate: "Value Date",
    condition: "Condition",
    specialFeatures: "Special Features",
    seedFavorite: "Seed Favorite",
    seedLists: "Seed Lists",
    upc: "UPC",
    tmdbId: "TMDb ID",
    year: "Year",
    director: "Director",
    runtime: "Runtime",
    genre: "Genre",
    posterUrl: "Poster URL",
    backCoverUrl: "Back Cover URL",
    spineArtUrl: "Spine Art URL",
    artworkSourceName: "Artwork Source Name",
    artworkSourceUrl: "Artwork Source URL",
    overview: "Overview",
  };

  for (const [key, value] of Object.entries(changes)) {
    if (!editableMovieFields.has(key)) continue;
    const header = fieldToHeader[key];
    if (!header) continue;
    const targetIndex = headerIndex.get(header);
    if (targetIndex == null) continue;

    if (key === "steelbook" || key === "criterion" || key === "moviesAnywhere" || key === "seedFavorite") {
      nextRow[targetIndex] = Boolean(value);
    } else if (key === "specialFeatures" || key === "seedLists") {
      nextRow[targetIndex] = Array.isArray(value) ? value.join(" | ") : String(value ?? "");
    } else if (key === "primaryFormat") {
      nextRow[targetIndex] = String(value || "Blu-ray").trim() || "Blu-ray";
    } else {
      nextRow[targetIndex] = value ?? "";
    }
  }

  rows[record.rowIndex - 1] = nextRow;
  const lastColumnLetter = columnIndexToLetter(headers.length - 1);
  sheet.getRange(`A${record.rowIndex}:${lastColumnLetter}${record.rowIndex}`).values = [nextRow];
  await saveWorkbookFile(workbook);

  const refreshedRecords = readCatalogRecords(workbook).records;
  return refreshedRecords.find((item) => item.id === movieId) ?? null;
}

export async function addCatalogMovie(movieData) {
  const workbook = await loadWorkbookFile();
  const { sheet, rows, headers, headerIndex, records } = readCatalogRecords(workbook);

  const maxInventory = records.reduce((max, r) => Math.max(max, r.inventoryNumber || 0), 0);
  const nextInventory = maxInventory + 1;
  const nextId = `movie-${nextInventory}`;
  const title = String(movieData.title ?? "").trim();
  if (!title) throw new Error("Title is required");

  const sortTitle = normalizeTitle(title);

  const newRow = new Array(headers.length).fill("");
  const setCell = (header, value) => {
    const idx = headerIndex.get(header);
    if (idx != null) newRow[idx] = value ?? "";
  };

  setCell("ID", nextId);
  setCell("Inventory #", nextInventory);
  setCell("Title", title);
  setCell("Raw Title", movieData.rawTitle || title);
  setCell("Sort Title", sortTitle);
  setCell("Section", movieData.section || "General 4K / Blu-ray");
  setCell("Subsection", movieData.subsection || "");
  setCell("Director Collection", movieData.directorCollection || "");
  setCell("Primary Format", movieData.primaryFormat || "Blu-ray");
  setCell("Collection Type", movieData.collectionType || "Single Feature");
  setCell("Tags", Array.isArray(movieData.tags) ? movieData.tags.join(" | ") : (movieData.tags || ""));
  setCell("Edition Notes", Array.isArray(movieData.editionNotes) ? movieData.editionNotes.join(" | ") : (movieData.editionNotes || ""));
  setCell("Steelbook", Boolean(movieData.steelbook));
  setCell("Criterion", Boolean(movieData.criterion));
  setCell("Movies Anywhere", Boolean(movieData.moviesAnywhere));
  setCell("Seed Favorite", false);
  setCell("Seed Lists", "");
  setCell("Watch Status", movieData.watchStatus || "");
  setCell("Personal Rating", movieData.personalRating ?? "");
  setCell("Notes", movieData.notes || "");
  setCell("Purchase Price", movieData.purchasePrice ?? "");
  setCell("Estimated Value", movieData.estimatedValue ?? "");
  setCell("Value Source", movieData.valueSource || "");
  setCell("Value Date", movieData.valueDate || "");
  setCell("Condition", movieData.condition || "");
  setCell("Special Features", Array.isArray(movieData.specialFeatures) ? movieData.specialFeatures.join(" | ") : (movieData.specialFeatures || ""));
  setCell("UPC", movieData.upc || "");
  setCell("TMDb ID", movieData.tmdbId ?? "");
  setCell("Year", movieData.year ?? "");
  setCell("Director", movieData.director || "");
  setCell("Runtime", movieData.runtime ?? "");
  setCell("Genre", movieData.genre || "");
  setCell("Poster URL", movieData.posterUrl || "");
  setCell("Back Cover URL", movieData.backCoverUrl || "");
  setCell("Spine Art URL", movieData.spineArtUrl || "");
  setCell("Artwork Source Name", movieData.artworkSourceName || "");
  setCell("Artwork Source URL", movieData.artworkSourceUrl || "");
  setCell("Overview", movieData.overview || "");

  const newRowIndex = rows.length + 1;
  const lastColumnLetter = columnIndexToLetter(headers.length - 1);
  sheet.getRange(`A${newRowIndex}:${lastColumnLetter}${newRowIndex}`).values = [newRow];
  await saveWorkbookFile(workbook);

  const refreshedRecords = readCatalogRecords(workbook).records;
  return refreshedRecords.find((item) => item.id === nextId) ?? null;
}

export function catalogRecordsToClientScript(records) {
  return `window.MOVIE_DATA = ${JSON.stringify(records, null, 2)};\n`;
}
