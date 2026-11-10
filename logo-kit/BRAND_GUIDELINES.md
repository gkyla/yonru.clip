# Yonru Clip — Brand Identity Guidelines

> Official visual identity and brand usage documentation for **Yonru Clip**.

---

## 1. The Logo & Visual Story

- **Concept Name:** **Sol Aperture**
- **Brand Archetype:** Elegant, Soft, Technical
- **Core Idea:** A rotational dual-crescent iris capturing the distilled golden moment (viral hook) at its center. The outer arcs represent the continuous long-form media stream, while the radiant golden core represents the extracted, high-virality highlight.
- **Constraints Maintained:**
  - Zero literal scissors or film brackets
  - Pure abstract geometric symbol
  - 100% rounded semicircular caps delivering approachable softness with mathematical precision
  - Cohesive harmony with the "Yonru Clip" custom outlined wordmark

---

## 2. Master Asset Structure

All master vector assets reside in [`logo-kit/`](file:///Users/gitkyla/Documents/Codes/yonru.clip/logo-kit/):

```
logo-kit/
├── master/                               # Master vector source files (SVG)
│   ├── yonru-symbol-color-dark.svg       # Symbol for dark backgrounds (White + Gold)
│   ├── yonru-symbol-color-light.svg      # Symbol for light backgrounds (Obsidian + Gold)
│   ├── yonru-symbol-tile.svg             # App tile container with squircle backdrop
│   ├── yonru-symbol-small.svg            # Optical cut optimized for 16px - 32px
│   ├── yonru-symbol-black.svg            # Single-color black
│   ├── yonru-symbol-white.svg            # Single-color reversed white
│   ├── yonru-symbol-mono.svg             # Single-color brand gold (#ffd700)
│   ├── yonru-lockup-horizontal-dark.svg  # Primary horizontal lockup (Dark UI)
│   ├── yonru-lockup-horizontal-light.svg # Primary horizontal lockup (Light UI)
│   ├── yonru-lockup-stacked-dark.svg     # Stacked lockup (Dark UI)
│   ├── yonru-lockup-stacked-light.svg    # Stacked lockup (Light UI)
│   ├── yonru-wordmark-dark.svg           # Outlined wordmark only (Dark)
│   └── yonru-wordmark-light.svg          # Outlined wordmark only (Light)
├── variants/                             # Pre-rendered PNGs across sizes (32px to 1440px)
├── web/                                  # Complete web & PWA icon suite
│   ├── favicon.ico                       # Multi-resolution ICO (16, 32, 48)
│   ├── favicon.svg                       # Modern scalable vector browser icon
│   ├── apple-touch-icon.png              # iOS home screen bookmark (180x180)
│   ├── icon-192.png & icon-512.png       # Android & PWA icons
│   ├── maskable-512.png                  # Adaptive Android icon
│   ├── site.webmanifest                  # Web app manifest configuration
│   └── head-snippet.html                 # Drop-in HTML <head> code
└── presentation/                         # Client presentation & mockups
    ├── presentation.html                 # Interactive slide deck
    └── slides/                           # High-resolution slide renders
```

---

## 3. Clear Space & Minimum Sizes

### Clear Space Rule
Maintain a minimum protective clear space zone around the mark on all sides equal to **$1 \times X$**, where **$X$** is the diameter of the central golden core (or 32 px on a 256 px grid). No typography, borders, or graphics may encroach within this zone.

```
       ┌───────────────────────────────┐
       │               X               │
       │       ┌───────────────┐       │
       │   X   │  (Symbol)     │   X   │
       │       └───────────────┘       │
       │               X               │
       └───────────────────────────────┘
```

### Minimum Reproduction Sizes

| Asset Variant | Digital / Screen | Print Medium | Recommendation |
|---|---|---|---|
| **Horizontal Lockup** | 120 px width | 32 mm width | For navigation bars, footers, headers |
| **Stacked Lockup** | 80 px width | 22 mm width | For square social avatars, splash screens |
| **Standalone Symbol** | 32 px width | 8 mm width | Standard UI badges, status icons |
| **Micro Symbol (Favicon)** | 16 px width | 4 mm width | Use `yonru-symbol-small.svg` / `favicon.ico` |

---

## 4. Color Palette & Reproduction Specifications

| Color Name | Swatch | HEX | RGB | CMYK | Pantone Match |
|---|---|---|---|---|---|
| **Sol Gold** | ![#ffd700](https://placehold.co/15x15/ffd700/ffd700.png) | `#ffd700` | `255, 215, 0` | `0, 16, 100, 0` | `Pantone 108 C` / `116 C` |
| **Pure White** | ![#ffffff](https://placehold.co/15x15/ffffff/ffffff.png) | `#FFFFFF` | `255, 255, 255` | `0, 0, 0, 0` | — |
| **Studio Obsidian** | ![#0b0e14](https://placehold.co/15x15/0b0e14/0b0e14.png) | `#0B0E14` | `11, 14, 20` | `80, 70, 60, 85` | `Pantone Black 6 C` |

### Approved Combinations
1. **Dark Surfaces (`#0B0E14` to `#18181B`):** Use `yonru-symbol-color-dark.svg` or `yonru-lockup-horizontal-dark.svg` (White arc + Gold arc + Gold core).
2. **Light Surfaces (`#FFFFFF` to `#F4F4F5`):** Use `yonru-symbol-color-light.svg` or `yonru-lockup-horizontal-light.svg` (Obsidian arc + Gold arc + Gold core).
3. **App Launchers / Docks:** Use `yonru-symbol-tile.svg` (includes built-in dark squircle container).
4. **Single-Color / Print:** Use `yonru-symbol-black.svg` (light paper) or `yonru-symbol-white.svg` (dark stock).

---

## 5. Typography

- **Primary Wordmark Font:** **Outfit** (Google Fonts / SIL Open Font License 1.1)
  - "Yonru": Outfit Bold (`font-weight: 700`)
  - "Clip": Outfit Medium (`font-weight: 500`)
- **Body & Product Interface Stack:** **Inter** or **Outfit**
- **Web Fallback Stack:**
  ```css
  font-family: "Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  ```

---

## 6. Brand Rules & Misuse

- **Do NOT** rotate or change the 45° dynamic orientation of the aperture crescents.
- **Do NOT** distort, stretch, or alter aspect ratios.
- **Do NOT** remove or displace the central golden core.
- **Do NOT** add artificial drop shadows, bevels, glows, or unapproved gradients.
- **Do NOT** place the white-arc dark lockup on pure white backgrounds without contrast.
- **Do NOT** re-type the wordmark using live un-outlined system fonts in vector exports.
