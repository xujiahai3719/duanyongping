#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="$ROOT_DIR/.output/public"
BUILD=1
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-oss.sh [--upload-only] [--dry-run]

Required environment:
  ALIYUN_OSS_BUCKET   Destination OSS bucket name

Optional environment:
  OSS_REGION          OSS region used by ossutil (default: cn-hangzhou)
  ALIYUN_CLI_PROFILE  Alibaba Cloud CLI OAuth profile (preferred when set)
  OSSUTIL_PROFILE     Named ossutil profile
  OSSUTIL_BIN         Path to ossutil
  OSS_DELETE_STALE    Set to 1 to delete remote files absent locally
EOF
}

while (($#)); do
  case "$1" in
    --upload-only)
      BUILD=0
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

: "${ALIYUN_OSS_BUCKET:?Set ALIYUN_OSS_BUCKET to the destination bucket name.}"
export OSS_REGION="${OSS_REGION:-cn-hangzhou}"

if [[ -n "${ALIYUN_CLI_PROFILE:-}" ]]; then
  if command -v aliyun >/dev/null 2>&1; then
    UPLOADER="$(command -v aliyun)"
  elif [[ -x "$HOME/.local/bin/aliyun" ]]; then
    UPLOADER="$HOME/.local/bin/aliyun"
  else
    echo "aliyun CLI was not found, but ALIYUN_CLI_PROFILE is set." >&2
    exit 1
  fi
elif [[ -n "${OSSUTIL_BIN:-}" ]]; then
  UPLOADER="$OSSUTIL_BIN"
elif command -v ossutil >/dev/null 2>&1; then
  UPLOADER="$(command -v ossutil)"
elif [[ -x "$HOME/.local/bin/ossutil" ]]; then
  UPLOADER="$HOME/.local/bin/ossutil"
else
  echo "ossutil was not found. Install ossutil 2.x or set OSSUTIL_BIN." >&2
  exit 1
fi

if ((BUILD)); then
  echo "-> Generating static site"
  cd "$ROOT_DIR"
  SKIP_DEPLOY=1 \
    NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}" \
    npm run generate
fi

if [[ ! -f "$PUBLIC_DIR/index.html" ]]; then
  echo "Static output is missing: $PUBLIC_DIR/index.html" >&2
  exit 1
fi

if [[ -n "${ALIYUN_CLI_PROFILE:-}" ]]; then
  SYNC_ARGS=(oss sync "$PUBLIC_DIR/" "oss://$ALIYUN_OSS_BUCKET/"
    --force
    --profile "$ALIYUN_CLI_PROFILE"
    --region "$OSS_REGION"
    --endpoint "oss-$OSS_REGION.aliyuncs.com")
else
  SYNC_ARGS=(sync "$PUBLIC_DIR/" "oss://$ALIYUN_OSS_BUCKET/" --force)
  if [[ -n "${OSSUTIL_PROFILE:-}" ]]; then
    SYNC_ARGS+=(--profile "$OSSUTIL_PROFILE")
  fi
fi

if [[ "${OSS_DELETE_STALE:-0}" == "1" ]]; then
  SYNC_ARGS+=(--delete)
fi

if ((DRY_RUN)); then
  if [[ -n "${ALIYUN_CLI_PROFILE:-}" ]]; then
    echo "--dry-run is not supported by the Alibaba Cloud CLI OSS sync command." >&2
    exit 2
  fi
  SYNC_ARGS+=(--dry-run)
fi

echo "-> Syncing .output/public to oss://$ALIYUN_OSS_BUCKET/ ($OSS_REGION)"
"$UPLOADER" "${SYNC_ARGS[@]}"

if ((DRY_RUN == 0)) && [[ -f "$ROOT_DIR/scripts/oss-website.xml" ]]; then
  echo "-> Applying OSS static website rules"
  if [[ -n "${ALIYUN_CLI_PROFILE:-}" ]]; then
    "$UPLOADER" oss website --method put "oss://$ALIYUN_OSS_BUCKET" \
      "$ROOT_DIR/scripts/oss-website.xml" \
      --profile "$ALIYUN_CLI_PROFILE" \
      --region "$OSS_REGION" \
      --endpoint "oss-$OSS_REGION.aliyuncs.com"
  else
    WEBSITE_ARGS=(website --method put "oss://$ALIYUN_OSS_BUCKET"
      "$ROOT_DIR/scripts/oss-website.xml")
    if [[ -n "${OSSUTIL_PROFILE:-}" ]]; then
      WEBSITE_ARGS+=(--profile "$OSSUTIL_PROFILE")
    fi
    "$UPLOADER" "${WEBSITE_ARGS[@]}"
  fi
fi
