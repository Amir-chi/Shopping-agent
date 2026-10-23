"""Compatibility test entry point; runs isolated PostgreSQL tests inside Docker."""
import subprocess
import sys

if __name__ == "__main__":
    sys.exit(subprocess.call(["docker", "compose", "exec", "-T", "web", "python", "manage.py",
                             "test", "catalog.tests.test_api", "--noinput", *sys.argv[1:]]))
