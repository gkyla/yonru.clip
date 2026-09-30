#!/usr/bin/env python3
"""Build final refined SVG concepts and lockups for Yonru."""
import os

os.makedirs("docs/design/logo", exist_ok=True)

# -----------------------------------------------------------------------------
# Concept A: "The Segment Y" (The Timeline Constellation)
# Mark Type: Letterform
# -----------------------------------------------------------------------------
concept_a_symbol = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-a">
  <title id="title-a">Yonru — The Segment Y</title>
  <g transform="translate(128, 128)">
    <!-- Stem: vertical capsule -->
    <rect x="-19" y="16" width="38" height="90" rx="19" fill="#111111"/>
    <!-- Left arm: 45 deg -->
    <g transform="rotate(45)">
      <rect x="-19" y="-106" width="38" height="90" rx="19" fill="#111111"/>
    </g>
    <!-- Right arm: -45 deg -->
    <g transform="rotate(-45)">
      <rect x="-19" y="-106" width="38" height="90" rx="19" fill="#111111"/>
    </g>
  </g>
</svg>"""

# Lockup for Concept A: 880 x 256
concept_a_lockup = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="lockup-title-a">
  <title id="lockup-title-a">Yonru Logo Lockup A</title>
  <g transform="translate(48, 48) scale(0.625)">
    <g transform="translate(128, 128)">
      <rect x="-19" y="16" width="38" height="90" rx="19" fill="#111111"/>
      <g transform="rotate(45)">
        <rect x="-19" y="-106" width="38" height="90" rx="19" fill="#111111"/>
      </g>
      <g transform="rotate(-45)">
        <rect x="-19" y="-106" width="38" height="90" rx="19" fill="#111111"/>
      </g>
    </g>
  </g>
  <text x="236" y="162" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="700" letter-spacing="-2" fill="#111111">Yonru</text>
  <text x="554" y="162" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="400" fill="#ffd700">.</text>
</svg>"""

# -----------------------------------------------------------------------------
# Concept B: "The Focal Frame" (The In-Out Brackets)
# Mark Type: Pictorial / Tool Symbol
# -----------------------------------------------------------------------------
concept_b_symbol = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-b">
  <title id="title-b">Yonru — The Focal Frame</title>
  <!-- Left In-bracket: [ -->
  <path fill="none" stroke="#111111" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 94 56
    H 56
    V 200
    H 94
  "/>
  <!-- Right Out-bracket: ] -->
  <path fill="none" stroke="#111111" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
    M 162 56
    H 200
    V 200
    H 162
  "/>
  <!-- Center focal clip (The selected moment) -->
  <rect x="114" y="68" width="28" height="120" rx="14" fill="#111111"/>
</svg>"""

# Lockup for Concept B: 880 x 256
concept_b_lockup = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="lockup-title-b">
  <title id="lockup-title-b">Yonru Logo Lockup B</title>
  <g transform="translate(48, 48) scale(0.625)">
    <path fill="none" stroke="#111111" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
      M 94 56
      H 56
      V 200
      H 94
    "/>
    <path fill="none" stroke="#111111" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" d="
      M 162 56
      H 200
      V 200
      H 162
    "/>
    <rect x="114" y="68" width="28" height="120" rx="14" fill="#111111"/>
  </g>
  <text x="236" y="162" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="700" letter-spacing="-2" fill="#111111">Yonru</text>
  <text x="554" y="162" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="400" fill="#ffd700">.</text>
</svg>"""

# -----------------------------------------------------------------------------
# Concept C: "The Zen Shutter Y" (Fluid Dual-Arc Monogram)
# Mark Type: Letterform Monogram
# -----------------------------------------------------------------------------
concept_c_symbol = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title-c">
  <title id="title-c">Yonru — The Zen Shutter</title>
  <path fill="#111111" fill-rule="evenodd" d="
    M 48 54
    C 48 54, 74 118, 114 146
    V 218
    C 114 224.6, 119.4 230, 126 230
    H 130
    C 136.6 230, 142 224.6, 142 218
    V 146
    C 182 118, 208 54, 208 54
    H 168
    C 154 90, 138 112, 128 120
    C 118 112, 102 90, 88 54
    Z
  "/>
</svg>"""

# Lockup for Concept C: 880 x 256
concept_c_lockup = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 256" width="880" height="256" role="img" aria-labelledby="lockup-title-c">
  <title id="lockup-title-c">Yonru Logo Lockup C</title>
  <g transform="translate(48, 48) scale(0.625)">
    <path fill="#111111" fill-rule="evenodd" d="
      M 48 54
      C 48 54, 74 118, 114 146
      V 218
      C 114 224.6, 119.4 230, 126 230
      H 130
      C 136.6 230, 142 224.6, 142 218
      V 146
      C 182 118, 208 54, 208 54
      H 168
      C 154 90, 138 112, 128 120
      C 118 112, 102 90, 88 54
      Z
    "/>
  </g>
  <text x="236" y="162" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="700" letter-spacing="-2" fill="#111111">Yonru</text>
  <text x="554" y="162" font-family="'Outfit', system-ui, -apple-system, sans-serif" font-size="112" font-weight="400" fill="#ffd700">.</text>
</svg>"""

with open("docs/design/logo/concept-a-symbol.svg", "w") as f:
    f.write(concept_a_symbol)
with open("docs/design/logo/concept-a-lockup.svg", "w") as f:
    f.write(concept_a_lockup)

with open("docs/design/logo/concept-b-symbol.svg", "w") as f:
    f.write(concept_b_symbol)
with open("docs/design/logo/concept-b-lockup.svg", "w") as f:
    f.write(concept_b_lockup)

with open("docs/design/logo/concept-c-symbol.svg", "w") as f:
    f.write(concept_c_symbol)
with open("docs/design/logo/concept-c-lockup.svg", "w") as f:
    f.write(concept_c_lockup)

print("Saved all perfected concepts.")
