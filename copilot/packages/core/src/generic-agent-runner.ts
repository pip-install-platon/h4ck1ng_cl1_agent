import type { AgentResult, AgentTask, GraphOp } from "@pentest-copilot/contracts";
import type { TerminalPort, TerminalSessionSpec } from "@pentest-copilot/terminal";

function hostFromTask(task: AgentTask): string {
  const fact = task.knowledge.engagementFacts.find(
    (f) => f.key === "target.host" || f.key === "target.ip",
  );
  return fact?.value ?? "127.0.0.1";
}

function capBytes(task: AgentTask): {
  maxStdoutBytes: number;
  maxStderrBytes: number;
} {
  const mc = task.constraints?.maxPromptChars;
  const base = 256_000;
  const maxOut = mc !== undefined ? Math.min(mc, 512_000) : base;
  return { maxStdoutBytes: maxOut, maxStderrBytes: Math.min(maxOut, 128_000) };
}

/**
 * Универсальный исполнитель первого билда: терминал + структурированный результат.
 * LLM сюда не входит — только детерминированные команды-заглушки под ОС.
 */
export class GenericAgentRunner {
  constructor(private readonly terminal: TerminalPort) {}

  async run(task: AgentTask): Promise<AgentResult> {
    const { maxStdoutBytes, maxStderrBytes } = capBytes(task);
    const maxFindings = task.constraints?.maxOutputFindings ?? 24;

    const spec: TerminalSessionSpec = {
      command: this.buildCommand(task),
      timeoutMs: 120_000,
      maxStdoutBytes,
      maxStderrBytes,
    };

    const session = await this.terminal.run(spec);
    const status =
      session.exitCode === 0
        ? "completed"
        : session.exitCode === null
          ? "failed"
          : "failed";

    const excerpt = session.stdout.slice(0, 2000);
    const findings =
      session.stdout.length > 0 && excerpt.length > 0
        ? [
            {
              claim: "Command produced stdout; parse only from attached evidence.",
              evidenceRef: {
                sessionId: session.sessionId,
                excerpt,
              },
              confidence: "medium" as const,
            },
          ]
        : [];

    const cappedFindings = findings.slice(0, maxFindings);

    return {
      schemaVersion: "1.0.0",
      taskId: task.taskId,
      status,
      terminalSessions: [session],
      outputFindings: cappedFindings,
      summary: `module=${task.module} exit=${String(session.exitCode)} truncated=${String(session.truncated)}`,
      graphOps: this.buildGraphOps(task, session.exitCode === 0),
      skillPackEcho: { toolIds: task.skillPack?.toolIds ?? [] },
    };
  }

  private buildCommand(task: AgentTask): string {
    const host = hostFromTask(task);
    const isWin = process.platform === "win32";

    if (isWin) {
      const safe = host.replaceAll(/[^a-zA-Z0-9._:-]/gu, "");
      switch (task.module) {
        case "ig":
          return `echo stub-ig host=${safe} && ver`;
        case "vuln":
          return `echo stub-vuln host=${safe}`;
        case "exploit":
          return `echo stub-exploit host=${safe}`;
        case "report":
          return `echo stub-report engagement=${task.engagementId}`;
        case "prep":
          return `echo stub-prep host=${safe}`;
        case "post":
          return `echo stub-post host=${safe}`;
        case "obj":
          return `echo stub-obj host=${safe}`;
      }
    }

    const h = host.replaceAll(/'/gu, "'\\''");
    switch (task.module) {
      case "ig":
        return `echo 'stub-ig host=${h}' && (uname -a || true)`;
      case "vuln":
        return `echo 'stub-vuln host=${h}'`;
      case "exploit":
        return `echo 'stub-exploit host=${h}'`;
      case "report":
        return `echo 'stub-report engagement=${task.engagementId}'`;
      case "prep":
        return `echo 'stub-prep host=${h}'`;
      case "post":
        return `echo 'stub-post host=${h}'`;
      case "obj":
        return `echo 'stub-obj host=${h}'`;
    }
  }

  private buildGraphOps(task: AgentTask, ok: boolean): GraphOp[] | undefined {
    const host = hostFromTask(task);
    const safeHost = host.replaceAll(/[^a-zA-Z0-9._:-]/gu, "_");

    if (task.module === "ig" && ok) {
      return [
        {
          op: "addNode",
          node: {
            id: `host-${safeHost}`,
            type: "host",
            lane: "ig",
            label: host,
            data: { address: host, source: "demo-ig" },
          },
        },
      ];
    }

    if (task.module === "vuln" && ok) {
      return [
        {
          op: "addNode",
          node: {
            id: `svc-${safeHost}-demo`,
            type: "service",
            lane: "vuln",
            label: `placeholder service ${host}`,
            data: { port: 443, proto: "tcp", note: "demo" },
          },
        },
        {
          op: "addEdge",
          edge: {
            id: `e-${safeHost}-host-svc`,
            fromId: `host-${safeHost}`,
            toId: `svc-${safeHost}-demo`,
            label: "exposes",
          },
        },
      ];
    }

    if (task.module === "exploit" && ok) {
      return [
        {
          op: "addNode",
          node: {
            id: `vuln-${safeHost}-demo`,
            type: "vulnerability",
            lane: "exploit",
            label: "Demo finding — replace with evidence-backed id",
            data: { severity: "unknown" },
          },
        },
      ];
    }

    if (task.module === "report" && ok) {
      return [
        {
          op: "addNode",
          node: {
            id: `report-${task.engagementId}`,
            type: "engagement_report",
            lane: "report",
            label: `Report ${task.engagementId}`,
            data: { ready: true },
          },
        },
      ];
    }

    return undefined;
  }
}
