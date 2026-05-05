import type {
  AgentTask,
  GraphEdge,
  GraphNode,
  GraphOp,
} from "@pentest-copilot/contracts";
import type { SkillPack } from "@pentest-copilot/contracts";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type EngagementState = {
  engagementId: string;
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  taskStatuses: Record<string, string>;
  updatedAt: string;
};

export type TeamLeadSnapshot = {
  engagementId: string;
  updatedAt: string;
  hosts: Array<{ id: string; label?: string; data: Record<string, unknown> }>;
  openPortsNote: string[];
  vulnNotes: string[];
  recentTasks: Array<{ taskId: string; status: string }>;
};

function nowIso(): string {
  return new Date().toISOString();
}

export class EngagementGraphStore {
  private state: EngagementState;
  private readonly dataRoot: string;

  constructor(engagementId: string, dataRoot: string) {
    this.dataRoot = dataRoot;
    this.state = {
      engagementId,
      nodes: {},
      edges: [],
      taskStatuses: {},
      updatedAt: nowIso(),
    };
  }

  static async loadOrCreate(
    engagementId: string,
    dataRoot: string,
  ): Promise<EngagementGraphStore> {
    const store = new EngagementGraphStore(engagementId, dataRoot);
    const fp = store.stateFilePath();
    try {
      const raw = await readFile(fp, "utf8");
      const parsed = JSON.parse(raw) as EngagementState;
      store.state = {
        ...parsed,
        nodes: parsed.nodes ?? {},
        edges: parsed.edges ?? [],
        taskStatuses: parsed.taskStatuses ?? {},
      };
    } catch {
      /* new engagement */
    }
    return store;
  }

  getState(): EngagementState {
    return this.state;
  }

  stateFilePath(): string {
    return path.join(
      this.dataRoot,
      "engagements",
      this.state.engagementId,
      "graph.json",
    );
  }

  recordTaskStatus(taskId: string, status: string): void {
    this.state.taskStatuses[taskId] = status;
    this.state.updatedAt = nowIso();
  }

  applyGraphOps(ops: GraphOp[] | undefined): void {
    if (!ops?.length) return;

    for (const op of ops) {
      switch (op.op) {
        case "addNode": {
          this.state.nodes[op.node.id] = op.node;
          break;
        }
        case "addEdge": {
          const exists = this.state.edges.some((e) => e.id === op.edge.id);
          if (!exists) this.state.edges.push(op.edge);
          break;
        }
        case "mergeNode": {
          const existing = this.state.nodes[op.id];
          if (!existing) {
            this.state.nodes[op.id] = {
              id: op.id,
              type: "unknown",
              lane: undefined,
              data: { ...op.patch },
            };
          } else {
            existing.data = {
              ...existing.data,
              ...op.patch,
            };
          }
          break;
        }
        default: {
          const _exhaust: never = op;
          void _exhaust;
        }
      }
    }
    this.state.updatedAt = nowIso();
  }

  buildTeamLeadSnapshot(limitTasks = 12): TeamLeadSnapshot {
    const hosts = Object.values(this.state.nodes).filter(
      (n) => n.type === "host" || n.type === "target",
    );
    const openPortsNote: string[] = [];
    const vulnNotes: string[] = [];
    for (const n of Object.values(this.state.nodes)) {
      if (n.type === "service" && typeof n.data["port"] !== "undefined") {
        openPortsNote.push(
          String(n.label ?? n.id) +
            " " +
            JSON.stringify(n.data).slice(0, 200),
        );
      }
      if (n.type === "vulnerability" && n.label) vulnNotes.push(n.label);
    }
    const recentTasks = Object.entries(this.state.taskStatuses)
      .slice(-limitTasks)
      .map(([taskId, status]) => ({ taskId, status }));

    return {
      engagementId: this.state.engagementId,
      updatedAt: this.state.updatedAt,
      hosts,
      openPortsNote: openPortsNote.slice(0, 32),
      vulnNotes: vulnNotes.slice(0, 32),
      recentTasks,
    };
  }

  async persist(): Promise<void> {
    const fp = this.stateFilePath();
    await mkdir(path.dirname(fp), { recursive: true });
    await writeFile(fp, JSON.stringify(this.state, null, 2), "utf8");
  }
}

export async function attachSkillPackToTask(
  task: AgentTask,
  resolve: (t: AgentTask) => Promise<SkillPack>,
): Promise<AgentTask> {
  const skillPack = await resolve(task);
  return { ...task, skillPack };
}
