#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

FRONTEND_DIR="$FRONTEND_DIR" python3 - <<'PY'
import os
from pathlib import Path

NEEDLE = "if (RESERVED_PROPS.includes(prop)) continue;"
ADD = NEEDLE + "\n    if (typeof prop === 'string' && prop.startsWith('x-')) continue;"

dist = Path(os.environ["FRONTEND_DIR"]) / "node_modules/@react-three/fiber/dist"
paths = sorted(dist.glob("events-*.js"))
if not paths:
    raise SystemExit(f"React Three Fiber event bundles not found under {dist}")

for path in paths:
    src = path.read_text()
    src = src.replace(ADD, NEEDLE)
    src = src.replace(NEEDLE, ADD)
    path.write_text(src)
    cnt = src.count("prop.startsWith('x-')")
    print(f"patched {path}: {cnt} occurrences")
PY
