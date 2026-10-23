"""Load the local .env for manage.py; Docker supplies the same values directly."""
import os
import re
from pathlib import Path


def load_local_env():
    path = Path(__file__).resolve().parent.parent / '.env'
    if not path.is_file():
        return
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key, value = key.strip(), value.strip()
        if re.fullmatch(r'[A-Z][A-Z0-9_]*', key):
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            os.environ.setdefault(key, value)
