import type { AgentModule, AgentTask, SkillPack } from "@pentest-copilot/contracts";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSkillsCatalogDir } from "@pentest-copilot/skills";

const SKILL_PACK_VERSION = "1.0.0";

function directiveHints(directive: string): Set<string> {
  const d = directive.toLowerCase();
  const hints = new Set<string>();
  if (d.includes("http") || d.includes("curl") || d.includes("web")) {
    hints.add("curl");
  }
  if (d.includes("nmap") || d.includes("port") || d.includes("scan")) {
    hints.add("nmap");
  }
  return hints;
}

function defaultToolsForModule(mod: AgentModule): string[] {
  switch (mod) {
    case "ig":
      return ["nmap"];
    case "vuln":
      return ["nmap", "curl"];
    case "exploit":
      return ["curl", "nmap"];
    case "post":
      return ["curl"];
    case "prep":
      return ["nmap"];
    case "obj":
      return ["curl"];
    case "report":
      return [];
    default: {
      const _e: never = mod;
      return _e;
    }
  }
}

export function inferToolIds(task: AgentTask): string[] {
  const fromModule = new Set(defaultToolsForModule(task.module));
  for (const h of directiveHints(task.directive)) fromModule.add(h);
  for (const f of task.knowledge.engagementFacts) {
    const v = `${f.key} ${f.value}`.toLowerCase();
    if (v.includes("http")) fromModule.add("curl");
    if (v.includes("port") || v.includes("tcp")) fromModule.add("nmap");
  }
  const list = [...fromModule].filter((id) => id.length > 0);
  return list.sort();
}

export class SkillResolver {
  /** Разрешить skillPack для задачи: toolIds + склеенный markdown каталога. */
  async resolveSkillPack(task: AgentTask): Promise<SkillPack> {
    const toolIds = inferToolIds(task);
    const catalogDir = getSkillsCatalogDir();
    const parts: string[] = [];
    const skillRefs: string[] = [];

    for (const id of toolIds) {
      const fp = path.join(catalogDir, `${id}.md`);
      try {
        const body = await readFile(fp, "utf8");
        parts.push(`### skill:${id}\n\n${body.trim()}\n`);
        skillRefs.push(id);
      } catch {
        /* отсутствующий skill — пропускаем */
      }
    }

    const resolvedContent = parts.join("\n");
    const contentHash = createHash("sha256")
      .update(resolvedContent)
      .digest("hex");

    return {
      schemaVersion: SKILL_PACK_VERSION,
      toolIds,
      skillRefs,
      resolvedContent:
        resolvedContent.length > 0 ? resolvedContent : undefined,
      contentHash,
    };
  }
}
