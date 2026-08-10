#!/usr/bin/env bash
#
# make-placeholder-frames.sh — generate stand-in scroll-scrub frame sequences.
#
# The <FrameSequence> components expect 170 stills per sequence at
# public/frames/<name>/frame_000.webp .. frame_169.webp. Until the real render
# exists (see ASSETS.md), this script synthesises them from ffmpeg's built-in
# lavfi sources — no downloads, no image libraries, no 3D pipeline.
#
# The output is deliberately synthetic and deliberately animated: a moving rig,
# a scrubbing progress bar and a live frame readout, so you can tell at a glance
# whether ScrollTrigger is mapping scroll distance onto frame index correctly.
# Every frame is stamped PLACEHOLDER.
#
#   ./scripts/make-placeholder-frames.sh                # both sequences, 170 frames
#   ./scripts/make-placeholder-frames.sh --only crane   # one sequence
#   ./scripts/make-placeholder-frames.sh -c 60 -q 70    # fewer frames, lower quality
#
# Written for bash 3.2 (what macOS ships as /bin/bash) — no associative arrays.

set -euo pipefail

# ---------------------------------------------------------------------------
# config
# ---------------------------------------------------------------------------

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_ROOT="$ROOT/public/frames"

WIDTH=1566
HEIGHT=880
COUNT=170
QUALITY=80
ONLY=""

# Brand tokens, mirrored from app/globals.css so the placeholders don't look
# alien next to the real design.
C_NIGHT="0x0a0a0b"
C_SIGNAL="0xff4d2e"
C_SIGNAL_HI="0xff7a5e"
C_SIGNAL_LO="0xc93a20"
C_MIST="0xe8e8e6"
C_STEEL="0x2a2a31"
C_STEEL_HI="0x3d3d47"
C_DIM="0x7c7c86"
C_SHADOW="0x1a1a1f"

while [ $# -gt 0 ]; do
  case "$1" in
    -c|--count)   COUNT="${2:-}"; shift 2 ;;
    -q|--quality) QUALITY="${2:-}"; shift 2 ;;
    -w|--width)   WIDTH="${2:-}"; shift 2 ;;
    -h|--height)  HEIGHT="${2:-}"; shift 2 ;;
    --only)       ONLY="${2:-}"; shift 2 ;;
    --help)       awk 'NR > 1 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "$0"; exit 0 ;;
    *)            echo "unknown argument: $1 (try --help)" >&2; exit 2 ;;
  esac
done

for pair in "COUNT:$COUNT" "QUALITY:$QUALITY" "WIDTH:$WIDTH" "HEIGHT:$HEIGHT"; do
  val="${pair#*:}"
  case "$val" in ''|*[!0-9]*) echo "${pair%%:*} must be a positive integer" >&2; exit 2 ;; esac
done
[ "$COUNT" -ge 2 ] || { echo "--count must be at least 2" >&2; exit 2; }
LAST=$((COUNT - 1))

# ---------------------------------------------------------------------------
# toolchain
# ---------------------------------------------------------------------------

FFMPEG="${FFMPEG:-}"
if [ -z "$FFMPEG" ]; then
  if command -v ffmpeg >/dev/null 2>&1; then FFMPEG="$(command -v ffmpeg)"
  elif [ -x /opt/homebrew/bin/ffmpeg ]; then FFMPEG=/opt/homebrew/bin/ffmpeg
  else echo "ffmpeg not found. brew install ffmpeg" >&2; exit 1; fi
fi

# Homebrew's ffmpeg is not built with libwebp, so WebP encoding is delegated to
# cwebp (from the `webp` formula). Use ffmpeg directly where it can.
if "$FFMPEG" -hide_banner -encoders 2>/dev/null | grep -q '[[:space:]]libwebp[[:space:]]'; then
  WEBP_VIA="ffmpeg"
elif command -v cwebp >/dev/null 2>&1; then
  WEBP_VIA="cwebp"
else
  echo "No WebP encoder: this ffmpeg lacks libwebp and cwebp is not installed." >&2
  echo "Fix with:  brew install webp" >&2
  exit 1
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/veyra-frames.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

ff() { "$FFMPEG" -hide_banner -loglevel error "$@"; }

# ---------------------------------------------------------------------------
# 5x7 pixel font
#
# This ffmpeg is built without freetype, so drawtext does not exist. Instead we
# render text ourselves into an ASCII PGM (P2) — which ffmpeg's pnm decoder
# reads happily — then scale it nearest-neighbour and use it as an alpha mask
# over a flat colour. Crisp, blocky, obviously synthetic.
# ---------------------------------------------------------------------------

glyph() {
  case "$1" in
    A) echo ".###.|#...#|#...#|#####|#...#|#...#|#...#" ;;
    B) echo "####.|#...#|#...#|####.|#...#|#...#|####." ;;
    C) echo ".####|#....|#....|#....|#....|#....|.####" ;;
    D) echo "####.|#...#|#...#|#...#|#...#|#...#|####." ;;
    E) echo "#####|#....|#....|####.|#....|#....|#####" ;;
    F) echo "#####|#....|#....|####.|#....|#....|#...." ;;
    G) echo ".####|#....|#....|#..##|#...#|#...#|.####" ;;
    H) echo "#...#|#...#|#...#|#####|#...#|#...#|#...#" ;;
    I) echo "#####|..#..|..#..|..#..|..#..|..#..|#####" ;;
    J) echo "####.|...#.|...#.|...#.|...#.|#..#.|.##.." ;;
    K) echo "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#" ;;
    L) echo "#....|#....|#....|#....|#....|#....|#####" ;;
    M) echo "#...#|##.##|#.#.#|#...#|#...#|#...#|#...#" ;;
    N) echo "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#" ;;
    O) echo ".###.|#...#|#...#|#...#|#...#|#...#|.###." ;;
    P) echo "####.|#...#|#...#|####.|#....|#....|#...." ;;
    Q) echo ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#" ;;
    R) echo "####.|#...#|#...#|####.|#.#..|#..#.|#...#" ;;
    S) echo ".####|#....|#....|.###.|....#|....#|####." ;;
    T) echo "#####|..#..|..#..|..#..|..#..|..#..|..#.." ;;
    U) echo "#...#|#...#|#...#|#...#|#...#|#...#|.###." ;;
    V) echo "#...#|#...#|#...#|#...#|#...#|.#.#.|..#.." ;;
    W) echo "#...#|#...#|#...#|#...#|#.#.#|##.##|#...#" ;;
    X) echo "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#" ;;
    Y) echo "#...#|#...#|.#.#.|..#..|..#..|..#..|..#.." ;;
    Z) echo "#####|....#|...#.|..#..|.#...|#....|#####" ;;
    0) echo ".###.|#...#|#..##|#.#.#|##..#|#...#|.###." ;;
    1) echo "..#..|.##..|..#..|..#..|..#..|..#..|#####" ;;
    2) echo ".###.|#...#|....#|...#.|..#..|.#...|#####" ;;
    3) echo "####.|....#|....#|.###.|....#|....#|####." ;;
    4) echo "...#.|..##.|.#.#.|#..#.|#####|...#.|...#." ;;
    5) echo "#####|#....|####.|....#|....#|#...#|.###." ;;
    6) echo ".###.|#....|#....|####.|#...#|#...#|.###." ;;
    7) echo "#####|....#|...#.|..#..|.#...|.#...|.#..." ;;
    8) echo ".###.|#...#|#...#|.###.|#...#|#...#|.###." ;;
    9) echo ".###.|#...#|#...#|.####|....#|....#|.###." ;;
    -) echo ".....|.....|.....|#####|.....|.....|....." ;;
    .) echo ".....|.....|.....|.....|.....|.##..|.##.." ;;
    /) echo "....#|....#|...#.|..#..|.#...|#....|#...." ;;
    :) echo ".....|.##..|.##..|.....|.##..|.##..|....." ;;
    *) echo ".....|.....|.....|.....|.....|.....|....." ;;
  esac
}

# text_pgm <TEXT> <outfile> — one blank column between glyphs, so each
# character occupies 6px: the strip is 6*len wide and 7 tall.
text_pgm() {
  local text="$1" out="$2"
  local n=${#text} i r ch
  local rows
  rows=( "" "" "" "" "" "" "" )
  for (( i = 0; i < n; i++ )); do
    ch="${text:$i:1}"
    local gr
    gr=( $(glyph "$ch" | tr '|' ' ') )
    for (( r = 0; r < 7; r++ )); do
      rows[$r]="${rows[$r]}${gr[$r]}."
    done
  done
  {
    printf 'P2\n%d %d\n255\n' $(( n * 6 )) 7
    for (( r = 0; r < 7; r++ )); do
      printf '%s\n' "${rows[$r]}" | sed 's/\./0 /g; s/#/255 /g'
    done
  } > "$out"
}

# text_chain <TEXT> <input-index> <scale> <colour> <x> <y> <in-label> <out-label>
# Emits the filter_complex fragment that paints a text strip over a chain.
text_chain() {
  local text="$1" idx="$2" scale="$3" col="$4" x="$5" y="$6" src="$7" dst="$8"
  local tw=$(( ${#text} * 6 * scale )) th=$(( 7 * scale ))
  printf '[%s:v]scale=%d:%d:flags=neighbor,format=gray[m%s];color=c=%s:s=%dx%d[c%s];[c%s][m%s]alphamerge[t%s];[%s][t%s]overlay=x=%d:y=%d[%s]' \
    "$idx" "$tw" "$th" "$idx" "$col" "$tw" "$th" "$idx" "$idx" "$idx" "$idx" "$src" "$idx" "$x" "$y" "$dst"
}

# ---------------------------------------------------------------------------
# drawing helpers
#
# Every frame is rendered by its own ffmpeg invocation with literal integer
# coordinates. That is deliberate: drawbox in this build has no eval=frame, and
# overlay's `n`/`t` are driven by framesync, which advances them once per input
# frame consumed rather than once per output frame — so expression-driven
# motion silently comes out at the wrong index. Computing geometry in the shell
# sidesteps both problems and costs about 0.14s per frame.
# ---------------------------------------------------------------------------

box() { # box <x> <y> <w> <h> <colour>
  [ "$3" -gt 0 ] && [ "$4" -gt 0 ] || return 0
  printf 'drawbox=x=%s:y=%s:w=%s:h=%s:color=%s@1.0:thickness=fill' "$1" "$2" "$3" "$4" "$5"
}

add() { # add <filter>  — append to the current comma-separated chain
  [ -n "$1" ] || return 0
  CHAIN="${CHAIN}${CHAIN:+,}$1"
}

# sprite <out> <w> <h> <chain> — transparent canvas + drawboxes.
# Two traps here, both of which silently yield a solid black rectangle:
#   * format=rgba must live inside the lavfi input string. As a separate -vf it
#     runs after the color source has already negotiated an alpha-less format,
#     so the transparency is gone and rgba just re-adds alpha 255.
#   * drawbox needs replace=1, or it alpha-blends onto a transparent canvas and
#     every drawn pixel lands with alpha 0.
sprite() {
  local out="$1" w="$2" h="$3" chain="$4"
  chain="$(printf '%s' "$chain" | sed 's/thickness=fill/thickness=fill:replace=1/g')"
  ff -f lavfi -i "color=c=0x000000@0.0:s=${w}x${h}:r=1,format=rgba" \
     ${chain:+-vf "$chain"} -frames:v 1 -y "$out"
}

GROUND=$(( HEIGHT - 108 ))
ROAD=$(( GROUND - 88 ))
BAR_Y=$(( HEIGHT - 20 ))
LABEL_Y=$(( HEIGHT - 68 ))
NOTE="NOT FINAL ART - REGENERATE WITH SCRIPTS/VIDEO-TO-FRAMES.SH"

# ---------------------------------------------------------------------------
# static base layer — everything that does not move, rendered once per sequence
# ---------------------------------------------------------------------------

build_base() { # build_base <SEQUENCE NAME> <extra-chain>
  local name="$1" extra="${2:-}"
  local title="VEYRA PLACEHOLDER SEQUENCE"
  local sub="$name ${WIDTH}X${HEIGHT} ${COUNT} FRAMES"

  CHAIN="format=rgba,drawgrid=w=87:h=88:t=1:c=0xffffff@0.05"
  [ -n "$extra" ] && add "$extra"
  add "$(box 0 "$BAR_Y" "$WIDTH" 10 0x1e1e22)"

  text_pgm "$title" "$TMP/t1.pgm"
  text_pgm "$sub"   "$TMP/t2.pgm"
  text_pgm "$NOTE"  "$TMP/t3.pgm"

  # Diagonal hazard stripes need a per-pixel expression, so this is the one
  # element that has to be geq rather than drawbox.
  ff -f lavfi -i "color=c=black:s=${WIDTH}x16:r=1,format=rgba" \
     -vf "geq=r='if(lt(mod(X+Y\,48)\,24)\,255\,26)':g='if(lt(mod(X+Y\,48)\,24)\,77\,26)':b='if(lt(mod(X+Y\,48)\,24)\,46\,26)':a='255'" \
     -frames:v 1 -y "$TMP/hazard.png"

  local fc="[0:v]${CHAIN}[bg];[bg][1:v]overlay=x=0:y=0[h]"
  fc="$fc;$(text_chain "$title" 2 4 "$C_MIST"   40 48 h a)"
  fc="$fc;$(text_chain "$sub"   3 3 "$C_SIGNAL" 40 92 a b)"
  fc="$fc;$(text_chain "$NOTE"  4 3 "$C_DIM"    40 "$LABEL_Y" b out)"

  ff -f lavfi -i "color=c=${C_NIGHT}:s=${WIDTH}x${HEIGHT}:r=1" \
     -i "$TMP/hazard.png" -i "$TMP/t1.pgm" -i "$TMP/t2.pgm" -i "$TMP/t3.pgm" \
     -filter_complex "$fc" -map "[out]" -frames:v 1 -y "$TMP/base.png"
}

# ---------------------------------------------------------------------------
# scenes
# ---------------------------------------------------------------------------

# A container crane: the trolley sweeps the jib while the hoist lowers and
# lifts. Because the cable height is computed per frame it stops exactly at the
# rail — no masking tricks needed.
crane_base() {
  local f=""
  f="$f,$(box 0 $((GROUND + 3)) "$WIDTH" 105 0x0d0d10)"
  f="$f,$(box 0 "$GROUND" "$WIDTH" 3 "$C_STEEL_HI")"
  f="$f,$(box 300 250 28 $((GROUND - 250)) "$C_STEEL")"
  f="$f,$(box 1150 250 28 $((GROUND - 250)) "$C_STEEL")"
  f="$f,$(box 300 540 878 10 0x1c1c22)"
  f="$f,$(box 180 222 1240 30 0x24242a)"
  f="$f,$(box 180 252 1240 6 "$C_STEEL_HI")"
  build_base "CRANE" "${f#,}"
}

crane_geometry() {
  awk -v c="$COUNT" -v w="$WIDTH" 'BEGIN {
    pi = 3.14159265358979
    for (i = 0; i < c; i++) {
      p  = (c > 1) ? i / (c - 1) : 0
      tx = int(260 + 900 * (0.5 - 0.5 * cos(pi * p)))   # eased jib sweep
      hy = int(330 + 300 * sin(pi * p))                 # lower, then lift
      printf "%d %d %d %d\n", i, tx, hy, int(w * p)
    }
  }'
}

crane_frame() { # crane_frame <i> <trolley-x> <hoist-y> <bar-w>
  local tx="$2" hy="$3" bw="$4" rib
  CHAIN="format=rgba"
  add "$(box $((tx + 46)) 258 5 $((hy - 258)) "$C_STEEL_HI")"   # hoist cable
  add "$(box $((tx - 62)) "$hy" 220 110 "$C_SIGNAL")"           # container
  for rib in 26 60 94 128 162 196; do
    add "$(box $((tx - 62 + rib)) $((hy + 10)) 8 90 "$C_SIGNAL_LO")"
  done
  add "$(box $((tx - 62)) "$hy" 220 8 "$C_SIGNAL_HI")"
  add "$(box "$tx" 222 96 36 "$C_MIST")"                        # trolley
  add "$(box $((tx + 10)) 230 76 20 "$C_SHADOW")"
  add "$(box 0 "$BAR_Y" "$bw" 10 "$C_SIGNAL")"
  EXTRA_INPUTS=()
  EXTRA_FC=""
}

# A truck at constant speed: a linear ramp is the easiest motion to eyeball
# against scroll distance. Wheels come from 36 pre-rotated sprites.
truck_base() {
  local f="" x=0 hgt
  f="$f,$(box 0 "$ROAD" "$WIDTH" 88 0x121216)"
  f="$f,$(box 0 $((ROAD - 2)) "$WIDTH" 2 "$C_STEEL")"
  f="$f,$(box 0 "$GROUND" "$WIDTH" 3 "$C_STEEL_HI")"
  build_base "TRUCK" "${f#,}"

  sprite "$TMP/wheel_src.png" 88 88 \
    "$(box 9 37 70 14 "$C_DIM"),$(box 37 9 14 70 "$C_DIM"),$(box 30 30 28 28 "$C_MIST")"
  local a
  for a in $(seq 0 35); do
    ff -i "$TMP/wheel_src.png" \
       -vf "format=rgba,rotate=a=${a}*PI/18:c=none:ow=88:oh=88,format=rgba" \
       -frames:v 1 -y "$(printf '%s/wheel_%02d.png' "$TMP" "$a")"
  done
}

truck_geometry() {
  awk -v c="$COUNT" -v w="$WIDTH" 'BEGIN {
    # Travel is clipped at both ends so the truck is on screen for the whole
    # scrub — a sequence that starts or ends on an empty frame reads as broken.
    start = -260
    span  = (w - 630 - 36) - start
    for (i = 0; i < c; i++) {
      p  = (c > 1) ? i / (c - 1) : 0
      tx = int(start + span * p)
      wh = int(7 * 36 * p) % 36            # seven wheel revolutions
      sk = int(-40 - 260 * p)              # skyline parallax
      dh = -((i * 7) % 184)                # scrolling lane dashes
      printf "%d %d %d %d %d %d\n", i, tx, wh, sk, dh, int(w * p)
    }
  }'
}

truck_frame() { # truck_frame <i> <truck-x> <wheel-idx> <sky-x> <dash-x> <bar-w>
  local tx="$2" wi="$3" sk="$4" dh="$5" bw="$6"
  local ty=$(( GROUND - 320 ))
  local x hgt k

  CHAIN="format=rgba"

  # Heights are keyed to the building index, not to screen position, so the
  # skyline translates cleanly instead of morphing as the parallax shifts.
  k=0
  while :; do
    x=$(( sk + k * 134 ))
    [ "$x" -lt $(( WIDTH + 140 )) ] || break
    hgt=$(( 40 + (k * 53) % 120 ))
    add "$(box "$x" $(( ROAD - hgt )) 118 "$hgt" 0x16161c)"
    k=$(( k + 1 ))
  done

  x="$dh"
  while [ "$x" -lt "$WIDTH" ]; do
    add "$(box "$x" $(( ROAD + 46 )) 92 5 0x4a4a52)"
    x=$(( x + 184 ))
  done

  add "$(box "$tx" $((ty + 40)) 470 150 "$C_SIGNAL")"          # trailer
  add "$(box $((tx + 12)) $((ty + 52)) 446 24 "$C_SIGNAL_HI")"
  add "$(box $((tx + 480)) $((ty + 88)) 150 102 "$C_MIST")"    # cab
  add "$(box $((tx + 496)) $((ty + 100)) 104 46 "$C_SHADOW")"  # windscreen
  add "$(box "$tx" $((ty + 190)) 630 14 "$C_SHADOW")"          # chassis
  add "$(box 0 "$BAR_Y" "$bw" 10 "$C_SIGNAL")"

  EXTRA_INPUTS=( -i "$(printf '%s/wheel_%02d.png' "$TMP" "$wi")" )
  EXTRA_FC="[1:v]split=3[wa][wb][wc]"
  EXTRA_FC="$EXTRA_FC;[scene][wa]overlay=x=$((tx + 70)):y=$((ty + 184))[wo1]"
  EXTRA_FC="$EXTRA_FC;[wo1][wb]overlay=x=$((tx + 280)):y=$((ty + 184))[wo2]"
  EXTRA_FC="$EXTRA_FC;[wo2][wc]overlay=x=$((tx + 500)):y=$((ty + 184))[scene2]"
  SCENE_OUT="scene2"
}

# ---------------------------------------------------------------------------
# render loop
# ---------------------------------------------------------------------------

render() { # render <name>
  local name="$1"
  local outdir="$OUT_ROOT/$name"
  local png="$TMP/frame.png"
  local cnt="$TMP/counter.pgm"
  local counter_w=$(( 13 * 6 * 3 ))
  local counter_x=$(( WIDTH - 40 - counter_w ))

  mkdir -p "$outdir"
  rm -f "$outdir"/frame_*.webp "$outdir"/frame_*.avif

  printf '  %-6s building base layer...\n' "$name"
  "${name}_base"

  printf '  %-6s rendering %d frames at %dx%d...\n' "$name" "$COUNT" "$WIDTH" "$HEIGHT"
  # Geometry goes through a file rather than a pipe: a `while read` on the far
  # side of a pipeline runs in a subshell, where set -e failures would be
  # swallowed instead of aborting the run.
  "${name}_geometry" > "$TMP/geom.txt"

  local i rest label ci fc
  while read -r i rest; do
    SCENE_OUT="scene"
    EXTRA_INPUTS=()
    EXTRA_FC=""
    "${name}_frame" "$i" $rest

    label="$(printf 'FRAME %03d/%03d' "$i" "$LAST")"
    text_pgm "$label" "$cnt"
    ci=$(( ${#EXTRA_INPUTS[@]} / 2 + 1 ))

    fc="[0:v]${CHAIN}[scene]"
    [ -n "$EXTRA_FC" ] && fc="$fc;$EXTRA_FC"
    fc="$fc;$(text_chain "$label" "$ci" 3 "$C_MIST" "$counter_x" "$LABEL_Y" "$SCENE_OUT" out)"
    fc="$fc;[out]format=rgb24[final]"

    ff -i "$TMP/base.png" ${EXTRA_INPUTS[@]+"${EXTRA_INPUTS[@]}"} -i "$cnt" \
       -filter_complex "$fc" -map "[final]" -frames:v 1 -y "$png"

    if [ "$WEBP_VIA" = ffmpeg ]; then
      ff -i "$png" -c:v libwebp -quality "$QUALITY" -y "$(printf '%s/frame_%03d.webp' "$outdir" "$i")"
    else
      cwebp -quiet -mt -m 4 -q "$QUALITY" "$png" -o "$(printf '%s/frame_%03d.webp' "$outdir" "$i")"
    fi
  done < "$TMP/geom.txt"

  local made total
  made="$(ls "$outdir" | grep -c '^frame_.*\.webp$' || true)"
  [ "$made" -eq "$COUNT" ] || { echo "expected $COUNT frames in $outdir, got $made" >&2; exit 1; }
  total="$(du -sh "$outdir" | cut -f1 | tr -d ' ')"
  printf '  %-6s done -> %s (%s frames, %s)\n' "$name" "${outdir#$ROOT/}" "$made" "$total"
}

echo "veyra placeholder frames"
echo "  ffmpeg: $FFMPEG   webp: $WEBP_VIA"

case "$ONLY" in
  "")            render crane; render truck ;;
  crane|truck)   render "$ONLY" ;;
  *)             echo "--only takes 'crane' or 'truck'" >&2; exit 2 ;;
esac

echo
echo "These are placeholders. See ASSETS.md for how to produce the real sequences."
