import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Корень монорепозитория (`…/copilot`), независимо от cwd. */
export const repoRoot = path.resolve(__dirname, "..", "..", "..");

export function resolvePaths(): {
  dataRoot: string;
  libraryRoot: string;
} {
  return {
    dataRoot: path.resolve(
      process.env["DATA_ROOT"] ?? path.join(repoRoot, "data"),
    ),
    libraryRoot: path.resolve(
      process.env["LIBRARY_ROOT"] ?? path.join(repoRoot, "library"),
    ),
  };
}

export function parsePriorReportIds(): string[] {
  const priorRaw = process.env["PRIOR_REPORT_IDS"] ?? "";
  return priorRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
