#!/usr/bin/env bash
#
# video-to-frames.sh — turn a video into a scroll-scrub frame sequence.
#
#   ./scripts/video-to-frames.sh <input.mp4> <output-dir> [count]
#
#   ./scripts/video-to-frames.sh renders/crane.mp4 public/frames/crane
#   ./scripts/video-to-frames.sh "~/My Renders/truck take 3.mov" public/frames/truck 170
#
# Options (after the positional arguments):
#   -q, --quality N   WebP quality 0-100 (default 82)
#   -s, --size WxH    output size (default 1566x880)
#       --pad         letterbox instead of centre-cropping
#       --keep-png    keep the intermediate PNGs next to the WebPs
#
# Writes exactly <count> frames (default 170) named frame_000.webp ..
# frame_<count-1>.webp, which is what <FrameSequence> expects.
#
# "Evenly spaced" is done properly: the script probes the real frame count,
# buckets it into <count> even buckets and keeps the first frame of each, so
# the result is exactly <count> frames every time. The obvious alternative,
# -vf fps=N, resamples against wall-clock time and will hand you 168 or 171
# depending on rounding — and a sequence whose length disagrees with the
# `count` prop shows up as a frozen or truncated scrub, which is a miserable
# thing to debug later.

set -euo pipefail

WIDTH=1566
HEIGHT=880
COUNT=170
QUALITY=82
MODE=crop
KEEP_PNG=0

usage() {
  awk 'NR > 1 { if (!/^#/ || /^# ?-{10,}/) exit; sub(/^# ?/, ""); print }' "$0"
  exit "${1:-0}"
}

die() { echo "video-to-frames: $*" >&2; exit 1; }

# --- arguments -------------------------------------------------------------

[ $# -ge 1 ] || usage 2
case "$1" in -h|--help) usage 0 ;; esac
[ $# -ge 2 ] || die "need <input.mp4> and <output-dir> (try --help)"

INPUT="$1"; shift
OUTDIR="$1"; shift

if [ $# -gt 0 ]; then
  case "$1" in
    -*) : ;;
    *)  COUNT="$1"; shift ;;
  esac
fi

while [ $# -gt 0 ]; do
  case "$1" in
    -q|--quality) QUALITY="${2:-}"; shift 2 ;;
    -s|--size)
      case "${2:-}" in
        [0-9]*x[0-9]*) WIDTH="${2%%x*}"; HEIGHT="${2##*x}" ;;
        *) die "--size expects WxH, e.g. 1566x880" ;;
      esac
      shift 2 ;;
    --pad)      MODE=pad; shift ;;
    --keep-png) KEEP_PNG=1; shift ;;
    -h|--help)  usage 0 ;;
    *)          die "unknown argument: $1 (try --help)" ;;
  esac
done

for pair in "count:$COUNT" "quality:$QUALITY" "width:$WIDTH" "height:$HEIGHT"; do
  val="${pair#*:}"
  case "$val" in ''|*[!0-9]*) die "${pair%%:*} must be a positive integer, got '$val'" ;; esac
done
[ "$COUNT" -ge 2 ]     || die "count must be at least 2"
[ "$QUALITY" -le 100 ] || die "quality must be 0-100"
[ "$WIDTH" -ge 1 ] && [ "$HEIGHT" -ge 1 ] || die "size must be positive"

[ -e "$INPUT" ] || die "input not found: $INPUT"
[ -f "$INPUT" ] || die "input is not a regular file: $INPUT"
[ -r "$INPUT" ] || die "input is not readable: $INPUT"

case "$OUTDIR" in
  "") die "output directory must not be empty" ;;
  /*|./*|../*|*) : ;;
esac

# --- toolchain -------------------------------------------------------------

FFMPEG="${FFMPEG:-}"
FFPROBE="${FFPROBE:-}"
[ -n "$FFMPEG" ]  || FFMPEG="$(command -v ffmpeg  || echo /opt/homebrew/bin/ffmpeg)"
[ -n "$FFPROBE" ] || FFPROBE="$(command -v ffprobe || echo /opt/homebrew/bin/ffprobe)"
[ -x "$FFMPEG" ]  || die "ffmpeg not found (brew install ffmpeg)"
[ -x "$FFPROBE" ] || die "ffprobe not found (brew install ffmpeg)"

if "$FFMPEG" -hide_banner -encoders 2>/dev/null | grep -q '[[:space:]]libwebp[[:space:]]'; then
  WEBP_VIA=ffmpeg
elif command -v cwebp >/dev/null 2>&1; then
  WEBP_VIA=cwebp
else
  die "no WebP encoder: this ffmpeg lacks libwebp and cwebp is missing (brew install webp)"
fi

# --- probe -----------------------------------------------------------------

# The trailing `|| true` matters: under `set -o pipefail` a failed ffprobe (a
# file that isn't a video at all) would take the whole script down through
# `set -e` at the assignment, before we ever get to print a useful message.
probe() {
  "$FFPROBE" -v error -select_streams v:0 -show_entries "$1" -of default=nw=1:nk=1 "$INPUT" 2>/dev/null | head -1 || true
}

SRC_W="$(probe stream=width)"
SRC_H="$(probe stream=height)"
[ -n "$SRC_W" ] || die "no video stream found in: $INPUT"

TOTAL="$(probe stream=nb_frames)"
case "$TOTAL" in
  ''|N/A|0)
    # Containers like MKV and many MOVs do not store nb_frames. Derive it from
    # duration * average frame rate, and only fall back to a full decode pass
    # (which is slow on long sources) if that is unavailable too.
    DUR="$(probe format=duration)"
    [ -n "$DUR" ] && [ "$DUR" != "N/A" ] || DUR="$("$FFPROBE" -v error -show_entries format=duration -of default=nw=1:nk=1 "$INPUT" 2>/dev/null | head -1 || true)"
    RATE="$(probe stream=avg_frame_rate)"
    TOTAL="$(awk -v d="${DUR:-0}" -v r="${RATE:-0/0}" 'BEGIN {
      split(r, f, "/"); den = (f[2] == "" || f[2] + 0 == 0) ? 0 : f[2]
      if (den == 0 || d + 0 <= 0) { print ""; exit }
      printf "%d", d * (f[1] / den)
    }')"
    ;;
esac
case "$TOTAL" in
  ''|N/A|0)
    echo "  (probing frame count the slow way — decoding the whole file)" >&2
    TOTAL="$("$FFPROBE" -v error -select_streams v:0 -count_frames \
             -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$INPUT" 2>/dev/null | head -1 || true)"
    ;;
esac
case "$TOTAL" in ''|N/A|*[!0-9]*) die "could not determine the frame count of: $INPUT" ;; esac

[ "$TOTAL" -ge "$COUNT" ] || die "source has $TOTAL frames but $COUNT were requested.
Either render a longer source or pass a smaller count:
  $0 \"$INPUT\" \"$OUTDIR\" $TOTAL"

# --- scale filter ----------------------------------------------------------

# Cover-crop by default: the sequence is a full-bleed hero, so letterbox bars
# would be visible. --pad is there for the case where the subject must not be
# cropped at all.
if [ "$MODE" = pad ]; then
  SCALE="scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black"
else
  SCALE="scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT}"
fi

# --- select exactly COUNT evenly-spaced source frames ----------------------

# Bucket the TOTAL source frames into COUNT even buckets and keep the first
# frame of each: frame n survives when floor(n*C/T) steps past floor((n-1)*C/T).
# Because floor(n*C/T) takes every value in 0..C-1 exactly once as a first
# occurrence, this yields exactly COUNT frames whenever TOTAL >= COUNT. At n=0
# the second term is floor(-C/T) = -1, so the first frame is always kept.
#
# The naive alternative — one eq(n,idx) term per frame OR'd together — is
# exact too, but 170 terms overflow ffmpeg's expression parser and it fails
# with a misleading "Cannot allocate memory".
SELECT="gt(floor(n*${COUNT}/${TOTAL})\\,floor((n-1)*${COUNT}/${TOTAL}))"

mkdir -p "$OUTDIR" || die "could not create output directory: $OUTDIR"
STAGE="$OUTDIR"
[ "$KEEP_PNG" -eq 1 ] || {
  STAGE="$(mktemp -d "${TMPDIR:-/tmp}/veyra-v2f.XXXXXX")"
  trap 'rm -rf "$STAGE"' EXIT
}

rm -f "$OUTDIR"/frame_*.webp

echo "video-to-frames"
printf '  source   %s (%sx%s, %s frames)\n' "$INPUT" "$SRC_W" "$SRC_H" "$TOTAL"
printf '  output   %s\n' "$OUTDIR"
printf '  target   %s frames at %sx%s (%s), webp q=%s via %s\n' \
  "$COUNT" "$WIDTH" "$HEIGHT" "$MODE" "$QUALITY" "$WEBP_VIA"

# select goes first so scaling only runs on the frames we keep.
# fps_mode=passthrough stops ffmpeg re-timing the sparse output back up to the
# source rate, which would duplicate frames and blow past COUNT.
"$FFMPEG" -hide_banner -loglevel error -i "$INPUT" \
  -vf "select='${SELECT}',${SCALE}" \
  -fps_mode passthrough -frames:v "$COUNT" -start_number 0 \
  -y "$STAGE/frame_%03d.png" || die "ffmpeg failed to extract frames"

i=0
while [ "$i" -lt "$COUNT" ]; do
  src="$(printf '%s/frame_%03d.png' "$STAGE" "$i")"
  dst="$(printf '%s/frame_%03d.webp' "$OUTDIR" "$i")"
  [ -f "$src" ] || die "expected $src but ffmpeg did not produce it"
  if [ "$WEBP_VIA" = ffmpeg ]; then
    "$FFMPEG" -hide_banner -loglevel error -i "$src" -c:v libwebp -quality "$QUALITY" -y "$dst"
  else
    cwebp -quiet -mt -m 5 -q "$QUALITY" "$src" -o "$dst"
  fi
  i=$((i + 1))
done

MADE="$(ls "$OUTDIR" | grep -c '^frame_.*\.webp$' || true)"
[ "$MADE" -eq "$COUNT" ] || die "expected $COUNT frames, wrote $MADE"

printf '  done     %s frames, %s total\n' "$MADE" "$(du -sh "$OUTDIR" | cut -f1 | tr -d ' ')"
printf '  next     ./scripts/optimise-frames.sh "%s" --avif\n' "$OUTDIR"
