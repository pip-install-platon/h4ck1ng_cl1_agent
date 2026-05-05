import type { AgentTask, KnowledgeBundle } from "@pentest-copilot/contracts";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { EngagementGraphStore } from "./graph-store.js";
import { GenericAgentRunner } from "./generic-agent-runner.js";
import type { ReportLibrary } from "./report-library.js";
import { SkillResolver } from "./skill-resolver.js";
import type { TerminalPort } from "@pentest-copilot/terminal";

export type TeamLeadRunnerOptions = {
  dataRoot: string;
  engagementId: string;
  terminal: TerminalPort;
  priorReportIds?: string[];
};

const CONTRACT_VERSION = "1.0.0";

export class TeamLeadRunner {
  constructor(
    private readonly skillResolver: SkillResolver,
    private readonly reports: ReportLibrary,
  ) {}

  async runDemoScenario(opts: TeamLeadRunnerOptions): Promise<void> {
    const store = await EngagementGraphStore.loadOrCreate(
      opts.engagementId,
      opts.dataRoot,
    );
    const runner = new GenericAgentRunner(opts.terminal);

    const priorHints =
      opts.priorReportIds?.length ?
        await this.reports.loadHintsForPriors(opts.priorReportIds)
      : [];

    const cross: KnowledgeBundle["crossEngagementHints"] =
      priorHints.length > 0 ?
        {
          priorReportIds: opts.priorReportIds ?? [],
          summaryBullets: priorHints.flatMap((h) =>
            h.bullets.map((b) => `[${h.id}] ${b}`),
          ),
        }
      : undefined;

    const hostFact = {
      lane: "ig" as const,
      key: "target.host",
      value: "10.10.10.10",
      confidence: "hypothesis" as const,
    };

    const steps: Omit<AgentTask, "skillPack">[] = [
      {
        schemaVersion: CONTRACT_VERSION,
        taskId: randomUUID(),
        engagementId: opts.engagementId,
        module: "ig",
        directive: "Enumerate surface; identify live host and listening ports (stub).",
        knowledge: {
          engagementFacts: [hostFact],
          crossEngagementHints: cross,
        },
      },
      {
        schemaVersion: CONTRACT_VERSION,
        taskId: randomUUID(),
        engagementId: opts.engagementId,
        module: "vuln",
        directive: "Correlate services with known vuln patterns (stub).",
        knowledge: {
          engagementFacts: [
            hostFact,
            {
              lane: "vuln",
              key: "recon.phase",
              value: "post-ig",
              confidence: "confirmed",
            },
          ],
        },
      },
      {
        schemaVersion: CONTRACT_VERSION,
        taskId: randomUUID(),
        engagementId: opts.engagementId,
        module: "exploit",
        directive: "Validate exploitable path with minimal PoC (stub).",
        knowledge: {
          engagementFacts: [
            hostFact,
            {
              lane: "exploit",
              key: "vuln.candidate",
              value: "demo-placeholder",
              confidence: "hypothesis",
            },
          ],
        },
      },
      {
        schemaVersion: CONTRACT_VERSION,
        taskId: randomUUID(),
        engagementId: opts.engagementId,
        module: "report",
        directive: "Summarize engagement for report library (stub).",
        knowledge: {
          engagementFacts: [
            {
              lane: "report",
              key: "engagement.id",
              value: opts.engagementId,
              confidence: "confirmed",
            },
          ],
        },
      },
    ];

    for (const base of steps) {
      const skillPack = await this.skillResolver.resolveSkillPack(
        base as AgentTask,
      );
      const task: AgentTask = { ...base, skillPack };
      const result = await runner.run(task);

      store.recordTaskStatus(task.taskId, result.status);
      store.applyGraphOps(result.graphOps);
      await store.persist();

      if (result.status === "failed") {
        // В полном движке здесь replan; в демо просто фиксируем обрыв.
        break;
      }
    }

    const snapshot = store.buildTeamLeadSnapshot();
    await this.reports.saveReport({
      engagementId: opts.engagementId,
      createdAt: new Date().toISOString(),
      summaryBullets: [
        `nodes=${String(Object.keys(store.getState().nodes).length)}`,
        `edges=${String(store.getState().edges.length)}`,
        `lastUpdated=${snapshot.updatedAt}`,
      ],
      modulesTouched: ["ig", "vuln", "exploit", "report"],
      graphSnapshotPath: path.relative(
        process.cwd(),
        store.stateFilePath(),
      ),
    });
  }
}
