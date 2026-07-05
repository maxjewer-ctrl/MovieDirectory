import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  catalogRecordsToClientScript,
  loadWorkbookFile,
  readCatalogRecords,
  saveWorkbookFile,
} from "./catalog-workbook.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const jsOutputPath = path.join(rootDir, "movies-data.js");
const jsonOutputPath = path.join(rootDir, "movies-data.json");

const workbook = await loadWorkbookFile();
const { records } = readCatalogRecords(workbook);
await saveWorkbookFile(workbook);

const sanitizedRecords = records.map(({ rowIndex, ...record }) => record);
await fs.writeFile(jsOutputPath, catalogRecordsToClientScript(sanitizedRecords), "utf8");
await fs.writeFile(jsonOutputPath, `${JSON.stringify(sanitizedRecords, null, 2)}\n`, "utf8");
console.log(`Synced ${sanitizedRecords.length} records to ${jsOutputPath}`);
