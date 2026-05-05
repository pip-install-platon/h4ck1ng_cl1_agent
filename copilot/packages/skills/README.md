# Skills catalog

Markdown-файлы в `catalog/*.md`, имя файла = **tool id** (например `nmap` → `nmap.md`).

`SkillResolver` подставляет релевантные куски в `AgentTask.skillPack.resolvedContent`.

Добавление нового инструмента:

1. Создать `catalog/<toolId>.md` (кратко: назначение, типовые флаги, как читать вывод).
2. При необходимости расширить эвристику `inferToolIds` в `@pentest-copilot/core` (`skill-resolver.ts`).
