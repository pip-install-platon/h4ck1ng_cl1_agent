# pentest-copilot-host

Интерактивный **CLI-хост** для пентеста из терминала (в т.ч. Kali): русскоязычный чат с моделью, подстановка контекста (скоуп, методология из `knowledge/`, memory, jobs, tmux), выполнение предложенных **`bash`** только после подтверждения (или в режиме trust), опционально **справка по пакетам Kali** и **методология/CVE** через **MCP** (stdio). Без Electron.

## Что внутри

| Часть | Роль |
|-------|------|
| **REPL** | Ввод текста → запрос к LLM; блоки `bash` → подтверждение и запуск через хост (`task`, `trust`, `manual`, …). |
| **Скоуп** | `PENTEST_SCOPE_*` и команды `target` / `policy` → текст в каждый пользовательский промпт (не ACL и не sandbox). |
| **Методология** | Файл `knowledge/tactics_stub.md` или `COPILOT_KNOWLEDGE_PATH`; команда `knowledge` показывает полный фрагмент. |
| **Файл скана** | `COPILOT_SCOPE_FACTS_FILE` — подстановка в промпт сводки + эвристический разбор IP / строк портов / фрагментов OS (см. ниже). |
| **MCP Kali** | Документация инструментов Kali (`ktools` в REPL; при `COPILOT_KALI_TOOLS_LLM=1` — как LLM tools). |
| **MCP security-framework** | При `COPILOT_SECURITY_FRAMEWORK_LLM=1` — OWASP/WSTG/CVE/CWE и др. (whitelist tools). |
| **Артефакты** | Каталог сессии `~/.pentest-copilot/sessions/<id>/`: транскрипт, todo, jobs, `tool_trace.jsonl`, scope. |

Подмодули исходников: **`pentest_copilot.mcp`** (stdio MCP Kali и security-framework, журнал вызовов tools), **`pentest_copilot.repl`** (рамка ввода, многострочный композер, меню выбора bash-блоков); в корне пакета — оркестрация (`host`), сессия, runner, контекст и т.д.

Несколько хостов в одном задании: поле **target** — одна строка произвольного текста; можно перечислить несколько IP/CIDR/имён через запятую или с переносами. Для тяжёлого вывода сканера удобнее **файл** (`COPILOT_SCOPE_FACTS_FILE`): там и сырой хвост, и авто-выжимка портов/OS.

## Требования

| Компонент | Минимум |
|-----------|---------|
| Python | **3.11+** |
| LLM | Ключ и совместимый HTTP API (по умолчанию OpenRouter) или `--dry-run` |
| ktools | Docker + образ [kali-mcp](https://github.com/evilbotnet/kali-mcp), extras **`[kali-tools-mcp]`** |

## Установка и запуск

### Вариант A — лаунчер из репозитория

Подходит для ежедневного запуска одной командой **`copilot`** (venv и зависимости подтягиваются при необходимости):

```bash
chmod +x bin/copilot
export PATH="/absolute/path/to/h4ck1ng_app/bin:$PATH"   # лучше добавить в ~/.bashrc

copilot                    # интерактивный чат
copilot doctor
copilot --dry-run
```

См. **`src/pentest_copilot/preflight.py`** (спиннер при первом `pip install -e`).

### Вариант B — классический venv

```bash
cd /path/to/h4ck1ng_app
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[kali-tools-mcp]"

copilot chat
pentest-copilot chat
```

### Вариант C — скрипт с git pull

```bash
chmod +x scripts/copilot-up.sh
./scripts/copilot-up.sh              # pull + venv + pip + copilot
./scripts/copilot-up.sh --no-pull --dry-run
```

## LLM: не только OpenRouter

Клиент ходит в **`POST {OPENROUTER_BASE_URL}/chat/completions`** в формате **OpenAI Chat Completions** (`messages`, опционально `tools`). Имена переменных исторические (`OPENROUTER_*`), но подставить можно любой **OpenAI-совместимый** endpoint:

| Провайдер / режим | Пример `OPENROUTER_BASE_URL` |
|-------------------|------------------------------|
| OpenRouter | `https://openrouter.ai/api/v1` |
| OpenAI | `https://api.openai.com/v1` |
| LM Studio | `http://127.0.0.1:1234/v1` |
| Ollama (режим совместимости) | часто `http://127.0.0.1:11434/v1` |
| Локальный vLLM / др. | URL до суффикса `/v1` у вашего сервера |

- **`OPENROUTER_API_KEY`** — заголовок `Authorization: Bearer …`. Для локального сервера без ключа иногда достаточно произвольной строки — зависит от сервера.
- **`OPENROUTER_MODEL`** — идентификатор модели в том виде, как его ждёт ваш API.

Дополнительно:

| Переменная | Назначение |
|------------|------------|
| **`COPILOT_OPENAI_COMPAT_MODE=1`** | Убрать заголовки `HTTP-Referer` и `X-Title` (некоторые прокси/шлюзы их режут или не любят). |
| **`COPILOT_LLM_EXTRA_HEADERS_JSON`** | JSON-объект с дополнительными заголовками, например `{"api-key":"…"}` для кастомных шлюзов. |

**`copilot doctor`** делает лёгкий **`GET …/models`**. У части локальных серверов этого маршрута нет (**404**) — тогда `doctor` всё равно может завершиться успехом с пояснением; финальная проверка — короткий запрос в REPL.

## Скоуп и файл результатов скана

| Переменная | Назначение |
|------------|------------|
| **`PENTEST_SCOPE_TARGET`** | Текст цели(ей): один хост, несколько IP, CIDR, заметки — одна строка или многострочное значение в env. |
| **`PENTEST_SCOPE_POLICY`** | Политика / ограничения в свободной форме. |
| **`COPILOT_SCOPE_FACTS_FILE`** | Путь к файлу (относительно cwd допустим): вывод nmap -oG / обычный stdout / фрагмент XML и т.д. В промпт попадают: список IPv4 (в т.ч. из строк `Host:` grepable), строки вида `22/tcp open ssh`, фрагменты строк с подсказками OS, затем **сырой хвост** файла (объём режется лимитами). |
| **`COPILOT_SCOPE_FACTS_MAX_BYTES`** | Сколько байт читать с начала файла (по умолчанию **524288**). |
| **`COPILOT_SCOPE_FACTS_PROMPT_CHARS`** | Верхняя граница размера блока в промпте (по умолчанию **12000**). |

Разбор **эвристический**: точные версии сервисов и ОС модель должна читать из сырого хвоста; IPv6 сейчас не извлекаются отдельным списком.

В REPL команды **`target`** / **`policy`** переопределяют env для текущей сессии (`scope_chat.json`).

## Конфигурация (общая)

Скопируй **`.env.example`** → **`.env`** в каталоге запуска или экспортируй переменные.

### API и модель

| Переменная | Назначение |
|------------|------------|
| `OPENROUTER_API_KEY` | Токен Bearer для выбранного API |
| `OPENROUTER_BASE_URL` | База URL (**без** `/chat/completions` — суффикс добавляется кодом) |
| `OPENROUTER_MODEL` | Основная модель: диалог пентеста, tool calls, генерация команд в ответах |
| `COPILOT_COMMAND_MODEL` | Необязательно: **вторая** модель только для «командной» вспомогательной работы (резюме вывода после запуска, переформулировка после ошибки). Пусто — везде используется **`OPENROUTER_MODEL`**. Чат и tools остаются на основной модели. |

### Методология и промпт

| Переменная | Назначение |
|------------|------------|
| `COPILOT_KNOWLEDGE_PATH` | Свой markdown вместо `knowledge/tactics_stub.md` |
| `COPILOT_TACTICS_MAX` | Лимит символов при загрузке stub в память (дефолт **12000**) |
| `COPILOT_TACTICS_PROMPT_MODE` | `full` \| `minimal` — объём методологии в user-блоке; при security-LLM без режима по умолчанию короче |

### Транскрипт и LLM-история

| Переменная | Назначение |
|------------|------------|
| `COPILOT_TRANSCRIPT_FULL_FOR_LLM` | Полная история в модель (1/true) |
| `COPILOT_LLM_MSG_CAP` | Лимит символов сообщений (дефолт **7200**) |
| `COPILOT_LLM_ASSISTANT_CAP` | Отдельный лимит для ответов ассистента (если задан) |
| `COPILOT_JOBS_VERBOSE_LLM` | Расширенное описание jobs в промпте |

### Memory

| Переменная | Назначение |
|------------|------------|
| `COPILOT_MEMORY_MAX_CHARS` | Лимит блока memory в промпте |

### Терминал, trust, вывод команд

| Переменная | Назначение |
|------------|------------|
| `COPILOT_TERMINAL_MODE` | `embed` \| `window` — окно ОС только с `COPILOT_ALLOW_EXTERNAL_TERMINAL=1` |
| `COPILOT_ALLOW_EXTERNAL_TERMINAL` | Разрешить отдельное окно |
| `COPILOT_FG_MODE` | `stream` \| `tty` \| `classic` — вывод «здесь» |
| `COPILOT_TRUST_FG` | Режим fg для trust, если `FG_MODE` пуст |
| `COPILOT_TRUST_BACKGROUND` | Фоновые процессы в trust |
| `COPILOT_TRUST_STDIN_PIPE` | stdin-слот для фона в trust |
| `COPILOT_TRUST_FLOW` | Старт с trust как после `trust on` |
| `COPILOT_TERMINAL_EMULATOR` | Внешний эмулятор терминала (spawn) |
| `COPILOT_CMD_TIMEOUT` | Таймаут команд (сек) |

### Стрим и превью

| Переменная | Назначение |
|------------|------------|
| `COPILOT_STREAM_MODE` | `chunk` \| `line` |
| `COPILOT_STREAM_CHUNK_BYTES` | Размер чанка |
| `COPILOT_STREAM_REFRESH_HZ` | Частота обновления |
| `COPILOT_STREAM_PREVIEW_LINES` | Строк превью после команды (дефолт **12**) |
| `COPILOT_STREAM_CHUNK_LINE_TAIL` | В режиме **chunk**: минимум последних строк (дефолт **20**) |
| `COPILOT_STREAM_CHUNK_PREVIEW_CHARS` | При «мало строк» — хвост буфера до N символов (дефолт **8000**) |
| `COPILOT_STREAM_PREVIEW_MIN_CHARS` | Порог для переключения на хвост по символам |
| `COPILOT_STREAM_HEARTBEAT` | **1** — подпись со спиннером и метриками даже без новых строк (ощущение «живого» процесса) |
| `COPILOT_STREAM_TICK_SEC` | Пауза ожидания чанка/строки для опроса очереди и обновления пульса (сек, по умолчанию **0.12**) |
| `COPILOT_POST_RUN_LLM_DIGEST` | После **stream**/**classic**: **auto** (пусто) — резюме через LLM если задан API-ключ; **0** — выкл.; **1** — принудительно |
| `COPILOT_POST_RUN_LLM_DIGEST_TIMEOUT` | Таймаут запроса резюме (сек) |
| `COPILOT_POST_RUN_LLM_DIGEST_MAX_CHARS` | Максимум символов stdout в промпт резюме |
| `COPILOT_POST_RUN_LLM_DIGEST_MIN_CHARS` | Не вызывать LLM если суммарный вывод короче N символов |
| `COPILOT_CMD_RETRY_ON_FAIL` | **1** — при ненулевом exit (stream/classic) запросить у LLM альтернативную команду в блоке bash и второе подтверждение; **0** — выкл. |
| `COPILOT_CMD_RETRY_MAX` | Сколько **дополнительных** запусков после первой неудачи (0…8, по умолчанию **1**, итого до 2 попыток) |
| `COPILOT_CMD_RETRY_LLM_TIMEOUT` | Таймаут запроса переформулировки (сек) |
| `COPILOT_CMD_RETRY_LLM_MAX_CHARS` | Лимит stdout в промпт для retry-LLM |
| `COPILOT_STRIP_ANSI_PREVIEW` | **1** — убрать ANSI из превью (msf/nmap) |
| `COPILOT_BG_PREVIEW` | Превью stdout фона |
| `COPILOT_BG_PREVIEW_LINES` | Строк превью фона |
| `COPILOT_BG_PREVIEW_BYTES` | Байт чтения хвоста лога |
| `COPILOT_RESULT_COLUMNS` | Две колонки «команда \| хвост» |

### UI REPL

| Переменная | Назначение |
|------------|------------|
| `COPILOT_MENU_HOTKEYS` | Горячие клавиши выбора bash-блока |
| `COPILOT_STICKY_BANNER` | Липкий баннер |
| `COPILOT_STICKY_TAIL` | Хвост строк в липком режиме |
| `COPILOT_STICKY_CLEAR` | Очистка перед промптом |
| `COPILOT_SCROLLBACK_LINES` | Размер скроллбека |
| `COPILOT_INPUT_BOX` | **1** — рамка вокруг строки ввода (стиль Cursor CLI); **0** — только «›» |
| `COPILOT_INPUT_BOX_TITLE` | Заголовок верхней границы рамки (по умолчанию **You**) |
| `COPILOT_INPUT_MULTILINE` | **1** — многострочный композер: **Enter** = отправка; **Shift+Enter** = новая строка там, где терминал отсылает CSI modify-keys (иначе как обычный Enter — см. **Ctrl+O** / **F8**); **F9** — запасная отправка. **0** — однострочный ввод. |

| Переменная | Назначение |
|------------|------------|
| `COPILOT_TMUX_CAPTURE` | Включить снимок панели |
| `COPILOT_TMUX_LINES` | Число строк |
| `COPILOT_TMUX_TARGET` | Цель tmux |

### Task-агент

| Переменная | Назначение |
|------------|------------|
| `COPILOT_AGENT_MAX_STEPS` | Максимум шагов в `task …` |

### MCP Kali (ktools)

| Переменная | Назначение |
|------------|------------|
| `COPILOT_KALI_MCP_AUTO` | Авто Docker (дефолт **1**) |
| `COPILOT_KALI_MCP_DOCKER_IMAGE` | Образ |
| `COPILOT_KALI_MCP_DOCKER_PLATFORM` | `--platform` |
| `COPILOT_KALI_MCP_DOCKER_RUN_ARGS` | Доп. аргументы `docker run` |
| `COPILOT_KALI_TOOLS_MCP_CMD` | JSON argv — полная замена команды stdio |
| `COPILOT_KALI_TOOLS_TIMEOUT` | Таймаут вызова tool |
| `COPILOT_KALI_TOOLS_ONE_SHOT` | Новый subprocess на каждый вызов |
| `COPILOT_KALI_MCP_BOOT_TIMEOUT` | Ожидание при старте |
| `COPILOT_KALI_MCP_PING_TIMEOUT` | Таймаут `list_tools` при boot |
| `COPILOT_KALI_TOOLS_LLM` | Включить Kali tools как LLM function calling |
| `COPILOT_KALI_TOOLS_LLM_MAX_ROUNDS` | Лимит раундов tool_calls (если нет `COPILOT_LLM_TOOL_ROUNDS`) |

### MCP security-framework

| Переменная | Назначение |
|------------|------------|
| `COPILOT_SECURITY_FRAMEWORK_LLM` | Подмешать security tools |
| `COPILOT_SECURITY_FRAMEWORK_MCP_CMD` | JSON argv stdio |
| `COPILOT_SECURITY_MCP_AUTO` | Искать `security-framework-mcp` в PATH (дефолт выкл.) |
| `COPILOT_SECURITY_TOOLS_ALLOWLIST` | Имена через запятую |
| `COPILOT_SECURITY_MCP_BOOT_TIMEOUT` | Boot-intro |
| `COPILOT_SECURITY_MCP_PING_TIMEOUT` | Ping/list при старте |
| `COPILOT_SECURITY_MCP_LIST_TOOLS_TIMEOUT` | Таймаут `list_tools` при загрузке схем |
| `COPILOT_SECURITY_MCP_TOOL_TIMEOUT` | Таймаут вызова (иначе как Kali timeout) |
| `COPILOT_SECURITY_TOOLS_ONE_SHOT` | Без долгой сессии |

### LLM tool rounds и журнал

| Переменная | Назначение |
|------------|------------|
| `COPILOT_LLM_TOOL_ROUNDS` | Лимит раундов tool_calls (приоритет над Kali-переменной) |
| `COPILOT_TOOL_TRACE_IN_PROMPT` | Подмешивать хвост `tool_trace.jsonl` в промпт |

### Прочее

| Переменная | Назначение |
|------------|------------|
| `COPILOT_BOOT_INTRO` | Цветное интро при старте (**0** — выкл.) |
| `COPILOT_BOOT_INTRO_MIN_SEC` | Минимум секунд показа интро после MCP (дефолт **1**) |
| `COPILOT_BOOT_INTRO_HZ` | Частота кадров интро |
| `COPILOT_PREFLIGHT_SKIP_PIP_UPGRADE` | **1** — не обновлять pip/setuptools из лаунчера (офлайн) |
| `COPILOT_PREFLIGHT_PIP_TIMEOUT` | Таймаут pip upgrade (сек) |
| `COPILOT_PREFLIGHT_NO_MCP` | Preflight без MCP extra |
| `PENTEST_COPILOT_ROOT` | Корень проекта для preflight |

Проверка ключа без генерации:

```bash
copilot doctor
```

## Docker: образ для ktools

Один раз:

```bash
docker build -t kali-tools-mcp-server:latest https://github.com/evilbotnet/kali-mcp.git#main
```

При ошибке платформы — сборка из клона репозитория или **`COPILOT_KALI_MCP_DOCKER_PLATFORM`**.

Поведение по умолчанию: **`COPILOT_KALI_MCP_AUTO=1`** собирает `docker run …` (**`COPILOT_KALI_MCP_DOCKER_IMAGE`**). Своя команда stdio: **`COPILOT_KALI_TOOLS_MCP_CMD`** (JSON argv). Детали — этот раздел README и **`ktools`** в REPL.

### Опционально: security-framework-mcp (LLM tools)

Установка сервера (отдельный пакет): [zer0-kr/security-framework-mcp](https://github.com/zer0-kr/security-framework-mcp).

```bash
pip install git+https://github.com/zer0-kr/security-framework-mcp.git
```

При старте Kali и security MCP поднимаются **параллельно**. Полный текст методологии при включённом security-LLM по умолчанию короче в промпте; полный файл — **`knowledge`** (`COPILOT_TACTICS_PROMPT_MODE=full|minimal`).

#### Риски

- Whitelist может не совпасть с именами конкретной версии сервера — смотрите предупреждения в логе при старте.
- Security MCP может тянуть БД и сеть (NVD и др.) — изоляция данных на стороне оператора.
- Совокупный размер схем tools увеличивает расход токенов; при необходимости сокращайте allowlist.

## Каталог `knowledge/`

| Файл | Роль |
|------|------|
| **`tactics_stub.md`** | Фрагмент в промпт + команда **`knowledge`** в REPL |

Описание расширения и **`COPILOT_KNOWLEDGE_PATH`**: **`knowledge/README.md`**.

## Артефакты сессии

База каталогов: **`~/.pentest-copilot/sessions/<id>/`**

| Файл | Содержимое |
|------|------------|
| `transcript.jsonl` | Диалог |
| `jobs.json` | Задачи / процессы |
| `todos.json` | Todo |
| `logs/tool_trace.jsonl` | Вызовы MCP (команда **`tooltrace`**) |
| `scope_chat.json` | Переопределение target/policy из REPL |

## Поведение в REPL (кратко)

- Текст на русском → ответ модели; блоки **` ```bash` **` → подтверждение и запуск через хост.
- **`trust on`** — без запросов на bash (осторожно).
- **`help`** — пользовательская справка (команды и примеры **без** списка env).
- Переменные окружения, Docker MCP и режимы вывода — в таблицах **выше в этом README** и в **`.env.example`**.
- **`task …`**, **`manual …`**, **`scope`**, **`context`**, **`ktools`**, **`tooltrace`**, **`exit`** и др. — таблица внутри **`help`** в REPL.

Флаги CLI: **`copilot chat --dry-run`**, **`--terminal-window`** (внешнее окно для команд при Linux).

## Частые проблемы

| Симптом | Что сделать |
|---------|-------------|
| **PyPI таймаут / setuptools** | Экспорт зеркала или офлайн-кэш pip; **`COPILOT_UP_SKIP_PIP_UPGRADE=1 ./scripts/copilot-up.sh`**; для лаунчера **`COPILOT_PREFLIGHT_SKIP_PIP_UPGRADE=1`**; на Kali часто помогает **`sudo apt install python3-setuptools python3-pip`** до `pip install -e`. |
| **Интро не видно** | По умолчанию панель короткая и **`transient`**; выставь **`COPILOT_BOOT_INTRO_MIN_SEC=1.5`**. Явно выключено: **`COPILOT_BOOT_INTRO=0`**. |
| **Стрим «только начало и конец»** | Увеличь **`COPILOT_STREAM_PREVIEW_LINES`** (дефолт теперь **12**); для режима chunk — **`COPILOT_STREAM_CHUNK_LINE_TAIL`** (сколько последних строк держать), **`COPILOT_STREAM_CHUNK_PREVIEW_CHARS`**; **`COPILOT_STRIP_ANSI_PREVIEW=1`** убирает мусорные ESC-последовательности из msf/nmap. |
| **Пути без ~/** | В баннере и блоке «Окружение» cwd и каталог сессии показываются как **`~/...`**, если путь внутри HOME. |
| **Shift+Enter в композере = обычный Enter** | В классическом conhost Shift+Enter часто не отличить от Enter. Новая строка: **Ctrl+O** или **F8**; удобнее **Windows Terminal** / встроенный терминал редактора. |
| **Metasploit ломается в однострочнике** | Это не запрет на работу: делай **пошагово** и держи чеклист в **`todo add …`**. Варианты: **`COPILOT_FG_MODE=tty`** + один запуск **`msfconsole`** (живая консоль в том же терминале — как «вложенное окно» без отдельного GUI); или много коротких **`msfconsole -q -x "…; exit"`** с подтверждением **каждого** bash-блока; опасный **`run`/`exploit`** или большой **`-r`** — только отдельным шагом после **`search`/`info`/`options`** на твоей версии MSF. Для структуры опций на диске: **`msfconsole -h`**, **`msfvenom -h`**, внутри консоли **`help`** / **`info`**. |
| **Metasploit через отдельный MCP** | [MetasploitMCP](https://github.com/GH05TCREW/MetasploitMCP) — MCP-сервер поверх **msfrpcd** (Python, stdio или HTTP). Это **не** тот же протокол/набор tools, что у встроенного Kali **ktools** MCP в copilot; подключение к этому хосту потребовало бы отдельной доработки. Для текущего copilot MSF остаётся через **`msfconsole`** и подтверждённые bash-блоки. |

## Отличие от OpenClaw

[OpenClaw](https://github.com/openclaw/openclaw) — отдельный стек (gateway, каналы, Node). Этот репозиторий — узкий Python CLI: терминал, скоуп, ktools/MCP, методология из файлов.
