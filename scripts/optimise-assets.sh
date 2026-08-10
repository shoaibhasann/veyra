#!/usr/bin/env bash
#
# optimise-assets.sh — encode a .webp beside every .png in public/assets.
#
# The source renders are 2688x1536 (wheel.png is 2048x2048) PNGs totalling
# ~16 MB, which is far too heavy to ship. WebP at q=88 keeps the container
# corrugation and the rim/bolt detail clean while cutting the set to well
# under 2 MB. The PNGs are kept on disk as the masters; components reference
# the .webp files.
#
# Usage:  ./scripts/optimise-assets.sh [--quality N] [--dry-run]
#
set -euo pipefail

QUALITY=88
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -q|--quality) QUALITY="$2"; shift 2 ;;
    -n|--dry-run) DRY_RUN=1; shift ;;
    -h|--help)
      sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$ROOT/public/assets"

[[ -d "$ASSETS" ]] || { echo "no such directory: $ASSETS" >&2; exit 1; }

# ---------------------------------------------------------------- encoder
# cwebp is the reference WebP encoder and is what we want: it exposes
# -sharp_yuv and lossless alpha. Some ffmpeg builds (including the Homebrew
# one on this machine) ship without libwebp, so ffmpeg is only a fallback.
CWEBP="$(command -v cwebp || true)"
FFMPEG="${FFMPEG:-/opt/homebrew/bin/ffmpeg}"
[[ -x "$FFMPEG" ]] || FFMPEG="$(command -v ffmpeg || true)"

ENCODER=""
if [[ -n "$CWEBP" ]]; then
  ENCODER="cwebp"
elif [[ -n "$FFMPEG" ]] && "$FFMPEG" -hide_banner -h encoder=libwebp >/dev/null 2>&1; then
  ENCODER="ffmpeg"
else
  echo "error: need cwebp (brew install webp) or an ffmpeg built with libwebp" >&2
  exit 1
fi

encode() { # encode <src.png> <dst.webp>
  case "$ENCODER" in
    cwebp)
      # -m 6      slowest / smallest search
      # -pass 6   multi-pass rate control
      # -sharp_yuv better RGB->YUV, keeps the corrugation edges from smearing
      # -alpha_q 100 lossless alpha, so cut-out silhouettes stay crisp
      "$CWEBP" -quiet -q "$QUALITY" -m 6 -pass 6 -sharp_yuv -alpha_q 100 \
               -metadata none "$1" -o "$2"
      ;;
    ffmpeg)
      "$FFMPEG" -v error -y -i "$1" -c:v libwebp -quality "$QUALITY" \
                -compression_level 6 -preset picture "$2"
      ;;
  esac
}

filesize() { stat -f%z "$1" 2>/dev/null || stat -c%s "$1"; }

human() {
  awk -v b="$1" 'BEGIN{
    if (b < 1024) printf "%d B", b;
    else if (b < 1048576) printf "%.1f KB", b/1024;
    else printf "%.2f MB", b/1048576;
  }'
}

# ---------------------------------------------------------------- run
shopt -s nullglob
pngs=("$ASSETS"/*.png)
(( ${#pngs[@]} )) || { echo "no PNGs found in $ASSETS" >&2; exit 1; }

echo "encoder : $ENCODER    quality: $QUALITY"
echo "assets  : $ASSETS"
echo
printf "%-26s %12s %12s %10s\n" "FILE" "PNG" "WEBP" "SAVED"
printf "%-26s %12s %12s %10s\n" "--------------------------" "------------" "------------" "----------"

total_before=0
total_after=0

for src in "${pngs[@]}"; do
  dst="${src%.png}.webp"
  before=$(filesize "$src")

  if (( DRY_RUN )); then
    after=0
  else
    encode "$src" "$dst"
    after=$(filesize "$dst")
  fi

  total_before=$(( total_before + before ))
  total_after=$(( total_after + after ))

  pct=$(awk -v a="$before" -v b="$after" 'BEGIN{ printf "%.1f", a ? (1-b/a)*100 : 0 }')
  printf "%-26s %12s %12s %9s%%\n" \
    "$(basename "$src")" "$(human "$before")" "$(human "$after")" "$pct"
done

pct=$(awk -v a="$total_before" -v b="$total_after" 'BEGIN{ printf "%.1f", a ? (1-b/a)*100 : 0 }')
printf "%-26s %12s %12s %10s\n" "--------------------------" "------------" "------------" "----------"
printf "%-26s %12s %12s %9s%%\n" "TOTAL" "$(human "$total_before")" "$(human "$total_after")" "$pct"
echo
echo "PNG masters kept in place. Components should reference the .webp files."
