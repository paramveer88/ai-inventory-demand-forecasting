#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# Offline research only: no database, app startup, business imports or UI changes.
if [ -n "${RESEARCH_PYTHON:-}" ]; then
  task_python="$RESEARCH_PYTHON"
elif [ -x ml-service/venv/bin/python ]; then
  task_python=ml-service/venv/bin/python
elif [ -x ml-service/.venv/bin/python ]; then
  task_python=ml-service/.venv/bin/python
else
  if [ ! -x .research-venv/bin/python ]; then python3 -m venv .research-venv; fi
  task_python=.research-venv/bin/python
fi
if ! "$task_python" -c 'from importlib.metadata import version; assert version("openpyxl")=="3.1.5"; assert version("pandas")=="3.0.2"; assert version("numpy")=="2.4.4"; assert version("et-xmlfile")=="2.0.0"' 2>/dev/null; then
  "$task_python" -m pip install -r experiments/requirements.txt
fi
exec "$task_python" -m experiments.cli reproduce "$@"
