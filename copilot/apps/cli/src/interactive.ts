import {
  EngagementGraphStore,
  ReportLibrary,
  SkillResolver,
  TeamLeadRunner,
} from "@pentest-copilot/core";
import { LocalStubTerminal } from "@pentest-copilot/terminal";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { parsePriorReportIds, resolvePaths } from "./paths.js";

const BANNER = `
pentest-copilot · session (Cursor CLI-style TTY)
Slash-команды: /help  /snapshot  /demo  /engagement <id>  /quit
Свободный текст пока без LLM — сохраняется в очередь намерений.
`;

export async function runInteractiveSession(): Promise<void> {
  const { dataRoot, libraryRoot } = resolvePaths();
  let engagementId =
    process.env["ENGAGEMENT_ID"] ?? "interactive-default";

  const rl = readline.createInterface({ input, output });
  const terminal = new LocalStubTerminal();
  const skills = new SkillResolver();
  const reports = new ReportLibrary(libraryRoot);
  const lead = new TeamLeadRunner(skills, reports);

  // eslint-disable-next-line no-console -- CLI
  console.log(BANNER.trim());
  // eslint-disable-next-line no-console -- CLI
  console.log(
    `dataRoot=${dataRoot}\nlibraryRoot=${libraryRoot}\nengagement=${engagementId}\n`,
  );

  while (true) {
    const raw = await rl.question("copilot> ");
    const line = raw.trim();
    if (!line) continue;

    if (line === "/quit" || line === "/exit") break;

    if (line === "/help") {
      // eslint-disable-next-line no-console -- CLI
      console.log(`
/engagement <id>  — текущий engagement (файлы в data/engagements/<id>/)
/snapshot         — сводка графа для Team-Lead (JSON)
/demo             — прогнать встроенный демо-сценарий на текущем id
/help
/quit
`);
      continue;
    }

    if (line.startsWith("/engagement ")) {
      engagementId = line.slice("/engagement ".length).trim() || engagementId;
      // eslint-disable-next-line no-console -- CLI
      console.log(`ok engagement=${engagementId}`);
      continue;
    }

    if (line === "/snapshot") {
      const store = await EngagementGraphStore.loadOrCreate(
        engagementId,
        dataRoot,
      );
      const snap = store.buildTeamLeadSnapshot();
      // eslint-disable-next-line no-console -- CLI
      console.log(JSON.stringify(snap, null, 2));
      continue;
    }

    if (line === "/demo") {
      await lead.runDemoScenario({
        dataRoot,
        engagementId,
        terminal,
        priorReportIds:
          parsePriorReportIds().length > 0 ? parsePriorReportIds() : undefined,
      });
      // eslint-disable-next-line no-console -- CLI
      console.log(JSON.stringify({ ok: true, engagementId }, null, 2));
      continue;
    }

    if (line.startsWith("/")) {
      // eslint-disable-next-line no-console -- CLI
      console.log(`unknown command: ${line} (try /help)`);
      continue;
    }

    // eslint-disable-next-line no-console -- CLI
    console.log(
      JSON.stringify({
        kind: "user_intent_buffer",
        note: "LLM Team-Lead не подключён: текст зафиксирован как намерение.",
        engagementId,
        text: line.slice(0, 4000),
      }),
    );
  }

  rl.close();
}
