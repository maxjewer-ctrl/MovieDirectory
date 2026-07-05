import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "outputs", "catalog");
const sourcePath = path.join(rootDir, "movies-data.js");
const workbookPath = path.join(outputDir, "Movie Collection Catalog.xlsx");

function splitPipes(value) {
  return value.filter(Boolean).join(" | ");
}

function derivePrimaryFormat(movie) {
  if (movie.tags.includes("4K")) return "4K";
  if (movie.tags.includes("Criterion")) return "Criterion";
  if (movie.tags.includes("Steelbook")) return "Steelbook";
  if (movie.tags.includes("Series")) return "Series";
  if (movie.tags.includes("Collection")) return "Collection";
  if (movie.tags.includes("Trilogy")) return "Trilogy";
  return movie.tags[0] ?? "Archive";
}

function deriveCollectionType(movie) {
  if (movie.tags.includes("Series")) return "Series";
  if (movie.tags.includes("Trilogy")) return "Trilogy";
  if (movie.tags.includes("Collection")) return "Collection";
  if (movie.directorCollection) return "Director Set";
  return "Single Feature";
}

function parseMovieData(fileText) {
  const context = { window: {} };
  vm.runInNewContext(fileText, context);
  return context.window.MOVIE_DATA ?? [];
}

function buildRows(movies) {
  return movies.map((movie) => [
    movie.id,
    movie.inventoryNumber,
    movie.title,
    movie.rawTitle,
    movie.sortTitle,
    movie.section,
    movie.subsection ?? "",
    movie.directorCollection ?? "",
    derivePrimaryFormat(movie),
    deriveCollectionType(movie),
    splitPipes(movie.tags),
    splitPipes(movie.editionNotes),
    movie.tags.includes("Steelbook"),
    movie.tags.includes("Criterion") || derivePrimaryFormat(movie) === "Criterion",
    false,
    false,
    "",
    "",
    "",
    "",
  ]);
}

function autoWidthForRows(rows) {
  const widths = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      const text = String(cell ?? "");
      const width = Math.min(Math.max(text.length + 3, 10), 28);
      widths[index] = Math.max(widths[index] ?? 10, width);
    });
  }
  return widths;
}

const raw = await fs.readFile(sourcePath, "utf8");
const movies = parseMovieData(raw);
const workbook = Workbook.create();

const guide = workbook.worksheets.add("Guide");
guide.showGridLines = false;
guide.getRange("A1:F1").merge();
guide.getRange("A1").values = [["Movie Collection Catalog"]];
guide.getRange("A2:F2").merge();
guide.getRange("A2").values = [["This workbook is the source-of-truth catalog for the Movie Directory app."]];
guide.getRange("A4:B9").values = [
  ["Step", "What to do"],
  ["1", "Edit titles on the Catalog sheet. Keep row 1 headers unchanged."],
  ["2", "Primary Format, Steelbook, Criterion, and Movies Anywhere can be edited in the workbook or in the browser app."],
  ["3", "Use TRUE or FALSE in Seed Favorite for first-load favorites."],
  ["4", "Use pipe-separated names in Seed Lists, for example Friday Night Picks | Halloween."],
  ["5", "After edits, run npm run catalog:sync for static exports, or run npm run serve for live browser editing."],
];
guide.getRange("A1:F2").format = {
  fill: "#201812",
  font: { bold: true, color: "#F8F0E3" },
  wrapText: true,
};
guide.getRange("A4:B4").format = {
  fill: "#7F1D1D",
  font: { bold: true, color: "#FFF7F2" },
};
guide.getRange("A4:B9").format.wrapText = true;
guide.getRange("A1:B9").format.columnWidth = 42;

const catalog = workbook.worksheets.add("Catalog");
catalog.freezePanes.freezeRows(1);

const headers = [[
  "ID",
  "Inventory #",
  "Title",
  "Raw Title",
  "Sort Title",
  "Section",
  "Subsection",
  "Director Collection",
  "Primary Format",
  "Collection Type",
  "Tags",
  "Edition Notes",
  "Steelbook",
  "Criterion",
  "Movies Anywhere",
  "Seed Favorite",
  "Seed Lists",
  "Watch Status",
  "Personal Rating",
  "Notes",
]];

const dataRows = buildRows(movies);
catalog.getRange(`A1:T${dataRows.length + 1}`).values = [...headers, ...dataRows];
catalog.getRange("A1:T1").format = {
  fill: "#7F1D1D",
  font: { bold: true, color: "#FFF7F2" },
};
catalog.getRange(`A2:T${dataRows.length + 1}`).format = {
  wrapText: true,
};
catalog.getRange(`B2:B${dataRows.length + 1}`).format.numberFormat = "0";
catalog.getRange(`S2:S${dataRows.length + 1}`).format.numberFormat = "0.0";

const widths = autoWidthForRows([headers[0], ...dataRows.slice(0, 40)]);
widths.forEach((width, index) => {
  catalog.getRangeByIndexes(0, index, dataRows.length + 1, 1).format.columnWidth = width;
});
catalog.getRange(`K:T`).format.columnWidth = 18;
catalog.getRange(`C:C`).format.columnWidth = 28;
catalog.getRange(`F:J`).format.columnWidth = 20;

const table = catalog.tables.add(`A1:T${dataRows.length + 1}`, true, "MovieCatalog");
table.showBandedColumns = false;
table.showFilterButton = true;

const lookups = workbook.worksheets.add("Lookups");
const sections = [...new Set(movies.map((movie) => movie.section))];
const directors = [...new Set(movies.map((movie) => movie.directorCollection).filter(Boolean))];
const formats = [...new Set(movies.flatMap((movie) => movie.tags))].sort((a, b) => a.localeCompare(b));
lookups.getRange("A1:F1").values = [["Sections", "Count", "Formats", "Count", "Director Collections", "Count"]];
lookups.getRange("A1:F1").format = {
  fill: "#201812",
  font: { bold: true, color: "#F8F0E3" },
};
lookups.getRange(`A2:B${sections.length + 1}`).values = sections.map((name) => [
  name,
  movies.filter((movie) => movie.section === name).length,
]);
lookups.getRange(`C2:D${formats.length + 1}`).values = formats.map((name) => [
  name,
  movies.filter((movie) => movie.tags.includes(name)).length,
]);
lookups.getRange(`E2:F${directors.length + 1}`).values = directors.map((name) => [
  name,
  movies.filter((movie) => movie.directorCollection === name).length,
]);
lookups.getRange("A1:F50").format.columnWidth = 22;

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({
  sheetName: "Catalog",
  range: `A1:T25`,
  scale: 1,
  format: "png",
});
await fs.writeFile(
  path.join(outputDir, "catalog-preview.png"),
  new Uint8Array(await preview.arrayBuffer()),
);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(workbookPath);
console.log(workbookPath);
