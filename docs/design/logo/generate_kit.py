#!/usr/bin/env python3
"""Generate the complete production logo kit for Yonru (Direction B: The Focal Frame)."""
import os
import subprocess
import sys

BASE_DIR = "docs/design/logo"
DIST_DIR = os.path.join(BASE_DIR, "dist")
os.makedirs(BASE_DIR, exist_ok=True)
os.makedirs(DIST_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# 1. Master Symbols
# -----------------------------------------------------------------------------

# Light Mode / Full Color Symbol (for white or light grey backgrounds)
# Brackets: #09090B, Center Clip: #ffd700
symbol_color_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-yonru-light">
  <title id="title-yonru-light">Yonru Logo Symbol (Color on Light)</title>
  <!-- In-point bracket [ -->
  <path fill="none" stroke="#09090B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 94 56
    H 56
    V 200
    H 94
  "/>
  <!-- Out-point bracket ] -->
  <path fill="none" stroke="#09090B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 162 56
    H 200
    V 200
    H 162
  "/>
  <!-- Center focal clip capsule (The captured moment) -->
  <rect x="114" y="68" width="28" height="120" rx="14" fill="#ffd700"/>
</svg>"""

# Dark Mode / Full Color Symbol (for #09090B or dark surface backgrounds)
# Brackets: #FFFFFF, Center Clip: #ffd700
symbol_color_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-yonru-dark">
  <title id="title-yonru-dark">Yonru Logo Symbol (Color on Dark)</title>
  <!-- In-point bracket [ -->
  <path fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 94 56
    H 56
    V 200
    H 94
  "/>
  <!-- Out-point bracket ] -->
  <path fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 162 56
    H 200
    V 200
    H 162
  "/>
  <!-- Center focal clip capsule -->
  <rect x="114" y="68" width="28" height="120" rx="14" fill="#ffd700"/>
</svg>"""

# Solid Black Symbol
symbol_black = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-yonru-black">
  <title id="title-yonru-black">Yonru Logo Symbol (Black)</title>
  <path fill="none" stroke="#09090B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 94 56
    H 56
    V 200
    H 94
  "/>
  <path fill="none" stroke="#09090B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 162 56
    H 200
    V 200
    H 162
  "/>
  <rect x="114" y="68" width="28" height="120" rx="14" fill="#09090B"/>
</svg>"""

# Solid White Symbol (Reversed)
symbol_white = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-yonru-white">
  <title id="title-yonru-white">Yonru Logo Symbol (White)</title>
  <path fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 94 56
    H 56
    V 200
    H 94
  "/>
  <path fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 162 56
    H 200
    V 200
    H 162
  "/>
  <rect x="114" y="68" width="28" height="120" rx="14" fill="#FFFFFF"/>
</svg>"""

# Brand Mono Gold Symbol
symbol_mono_gold = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-yonru-gold">
  <title id="title-yonru-gold">Yonru Logo Symbol (Gold)</title>
  <path fill="none" stroke="#ffd700" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 94 56
    H 56
    V 200
    H 94
  "/>
  <path fill="none" stroke="#ffd700" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 162 56
    H 200
    V 200
    H 162
  "/>
  <rect x="114" y="68" width="28" height="120" rx="14" fill="#ffd700"/>
</svg>"""

# Small-Size Cut (for 16px/32px favicons): slightly sturdier strokes and wider gaps for optical clarity
symbol_small = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-yonru-small">
  <title id="title-yonru-small">Yonru Logo Symbol (Small Cut)</title>
  <path fill="none" stroke="#FFFFFF" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" d="
    M 92 52
    H 52
    V 204
    H 92
  "/>
  <path fill="none" stroke="#FFFFFF" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" d="
    M 164 52
    H 204
    V 204
    H 164
  "/>
  <rect x="112" y="66" width="32" height="124" rx="16" fill="#ffd700"/>
</svg>"""

# App Icon Master (Symbol centered on rounded square dark tile)
app_icon_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-yonru-app-icon">
  <title id="title-yonru-app-icon">Yonru App Icon</title>
  <!-- Dark tile background #09090B with 22.5% squircle corner radius -->
  <rect width="256" height="256" rx="58" fill="#09090B"/>
  <!-- Centered full color mark scaled to 64% -->
  <g transform="translate(46, 46) scale(0.64)">
    <path fill="none" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" d="
      M 94 56
      H 56
      V 200
      H 94
    "/>
    <path fill="none" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" d="
      M 162 56
      H 200
      V 200
      H 162
    "/>
    <rect x="114" y="68" width="28" height="120" rx="14" fill="#ffd700"/>
  </g>
</svg>"""

# -----------------------------------------------------------------------------
# 2. Lockups (Horizontal & Stacked)
# -----------------------------------------------------------------------------

# Horizontal Lockup Light (880 x 256)
horizontal_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="title-h-light">
  <title id="title-h-light">Yonru Horizontal Logo (Light)</title>
  <g transform="translate(48, 48) scale(0.625)">
    <path fill="none" stroke="#09090B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
      M 94 56
      H 56
      V 200
      H 94
    "/>
    <path fill="none" stroke="#09090B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
      M 162 56
      H 200
      V 200
      H 162
    "/>
    <rect x="114" y="68" width="28" height="120" rx="14" fill="#ffd700"/>
  </g>
  <text x="236" y="162" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="700" letter-spacing="-2" fill="#09090B">Yonru</text>
  <text x="554" y="162" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="400" fill="#ffd700">.</text>
</svg>"""

# Horizontal Lockup Dark (880 x 256)
horizontal_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="title-h-dark">
  <title id="title-h-dark">Yonru Horizontal Logo (Dark)</title>
  <g transform="translate(48, 48) scale(0.625)">
    <path fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
      M 94 56
      H 56
      V 200
      H 94
    "/>
    <path fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
      M 162 56
      H 200
      V 200
      H 162
    "/>
    <rect x="114" y="68" width="28" height="120" rx="14" fill="#ffd700"/>
  </g>
  <text x="236" y="162" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="700" letter-spacing="-2" fill="#FFFFFF">Yonru</text>
  <text x="554" y="162" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="400" fill="#ffd700">.</text>
</svg>"""

# Stacked Lockup Light (400 x 360)
stacked_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 360" width="400" height="360" role="img" aria-labelledby="title-s-light">
  <title id="title-s-light">Yonru Stacked Logo (Light)</title>
  <g transform="translate(112, 32) scale(0.6875)">
    <path fill="none" stroke="#09090B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
      M 94 56
      H 56
      V 200
      H 94
    "/>
    <path fill="none" stroke="#09090B" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
      M 162 56
      H 200
      V 200
      H 162
    "/>
    <rect x="114" y="68" width="28" height="120" rx="14" fill="#ffd700"/>
  </g>
  <text x="200" y="284" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="82" font-weight="700" letter-spacing="-2" fill="#09090B" text-anchor="middle">Yonru<tspan fill="#ffd700">.</tspan></text>
</svg>"""

# Stacked Lockup Dark (400 x 360)
stacked_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 360" width="400" height="360" role="img" aria-labelledby="title-s-dark">
  <title id="title-s-dark">Yonru Stacked Logo (Dark)</title>
  <g transform="translate(112, 32) scale(0.6875)">
    <path fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
      M 94 56
      H 56
      V 200
      H 94
    "/>
    <path fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
      M 162 56
      H 200
      V 200
      H 162
    "/>
    <rect x="114" y="68" width="28" height="120" rx="14" fill="#ffd700"/>
  </g>
  <text x="200" y="284" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="82" font-weight="700" letter-spacing="-2" fill="#FFFFFF" text-anchor="middle">Yonru<tspan fill="#ffd700">.</tspan></text>
</svg>"""

# Wordmark Only (Light & Dark)
wordmark_light = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 140" width="420" height="140" role="img" aria-labelledby="title-w-light">
  <title id="title-w-light">Yonru Wordmark (Light)</title>
  <text x="20" y="104" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="700" letter-spacing="-2" fill="#09090B">Yonru<tspan fill="#ffd700">.</tspan></text>
</svg>"""

wordmark_dark = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 140" width="420" height="140" role="img" aria-labelledby="title-w-dark">
  <title id="title-w-dark">Yonru Wordmark (Dark)</title>
  <text x="20" y="104" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="700" letter-spacing="-2" fill="#FFFFFF">Yonru<tspan fill="#ffd700">.</tspan></text>
</svg>"""

# Save all files to BASE_DIR
files = {
    "yonru-symbol-color.svg": symbol_color_light,
    "yonru-symbol-color-dark.svg": symbol_color_dark,
    "yonru-symbol-black.svg": symbol_black,
    "yonru-symbol-white.svg": symbol_white,
    "yonru-symbol-mono-gold.svg": symbol_mono_gold,
    "yonru-symbol-small.svg": symbol_small,
    "yonru-app-icon.svg": app_icon_svg,
    "yonru-horizontal.svg": horizontal_light,
    "yonru-horizontal-dark.svg": horizontal_dark,
    "yonru-stacked.svg": stacked_light,
    "yonru-stacked-dark.svg": stacked_dark,
    "yonru-wordmark.svg": wordmark_light,
    "yonru-wordmark-dark.svg": wordmark_dark,
}

for name, content in files.items():
    p = os.path.join(BASE_DIR, name)
    with open(p, "w") as f:
        f.write(content)
    print(f"Wrote {p}")

print("Master SVG generation complete.")
