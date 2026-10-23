"""Compatibility entry point. Runtime and data now live in Django/PostgreSQL."""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nazdika.settings")
import django
django.setup()

from catalog.services import endpoint  # Existing frontend rendering checks use this read-only API.

if __name__ == "__main__":
    from django.core.management import execute_from_command_line
    print("Django/PostgreSQL: use docker compose up --build (see README.md).", file=sys.stderr)
    execute_from_command_line([sys.argv[0], "runserver", *sys.argv[1:]])
