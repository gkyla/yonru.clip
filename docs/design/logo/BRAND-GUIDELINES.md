# Yonru — Brand Identity & Logo Guidelines

> Official logo system, asset specifications, and usage guidelines for Yonru.

---

## 1. The Logo Concept

- **Mark Name**: The Focal Frame
- **Mark Type**: Tool / Framing Symbol (`[ | ]`)
- **Core Idea**: Two calm in/out framing brackets (`[ ]`) embracing a central timeline clip capsule (`|`). It directly expresses the fundamental video clipping paradigm—isolating a moment in time—without relying on clichéd scissors, cutting blades, play triangles, or film sprockets.
- **Brand Essence**: Calm, effortless, distraction-free, and precise.

---

## 2. Master Assets & Variations

All vector masters are available in [docs/design/logo/](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/) and exports in [docs/design/logo/dist/](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/dist/):

| File Name | Purpose | Preview Context |
|---|---|---|
| [`yonru-symbol-color-dark.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/yonru-symbol-color-dark.svg) | Primary symbol on dark surfaces | Dark UI (`#09090B`), macOS Dock, App icon |
| [`yonru-symbol-color.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/yonru-symbol-color.svg) | Primary symbol on light surfaces | Light mode web, white documents |
| [`yonru-horizontal-dark.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/yonru-horizontal-dark.svg) | Primary horizontal lockup | App header, GitHub README banner, navigation |
| [`yonru-horizontal.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/yonru-horizontal.svg) | Horizontal lockup for light surfaces | Light documentation, invoice, print |
| [`yonru-stacked-dark.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/yonru-stacked-dark.svg) | Centered vertical lockup | Splash screens, merchandise, stickers |
| [`yonru-app-icon.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/yonru-app-icon.svg) | Application squircle icon | macOS Dock, iOS/Android home screen |
| [`yonru-symbol-black.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/yonru-symbol-black.svg) | Monochrome black | Single-color print, laser engraving |
| [`yonru-symbol-white.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/yonru-symbol-white.svg) | Monochrome white | Dark photography, watermark |
| [`yonru-symbol-mono-gold.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/yonru-symbol-mono-gold.svg) | Brand gold monochrome | High-contrast accents |

---

## 3. Color Specifications

| Swatch | Role | HEX | RGB | Tailwind Class | Notes |
|---|---|---|---|---|---|
| **Gold** | Primary Accent / Clip | `#ffd700` | `255, 215, 0` | `accent-500` | The isolated captured moment |
| **Dark Base** | Primary Surface | `#09090B` | `9, 9, 11` | `surface-dark` | Deep zinc background |
| **Card Surface** | Secondary Surface | `#121214` | `18, 18, 20` | `surface-card` | Elevated card containers |
| **Pure White** | Text & Dark Brackets | `#FFFFFF` | `255, 255, 255` | `text-white` | Framing brackets on dark UI |

---

## 4. Clear Space & Minimum Sizing

- **Clear Space**: Maintain a minimum exclusion zone of **1× Capsule Width (28 px at 256 px scale, or 0.25× mark height)** on all sides of the symbol and lockups. No typography, icons, or UI boundaries should intrude into this zone.
- **Minimum Digital Sizes**:
  - Horizontal Lockup: `96 px` width.
  - App Icon: `32 px` width.
  - Favicon / Status Bar: `16 px` (use [`yonru-symbol-small.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/yonru-symbol-small.svg) or [`favicon.svg`](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/design/logo/dist/favicon.svg)).

---

## 5. Typography

- **Brand Wordmark**: Set in custom-spaced **Outfit** (weight: 700 Bold, tracking: `-0.02em`).
- **Punctuation Dot**: Set in **Outfit** (weight: 400 Regular) colored in brand gold `#ffd700`.
- **UI & Body Font**: Outfit (Headlines & Body) and Fira Code (Technical / Timestamps / Monospace).

---

## 6. Usage Guidelines

### Do:
- Use the dark full-color variant (`#FFFFFF` brackets + `#ffd700` clip) on dark grey and black surfaces.
- Use the light full-color variant (`#09090B` brackets + `#ffd700` clip) on white and light surfaces.
- Preserve the exact proportional gap between the brackets and the central clip capsule.

### Don't:
- Do not stretch, compress, or rotate the mark.
- Do not swap the colors (never make the brackets yellow and the center white).
- Do not add drop shadows, outer glows, 3D skeuomorphic bevels, or gradients.
- Do not re-type the wordmark in a standard font without the calibrated letter-spacing.
