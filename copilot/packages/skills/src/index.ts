import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Корень пакета (с `catalog/`). */
export function getSkillsPackageRoot(): string {
  return root;
}

/** Каталог с markdown-skill файлами. */
export function getSkillsCatalogDir(): string {
  return path.join(root, "catalog");
}

export async function listCatalogSkillIds(): Promise<string[]> {
  const dir = getSkillsCatalogDir();
  const files = await readdir(dir);
  return files
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/u, ""))
    .sort();
}
