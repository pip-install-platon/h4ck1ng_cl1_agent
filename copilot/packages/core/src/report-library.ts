import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type EngagementReportRecord = {
  engagementId: string;
  createdAt: string;
  summaryBullets: string[];
  modulesTouched: string[];
  graphSnapshotPath?: string;
};

export class ReportLibrary {
  constructor(private readonly libraryRoot: string) {}

  private filePath(engagementId: string): string {
    return path.join(this.libraryRoot, "reports", `${engagementId}.json`);
  }

  async saveReport(record: EngagementReportRecord): Promise<void> {
    const fp = this.filePath(record.engagementId);
    await mkdir(path.dirname(fp), { recursive: true });
    await writeFile(fp, JSON.stringify(record, null, 2), "utf8");
  }

  async loadReport(
    engagementId: string,
  ): Promise<EngagementReportRecord | null> {
    try {
      const raw = await readFile(this.filePath(engagementId), "utf8");
      return JSON.parse(raw) as EngagementReportRecord;
    } catch {
      return null;
    }
  }

  async loadHintsForPriors(
    priorReportIds: string[],
  ): Promise<{ id: string; bullets: string[] }[]> {
    const out: { id: string; bullets: string[] }[] = [];
    for (const id of priorReportIds) {
      const r = await this.loadReport(id);
      if (r) out.push({ id, bullets: r.summaryBullets.slice(0, 16) });
    }
    return out;
  }
}
