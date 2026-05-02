#!/usr/bin/env bash
# Обновление репозитория, venv, зависимостей и запуск copilot (Kali / Linux).
# Для запуска одной командой `copilot` из любого каталога см. ../bin/copilot и PATH.
#
# Использование:
#   chmod +x scripts/copilot-up.sh
#   ./scripts/copilot-up.sh
#   ./scripts/copilot-up.sh --dry-run
#   ./scripts/copilot-up.sh doctor
#
# Без git pull:
#   ./scripts/copilot-up.sh --no-pull
#   COPILOT_UP_NO_PULL=1 ./scripts/copilot-up.sh
#
# Только подготовка окружения:
#   ./scripts/copilot-up.sh --bootstrap-only
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT}"

VENV="${ROOT}/.venv"
PIP="${VENV}/bin/pip"

DO_GIT_PULL=1
INSTALL_MCP=1
BOOTSTRAP_ONLY=0
FORWARD=()

usage() {
  cat <<'EOF'
Опции скрипта:
  --no-pull           не выполнять git pull
  --no-mcp            только pip install -e . (без extra kali-tools-mcp / пакета mcp)
  --bootstrap-only    только venv и pip install, copilot не запускать
  -h, --help          справка

Переменные окружения:
  COPILOT_UP_NO_PULL=1             не делать git pull
  COPILOT_UP_SKIP_PIP_UPGRADE=1   не обновлять pip/setuptools (офлайн)

Все прочие аргументы передаются в copilot (например --dry-run, doctor).
EOF
}

if [[ "${COPILOT_UP_NO_PULL:-}" =~ ^(1|true|yes)$ ]]; then
  DO_GIT_PULL=0
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-pull)
      DO_GIT_PULL=0
      shift
      ;;
    --no-mcp)
      INSTALL_MCP=0
      shift
      ;;
    --bootstrap-only)
      BOOTSTRAP_ONLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      FORWARD+=("$@")
      break
      ;;
    *)
      FORWARD+=("$1")
      shift
      ;;
  esac
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "Нужен python3 в PATH (ожидается >= 3.11)." >&2
  exit 1
fi

if ! python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" 2>/dev/null; then
  echo "Нужен Python >= 3.11 (текущий: $(python3 -V 2>&1))." >&2
  exit 1
fi

if [[ "${DO_GIT_PULL}" == "1" ]] && [[ -d "${ROOT}/.git" ]]; then
  echo "[copilot-up] git pull…"
  git -C "${ROOT}" pull --ff-only 2>/dev/null || git -C "${ROOT}" pull
fi

if [[ ! -d "${VENV}" ]]; then
  echo "[copilot-up] создание venv: ${VENV}"
  python3 -m venv "${VENV}"
fi

if [[ "${COPILOT_UP_SKIP_PIP_UPGRADE:-}" =~ ^(1|true|yes)$ ]]; then
  echo "[copilot-up] пропуск обновления pip/setuptools (offline / COPILOT_UP_SKIP_PIP_UPGRADE=1)"
else
  echo "[copilot-up] обновление pip…"
  "${PIP}" install -q -U pip setuptools wheel || echo "[copilot-up] предупреждение: pip upgrade не удался (сеть/PyPI?) — пробуем pip install -e"
fi

if [[ "${INSTALL_MCP}" == "1" ]]; then
  echo "[copilot-up] pip install -e '.[kali-tools-mcp]'…"
  "${PIP}" install -e ".[kali-tools-mcp]"
else
  echo "[copilot-up] pip install -e . …"
  "${PIP}" install -e .
fi

if [[ "${BOOTSTRAP_ONLY}" == "1" ]]; then
  echo "[copilot-up] готово (--bootstrap-only). Дальше: source .venv/bin/activate && copilot chat"
  exit 0
fi

echo "[copilot-up] запуск copilot…"
exec "${VENV}/bin/copilot" "${FORWARD[@]}"
