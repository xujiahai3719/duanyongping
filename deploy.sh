#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT_DIR"

# Local deployment settings are intentionally ignored by Git. Export them so
# the OSS publisher can use the same values after the GitHub push succeeds.
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  . "$ROOT_DIR/.env"
  set +a
fi

python3 "$ROOT_DIR/scripts/deploy.py" "$@"

# npm run generate invokes this hook after building. SKIP_DEPLOY prevents the
# nested hook from committing, pushing, or uploading a second time.
if [ "${SKIP_DEPLOY:-}" = "1" ] || [ -n "${CF_PAGES:-}" ] || [ -n "${CI:-}" ]; then
  exit 0
fi

if [ "${DEPLOY_OSS:-1}" = "0" ]; then
  echo "OSS deployment disabled by DEPLOY_OSS=0."
  exit 0
fi

if [ -z "${ALIYUN_OSS_BUCKET:-}" ]; then
  echo "OSS is not configured; GitHub/Cloudflare deployment completed."
  echo "Set ALIYUN_OSS_BUCKET in .env to enable OSS publishing."
  exit 0
fi

OSS_DEPLOY_BRANCH=${OSS_DEPLOY_BRANCH:-main}
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$OSS_DEPLOY_BRANCH" ]; then
  echo "Skipping OSS deployment from '$CURRENT_BRANCH'; production branch is '$OSS_DEPLOY_BRANCH'."
  exit 0
fi

echo "-> Publish static site to Aliyun OSS"
if [ "${DEPLOY_FROM_GENERATE:-}" = "1" ]; then
  exec "$ROOT_DIR/scripts/deploy-oss.sh" --upload-only
fi
exec "$ROOT_DIR/scripts/deploy-oss.sh"
