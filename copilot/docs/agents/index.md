# Спецификации модулей (агентов)

Каждый модуль — **исполнитель**: на вход Strict `AgentTask` (знания + `skillPack` + `directive`), на выход `AgentResult` с `terminalSessions`, `outputFindings` (с evidence), `graphOps`.

**Не дублируем** полноценные базы CVE/эксплойтов внутри репозитория: опираемся на **NVD**, **MITRE ATT&CK / CWE**, **Exploit-DB**, **поиск по софту/версии** через публичные API и локальные тулзы Kali. Наша задача — **корреляция**: CVE ↔ находка ↔ тактика ↔ (при наличии) путь эксплуатации. **Выбор стратегии и порядка шагов** — **Team-Lead**, не воркер.

| Модуль | Файл |
|--------|------|
| Orchestrator | [team-lead.md](team-lead.md) |
| Information Gathering | [ig.md](ig.md) |
| Prep / Weaponization | [prep.md](prep.md) |
| Vulnerability Analysis | [vuln.md](vuln.md) |
| Exploitation | [exploit.md](exploit.md) |
| Post-Exploitation | [post.md](post.md) |
| Objectives | [obj.md](obj.md) |
| Reporting | [report.md](report.md) |

## Внешние источники (интеграции по мере билдов)

| Назначение | Примеры |
|------------|---------|
| CVE и метаданные | **NVD** API/feeds, при необходимости **OSV** |
| Публичные эксплойты | **Exploit-DB** (`searchsploit`, веб), модули **Metasploit** |
| Тактики / методологии | **MITRE ATT&CK**, **CWE**, чеклисты OWASP и под тип актива |
| Интернет-поверхность | **Shodan**, **Censys** (IG), API-ключи через env |

Корневой [README.md](../../README.md) остаётся оглавлением продукта; детали инструментов и ролей — в этих файлах.
