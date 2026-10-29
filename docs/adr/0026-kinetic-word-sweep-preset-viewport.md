# 0026. Kinetic Word Sweep in Preset Studio Viewport

Date: 2026-10-30

## Status

Accepted

## Context

Yonru's Subtitle Preset Library provides creators with pre-configured subtitle styles comprising typography, animations (`pop`, `bounce`, `slide-up`, `fade`, `karaoke`, `typewriter`), and highlight modes (`color`, `scale`, `box`, `underline`).

In the Preset Studio modal grid and sidebar preview pane, presets are auditioned using a standardized 3-word benchmark (`['THAT', 'WAS', 'CRAZY']`). However, the previous preview implementation suffered from notable discrepancies:
1. **Static Last-Word Highlighting**: While `karaoke` and `typewriter` implemented sequential word timing, chunk animations (`pop`, `bounce`, `slide-up`, `fade`) statically highlighted only the final word (`"CRAZY"`). This failed to demonstrate how Remotion's transcription engine highlights words sequentially as spoken audio progresses.
2. **Heavyweight Player Overhead**: Embedding full Remotion Player instances or HTML5 video elements for every preset card in a 12-item grid causes severe CPU/GPU memory footprint, audio thread contention, and sluggish modal scrolling.
3. **Layout Shift Jitter**: Activating box backgrounds or underlines dynamically caused inline word spacing to jump or jitter without baseline layout compensation.

## Decision

1. **Pure GPU CSS Keyframe Kinetic Word Sweep Simulation**:
   - Model the active speech cycle as a pure CSS keyframe sweep running across a 2.4-second repeating loop.
   - Divide the standardized 3-word phrase into precise active speech timing windows:
     - **Word 0 (`"THAT"`)**: 0.00s – 0.35s (0.0% – 14.6%)
     - **Word 1 (`"WAS"`)**: 0.35s – 0.70s (14.6% – 29.2%)
     - **Word 2 (`"CRAZY"`)**: 0.70s – 2.00s (29.2% – 83.3%, held through reading pause)
     - **Exit Fade / Reset**: 2.00s – 2.40s (83.3% – 100.0%)

2. **Reading Hold Parity**:
   - In real-world short-form video (TikTok, Reels, Shorts), the final word of a spoken chunk remains highlighted during the natural reading pause before the next sentence appears.
   - The Kinetic Word Sweep engine maintains the highlight on Word 2 from 0.70s through 2.00s before fading out cleanly.

3. **Past Words State Management**:
   - For `karaoke` animation: Past spoken words dim to `opacity: 0.5`, accurately mimicking Remotion's `dimPast: true` parameter.
   - For chunk animations (`pop`, `bounce`, `slide-up`, `fade`) and `typewriter`: Past words return to normal base color and full opacity `1.0`, matching Remotion's `dimPast: false`.

4. **Zero-Layout-Shift Highlight Rendering**:
   - **Box Highlight**: All words maintain reserved baseline padding (`1px 5px`) and transparent box background so that keyframe color changes never alter inline word width or cause layout shift.
   - **Underline Highlight**: Every word renders an independent `.viewport-underline-bar` container below its baseline, animated via GPU-accelerated `opacity` and `transform: scaleX(...)` rather than border width.

5. **Cross-Preset Highlighting Universality**:
   - All highlight modes (`color`, `scale`, `box`, `underline`) animate per-word across all animation types when a highlight mode is active.

## Consequences

- Delivers silky 60fps preview performance across all 12 cards simultaneously in the Preset Studio modal grid with negligible memory footprint.
- Accurately mirrors Remotion's word-by-word timestamp activation and reading pause hold.
- Completely eliminates layout shifts and text jumps during highlight state transitions.

