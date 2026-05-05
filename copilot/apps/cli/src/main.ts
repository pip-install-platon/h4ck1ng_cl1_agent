import {
  ReportLibrary,
  SkillResolver,
  TeamLeadRunner,
} from "@pentest-copilot/core";
import { LocalStubTerminal } from "@pentest-copilot/terminal";
import { runInteractiveSession } from "./interactive.js";
import {
  parsePriorReportIds,
  resolvePaths,
} from "./paths.js";

async function runDemo(): Promise<void> {
  const { dataRoot, libraryRoot } = resolvePaths();
  const engagementId =
    process.env["ENGAGEMENT_ID"] ?? `demo-${Date.now().toString(36)}`;
  const priorReportIds = parsePriorReportIds();

  const terminal = new LocalStubTerminal();
  const skills = new SkillResolver();
  const reports = new ReportLibrary(libraryRoot);
  const lead = new TeamLeadRunner(skills, reports);

  await lead.runDemoScenario({
    dataRoot,
    engagementId,
    terminal,
    priorReportIds: priorReportIds.length > 0 ? priorReportIds : undefined,
  });

  // eslint-disable-next-line no-console -- CLI
  console.log(
    JSON.stringify({
      ok: true,
      engagementId,
      dataRoot,
      libraryRoot,
    }),
  );
}

function printUsage(): void {
  // eslint-disable-next-line no-console -- CLI
  console.log(`Usage:
  node dist/main.js demo     — один прогон демо-сценария (по умолчанию)
  node dist/main.js session  — интерактивная сессия в терминале (как Cursor CLI)

npm run cli          → demo
npm run cli:session  → session
`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "demo";
  if (cmd === "help" || cmd === "-h" || cmd === "--help") {
    printUsage();
    return;
  }
  if (cmd === "session" || cmd === "chat") {
    await runInteractiveSession();
    return;
  }
  if (cmd === "demo") {
    await runDemo();
    return;
  }
  printUsage();
  process.exitCode = 1;
}

main().catch((e) => {
  // eslint-disable-next-line no-console -- CLI
  console.error(e);
  process.exitCode = 1;
});
