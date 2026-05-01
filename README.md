# pentest-copilot-host

Минимальный **CLI-хост** ассистента под пентест: контекст машины (Kali и др.), заготовка методологии в `knowledge/`, опционально — LLM через **OpenRouter**.

Никакого Electron: тестируйте на **VM Kali** в обычном терминале.

## Установка на Kali

```bash
cd pentest-copilot-host   # корень этого репозитория
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Скоуп (контекст для модели)

`PENTEST_SCOPE_TARGET` и `PENTEST_SCOPE_POLICY` — это **текст**, который подмешивается в каждый запрос к LLM: какая цель и какие ограничения. Это **не** песочница и **не** технический запрет на команды — только явная подсказка модели и тебе. Чтобы напомнить себе смысл переменных и увидеть текущие значения, в REPL есть команда **`scope`**.

```bash
export PENTEST_SCOPE_TARGET="10.10.x.x   # ваша лабораторная цель"
export PENTEST_SCOPE_POLICY="только учебный стенд X; без выхода за подсеть"
```

## LLM / OpenRouter

Ключ берётся на [openrouter.ai/keys](https://openrouter.ai/keys). Задай переменные окружения **или** файл **`.env`** в каталоге запуска (подхватывается автоматически через `python-dotenv`).

```bash
cp .env.example .env
# отредактируй .env — минимум OPENROUTER_API_KEY
```

Либо в shell:

```bash
export OPENROUTER_API_KEY="sk-or-..."
export OPENROUTER_MODEL="google/gemini-2.5-flash"
# или
export OPENROUTER_MODEL="openai/gpt-4o-mini"
# необязательно, уже совпадает с OpenRouter:
# export OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
```

Проверка ключа **без расхода на генерацию** (запрос `GET …/models`):

```bash
pentest-copilot doctor
copilot doctor
```

Без ключа или с `copilot chat --dry-run` сеть к chat completions не вызывается — только сбор контекста.

## Запуск

После `pip install -e .` доступны **`copilot`** и **`pentest-copilot`**:

```bash
copilot chat
pentest-copilot chat
python -m pentest_copilot chat

# без LLM (показать собираемый промпт):
copilot chat --dry-run

# по умолчанию предлагать внешнее окно терминала для bash-блоков (Kali/Linux):
copilot chat --terminal-window
# то же через env:
export COPILOT_TERMINAL_MODE=window   # embed | window
# свой эмулятор (опционально): строка argv для Popen, затем bash и скрипт
# export COPILOT_TERMINAL_EMULATOR='gnome-terminal --'
```

Внутри сессии при старте показывается баннер (**HACK THE PLANET** / `forced by AI`) и краткая карточка сессии.

- Обычный **русский текст** — мультитёрн диалог; в каждый запрос подмешиваются скоуп, **Todo**, **jobs** (что уже запускалось / в фоне / завершилось), актуальный **context** (hostname, cwd, при SSH — `SSH_CONNECTION`), фрагмент `knowledge/tactics_stub.md`.
- Блоки **` ```bash` ** → при нескольких блоках подряд выбираешь номер (**[1]…[n]**, **[0]**, **[a]** все по очереди); затем одно подтверждение **«Запустить здесь?»** (Enter/да — да). Запуск всегда в текущем терминале; режим вывода задаёт **`COPILOT_FG_MODE`**=stream|tty|classic (по умолчанию стрим-превью). Фон, окно ОС и stdin-слот — только при **`trust on`** и переменных **`COPILOT_TRUST_*`** (см. **`help`** в REPL).
- **`jobs`** — таблица задач сессии; то же самое в сжатом виде уходит в промпт к LLM.
- **`todo add …`** · **`todo list`** · **`todo done <id>`** — состояние в `~/.pentest-copilot/sessions/<id>/todos.json`.
- **`trust on`** / **`trust off`** или **`COPILOT_TRUST_FLOW=1`** — выполнять предложенные команды без запроса подтверждения; режим окна при **`COPILOT_TERMINAL_MODE=window`** и **`COPILOT_ALLOW_EXTERNAL_TERMINAL=1`**. Для фона в trust-сессии: **`export COPILOT_TRUST_BACKGROUND=1`**; stdin-слот: **`COPILOT_TRUST_STDIN_PIPE=1`**.
- **`ktools`** — справка по каталогу Kali через MCP ([evilbotnet/kali-mcp](https://github.com/evilbotnet/kali-mcp)): **`pip install '.[kali-tools-mcp]'`**, **`COPILOT_KALI_TOOLS_MCP_CMD`** (JSON argv, часто `docker run --rm -i …`). Подкоманды REPL: `search`, `usage`, `details`, … При **`COPILOT_KALI_TOOLS_LLM=1`** те же пять вызовов доступны модели как **LLM tools** (function calling на OpenRouter — нужна поддерживающая модель); лимит раундов **`COPILOT_KALI_TOOLS_LLM_MAX_ROUNDS`** (по умолчанию 8). Пока задан MCP_CMD, клиент держит **одну долгоживущую stdio-сессию** (переподъём на каждый вызов — **`COPILOT_KALI_TOOLS_ONE_SHOT=1`**). При старте показывается короткое цветное интро (выкл. **`COPILOT_BOOT_INTRO=0`**); частота **`COPILOT_BOOT_INTRO_HZ`**. Журнал вызовов MCP — **`logs/tool_trace.jsonl`** в каталоге сессии; в REPL **`tooltrace`**; подмешивание хвоста в промпт — **`COPILOT_TOOL_TRACE_IN_PROMPT`** (по умолчанию включено). Ожидание MCP при буте: **`COPILOT_KALI_MCP_BOOT_TIMEOUT`** (сек).
- **`scope`** · **`context`** · **`knowledge`** · **`ktools`** · **`tooltrace`** · **`help`** · **`exit`**.

История: **`~/.pentest-copilot/sessions/<id>/transcript.jsonl`**, учёт команд — **`jobs.json`** рядом.

**SSH:** если ты зашёл по SSH, в блок окружения попадает `SSH_CONNECTION` / при наличии `SSH_TTY` — удобно, когда copilot запущен в той же сессии на сервере.

**Чужие терминалы:** вывод из режима stream/classic «здесь» и хвосты логов фона по **`jobs`**; произвольные другие PTY/tmux — отдельная задача.

## Референс OpenClaw (локально)

Рядом лежит клон/распаковка **[OpenClaw](https://github.com/openclaw/openclaw)**:

`openclaw-main/` — у тебя полный путь:  
`C:\Users\0\PROJECTS\h4ck1ng_app\openclaw-main`

Это **отдельный продукт** (Node ≥22): шлюз (**gateway**), куча каналов (Telegram, Slack, …), **`openclaw agent`**, скиллы/плагины, onboarding. Наш `pentest-copilot` — намеренно **узкий Python CLI** без шлюза и мессенджеров.

| OpenClaw | Этот репозиторий (`pentest-copilot`) |
|----------|--------------------------------------|
| `openclaw agent --message "..."` | `copilot chat` — диалог в терминале |
| Gateway, каналы, daemon | не используем на MVP |
| Skills / plugins (расширения) | **ktools** + MCP docs ([kali-mcp](https://github.com/evilbotnet/kali-mcp)); GraphRAG по `knowledge/` |
| Workspace, модели, OAuth | у нас: **OpenRouter** через env + явный скоуп |

Имеет смысл смотреть OpenClaw как образец **оркестрации агента и политик**, а пентест-специфику держать у нас (скоуп, tactic stub → граф, вызов MCP для команд).

## Дальше

- **GraphRAG**: заменить плоский stub на граф тактик + retrieval.
- **MCP**: отдельный сервер «формулировка команды», этот хост дергает его как клиент.
- **Захват UI**: позже — только под явным разрешением и политикой.
