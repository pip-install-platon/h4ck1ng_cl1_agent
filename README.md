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
- Блоки **` ```bash` ** → **[1]** здесь (stdout в copilot) · **[2]** окно терминала · **[3]** фон (PID, логи в `sessions/<id>/logs/`) · **[0]** отмена · **[5]** доверить флоу. Для **[3]** перед каждым следующим сообщением к модели выполняется poll: завершённые задачи получают exit-код и хвост лога в контексте. Режим **[2]** по-прежнему не даёт автоматического stdout в транскрипт.
- **`jobs`** — таблица задач сессии; то же самое в сжатом виде уходит в промпт к LLM.
- **`todo add …`** · **`todo list`** · **`todo done <id>`** — состояние в `~/.pentest-copilot/sessions/<id>/todos.json`.
- **`trust on`** / **`trust off`** или **`COPILOT_TRUST_FLOW=1`** — без меню (как задано `COPILOT_TERMINAL_MODE`). Для фона в trust-сессии: **`export COPILOT_TRUST_BACKGROUND=1`**.
- **`scope`** · **`context`** · **`knowledge`** · **`help`** · **`exit`**.

История: **`~/.pentest-copilot/sessions/<id>/transcript.jsonl`**, учёт команд — **`jobs.json`** рядом.

**SSH:** если ты зашёл по SSH, в блок окружения попадает `SSH_CONNECTION` / при наличии `SSH_TTY` — удобно, когда copilot запущен в той же сессии на сервере.

**Чужие терминалы:** вывод только из **[1]** и хвосты после завершения **[3]**; произвольные другие PTY/tmux — отдельная задача.

## Референс OpenClaw (локально)

Рядом лежит клон/распаковка **[OpenClaw](https://github.com/openclaw/openclaw)**:

`openclaw-main/` — у тебя полный путь:  
`C:\Users\0\PROJECTS\h4ck1ng_app\openclaw-main`

Это **отдельный продукт** (Node ≥22): шлюз (**gateway**), куча каналов (Telegram, Slack, …), **`openclaw agent`**, скиллы/плагины, onboarding. Наш `pentest-copilot` — намеренно **узкий Python CLI** без шлюза и мессенджеров.

| OpenClaw | Этот репозиторий (`pentest-copilot`) |
|----------|--------------------------------------|
| `openclaw agent --message "..."` | `copilot chat` — диалог в терминале |
| Gateway, каналы, daemon | не используем на MVP |
| Skills / plugins (расширения) | позже: **MCP** + GraphRAG по `knowledge/` |
| Workspace, модели, OAuth | у нас: **OpenRouter** через env + явный скоуп |

Имеет смысл смотреть OpenClaw как образец **оркестрации агента и политик**, а пентест-специфику держать у нас (скоуп, tactic stub → граф, вызов MCP для команд).

## Дальше

- **GraphRAG**: заменить плоский stub на граф тактик + retrieval.
- **MCP**: отдельный сервер «формулировка команды», этот хост дергает его как клиент.
- **Захват UI**: позже — только под явным разрешением и политикой.
