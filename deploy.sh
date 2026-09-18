#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT_DIR"

# Load local settings such as DEPLOY_GIT_REMOTE for the GitHub deployment.
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  . "$ROOT_DIR/.env"
  set +a
fi

exec python3 "$ROOT_DIR/scripts/deploy.py" "$@"
