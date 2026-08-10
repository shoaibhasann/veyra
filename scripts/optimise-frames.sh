#!/usr/bin/env bash
#
# optimise-frames.sh — batch re-encode a frame directory to WebP and/or AVIF.
#
#   ./scripts/optimise-frames.sh <frame-dir> [options]
#
#   ./scripts/optimise-frames.sh public/frames/crane
#   ./scripts/optimise-frames.sh public/frames/crane --avif --crf 34
#   ./scripts/optimise-frames.sh renders/crane-png --webp --avif -q 78 --replace
#
# Options:
#   --webp          emit WebP (the default when neither format is named)
#   --avif          emit AVIF
#   -q, --quality N WebP quality 0-100, higher is better (default 82)
#       --crf N     AVIF quality 0-63, LOWER is better (default 32)
#       --preset N  SVT-AV1 speed 0-13, higher is faster/worse (default 6)
#       --from EXT  force the source extension (png | webp | jpg)
#       --replace   delete the source files once every frame converted
#       --dry-run   report what would happen and change nothing
#
# ---------------------------------------------------------------------------
# Why AVIF, and what it actually costs
#
# AVIF is AV1 intra-frame coding in a HEIF container. Against WebP (VP8 intra)
# it brings a decade of codec work: 128x128 superblocks partitioned down to
# 4x4, ~60 intra prediction modes against VP8's 10, and the CDEF and loop
# restoration post-filters. The size win is real and reproducible.
#
# Measured on this project's own frames at 1566x880, from PNG masters,
# WebP q82 vs AVIF CRF 32 (numbers repeated in ASSETS.md):
#
#   photographic content    294.1 KB -> 195.3 KB   AVIF 33.6% smaller
#   flat synthetic content   22.3 KB ->   5.4 KB   AVIF 75.9% smaller
#
# Over a 170-frame sequence that is roughly 6.6 MB against 4.9 MB, on an asset
# the user must fully download before the section can animate at all.
#
# The trade-off usually quoted is decode speed, and it is worth being precise
# about it because the received wisdom did not reproduce here. Decoding all
# 170 frames single-threaded through ffmpeg on Apple Silicon came out at
# ~9.2 ms/frame for BOTH formats — dead even. dav1d's NEON paths are simply
# very good, and Chrome and Firefox ship dav1d too. The AVIF decode penalty is
# real on older hardware and on decoders without those paths, but treat it as
# something to measure on your actual target devices, not as a given.
#
# What did show a clear difference is ENCODE time: 0.170 s/frame for AVIF
# against 0.062 s/frame for WebP, so ~2.7x. That is a build-time cost only,
# paid once, and it is why this script exists as a separate step rather than
# being folded into video-to-frames.sh.
#
# So the reference site's choice of AVIF reads as a straightforward bytes-win
# on an asset sitting squarely on the critical path, not as an exotic trade.
# It also explains keeping the sequence at 1566x880 rather than 2x: at 170
# frames, resolution multiplies transfer and decode at the same time.
#
# Our FrameSequence still defaults to WebP, for reach rather than performance:
# Safari only shipped AVIF in 16.4. Generate both, measure on a real device,
# then decide.
# ---------------------------------------------------------------------------

set -euo pipefail

DO_WEBP=0
DO_AVIF=0
QUALITY=82
CRF=32
PRESET=6
FROM=""
REPLACE=0
DRY=0

usage() {
  awk 'NR > 1 { if (!/^#/ || /^# ?-{10,}/) exit; sub(/^# ?/, ""); print }' "$0"
  exit "${1:-0}"
}

die() { echo "optimise-frames: $*" >&2; exit 1; }

[ $# -ge 1 ] || usage 2
case "$1" in -h|--help) usage 0 ;; esac

DIR="$1"; shift
while [ $# -gt 0 ]; do
  case "$1" in
    --webp)         DO_WEBP=1; shift ;;
    --avif)         DO_AVIF=1; shift ;;
    -q|--quality)   QUALITY="${2:-}"; shift 2 ;;
    --crf)          CRF="${2:-}"; shift 2 ;;
    --preset)       PRESET="${2:-}"; shift 2 ;;
    --from)         FROM="${2:-}"; shift 2 ;;
    --replace)      REPLACE=1; shift ;;
    --dry-run)      DRY=1; shift ;;
    -h|--help)      usage 0 ;;
    *)              die "unknown argument: $1 (try --help)" ;;
  esac
done

[ "$DO_WEBP" -eq 1 ] || [ "$DO_AVIF" -eq 1 ] || DO_WEBP=1

for pair in "quality:$QUALITY" "crf:$CRF" "preset:$PRESET"; do
  val="${pair#*:}"
  case "$val" in ''|*[!0-9]*) die "${pair%%:*} must be an integer, got '$val'" ;; esac
done
[ "$QUALITY" -le 100 ] || die "--quality must be 0-100"
[ "$CRF" -le 63 ]      || die "--crf must be 0-63 (lower is better quality)"
[ "$PRESET" -le 13 ]   || die "--preset must be 0-13"

[ -d "$DIR" ] || die "not a directory: $DIR"

# --- toolchain -------------------------------------------------------------

FFMPEG="${FFMPEG:-}"
[ -n "$FFMPEG" ] || FFMPEG="$(command -v ffmpeg || echo /opt/homebrew/bin/ffmpeg)"
[ -x "$FFMPEG" ] || die "ffmpeg not found (brew install ffmpeg)"

HAS_LIBWEBP=0
HAS_SVTAV1=0
"$FFMPEG" -hide_banner -encoders 2>/dev/null | grep -q '[[:space:]]libwebp[[:space:]]'  && HAS_LIBWEBP=1
"$FFMPEG" -hide_banner -encoders 2>/dev/null | grep -q '[[:space:]]libsvtav1[[:space:]]' && HAS_SVTAV1=1

if [ "$DO_WEBP" -eq 1 ] && [ "$HAS_LIBWEBP" -eq 0 ] && ! command -v cwebp >/dev/null 2>&1; then
  die "WebP requested but this ffmpeg lacks libwebp and cwebp is missing (brew install webp)"
fi
if [ "$DO_AVIF" -eq 1 ] && [ "$HAS_SVTAV1" -eq 0 ] && ! command -v avifenc >/dev/null 2>&1; then
  die "AVIF requested but this ffmpeg lacks libsvtav1 and avifenc is missing (brew install libavif)"
fi

fsize() { # portable stat
  if stat -f%z "$1" >/dev/null 2>&1; then stat -f%z "$1"; else stat -c%s "$1"; fi
}

human() { awk -v b="$1" 'BEGIN {
  split("B KB MB GB", u, " "); i = 1
  while (b >= 1024 && i < 4) { b /= 1024; i++ }
  printf (i == 1 ? "%d %s" : "%.1f %s"), b, u[i]
}'; }

total_of() { # total_of <ext>
  local ext="$1" sum=0 f
  for f in "$DIR"/frame_*."$ext"; do
    [ -f "$f" ] || continue
    sum=$(( sum + $(fsize "$f") ))
  done
  echo "$sum"
}

count_of() {
  local ext="$1" n=0 f
  for f in "$DIR"/frame_*."$ext"; do [ -f "$f" ] && n=$(( n + 1 )); done
  echo "$n"
}

# --- pick the source ------------------------------------------------------

SRC_EXT=""
if [ -n "$FROM" ]; then
  [ "$(count_of "$FROM")" -gt 0 ] || die "no frame_*.$FROM files in $DIR"
  SRC_EXT="$FROM"
else
  # PNG first: it is the only lossless option here, so converting from it
  # avoids stacking a second round of lossy artefacts on the first.
  for e in png webp jpg jpeg; do
    if [ "$(count_of "$e")" -gt 0 ]; then SRC_EXT="$e"; break; fi
  done
  [ -n "$SRC_EXT" ] || die "no frame_*.{png,webp,jpg} files in $DIR"
fi

SRC_N="$(count_of "$SRC_EXT")"
SRC_BYTES="$(total_of "$SRC_EXT")"

echo "optimise-frames"
printf '  source   %s: %s frame_*.%s, %s\n' "$DIR" "$SRC_N" "$SRC_EXT" "$(human "$SRC_BYTES")"
case "$SRC_EXT" in
  png) : ;;
  *)   echo "  note     source is already lossy — re-encoding compounds artefacts."
       echo "           Prefer keeping PNG masters and converting from those." ;;
esac
[ "$DRY" -eq 1 ] && echo "  mode     dry run, nothing will be written"

STAGE=""
if [ "$DRY" -eq 0 ]; then
  STAGE="$(mktemp -d "${TMPDIR:-/tmp}/veyra-opt.XXXXXX")"
  trap 'rm -rf "$STAGE"' EXIT
fi

# encode_all <target-ext> — writes into $STAGE, then swaps into $DIR
encode_all() {
  local ext="$1" f base out done_n=0 bytes=0 log

  if [ "$DRY" -eq 1 ]; then
    printf '  %-8s would write %s frame_*.%s\n' "$ext" "$SRC_N" "$ext"
    return 0
  fi

  log="$STAGE/$ext.log"
  for f in "$DIR"/frame_*."$SRC_EXT"; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    out="$STAGE/${base%.*}.$ext"
    case "$ext" in
      webp)
        if [ "$HAS_LIBWEBP" -eq 1 ]; then
          "$FFMPEG" -hide_banner -loglevel error -i "$f" -c:v libwebp -quality "$QUALITY" -y "$out" 2>"$log"
        else
          cwebp -quiet -mt -m 5 -q "$QUALITY" "$f" -o "$out" 2>"$log"
        fi
        ;;
      avif)
        # SVT-AV1 writes progress banners straight to stderr regardless of
        # -loglevel, so stderr is captured and only surfaced on failure.
        if [ "$HAS_SVTAV1" -eq 1 ]; then
          "$FFMPEG" -hide_banner -loglevel error -i "$f" \
            -c:v libsvtav1 -crf "$CRF" -preset "$PRESET" -pix_fmt yuv420p \
            -f avif -y "$out" 2>"$log"
        else
          avifenc --min 0 --max 63 -q "$(( 100 - CRF * 100 / 63 ))" "$f" "$out" >"$log" 2>&1
        fi
        ;;
    esac || { echo "--- encoder output ---" >&2; cat "$log" >&2; die "failed encoding $base to $ext"; }
    done_n=$(( done_n + 1 ))
    bytes=$(( bytes + $(fsize "$out") ))
  done

  [ "$done_n" -eq "$SRC_N" ] || die "$ext: expected $SRC_N frames, produced $done_n"

  rm -f "$DIR"/frame_*."$ext"
  for f in "$STAGE"/frame_*."$ext"; do mv "$f" "$DIR/"; done

  awk -v e="$ext" -v n="$done_n" -v b="$bytes" -v s="$SRC_BYTES" 'BEGIN {
    split("B KB MB GB", u, " ")
    hb = b; i = 1; while (hb >= 1024 && i < 4) { hb /= 1024; i++ }
    delta = (s > 0) ? (b - s) * 100.0 / s : 0
    printf "  %-8s %d frames, %s%s%s  (%+.1f%% vs source)\n", e, n,
      (i == 1 ? sprintf("%d", hb) : sprintf("%.1f", hb)), " ", u[i], delta
  }'
}

[ "$DO_WEBP" -eq 1 ] && encode_all webp
[ "$DO_AVIF" -eq 1 ] && encode_all avif

if [ "$DRY" -eq 0 ] && [ "$DO_WEBP" -eq 1 ] && [ "$DO_AVIF" -eq 1 ]; then
  awk -v w="$(total_of webp)" -v a="$(total_of avif)" 'BEGIN {
    if (w > 0) printf "  compare  avif is %.1f%% smaller than webp on this sequence\n", (w - a) * 100.0 / w
  }'
fi

if [ "$REPLACE" -eq 1 ] && [ "$DRY" -eq 0 ]; then
  keep=0
  [ "$SRC_EXT" = webp ] && [ "$DO_WEBP" -eq 1 ] && keep=1
  [ "$SRC_EXT" = avif ] && [ "$DO_AVIF" -eq 1 ] && keep=1
  if [ "$keep" -eq 1 ]; then
    echo "  replace  skipped: the source extension is also an output"
  else
    rm -f "$DIR"/frame_*."$SRC_EXT"
    printf '  replace  removed %s frame_*.%s (%s reclaimed)\n' "$SRC_N" "$SRC_EXT" "$(human "$SRC_BYTES")"
  fi
fi

if [ "$DRY" -eq 0 ]; then
  echo "  total    $(human "$(( $(total_of webp) + $(total_of avif) ))") of deliverable frames in $DIR"
fi
