# 0011. Hardware-Guided Transcription Engine Selection

Date: 2026-08-29

## Status

Accepted

## Context

Yonru Clip relies on Faster-Whisper models (`tiny`, `base`, `small`, `medium`, `large-v3`) for high-precision word-level speech transcription. Beginners and creators configuring settings in `/settings` (Whisper Engine) frequently encounter decision paralysis or choose oversized models (e.g. `large-v3` on machines with limited RAM), leading to system memory exhaustion, swap thrashing, or prolonged video rendering stalls.

Previous approaches considered:
1. Continuous background hardware profiling on application startup (rejected to avoid adding latency to initial page loads).
2. Forcing an automatic model switch without confirmation (rejected to respect user agency and custom workflows).
3. Querying hardware capabilities through heavyweight machine learning runtime dependencies like PyTorch (rejected to keep the binary and diagnostic layer lightweight, reliable, and decoupled from framework-specific CUDA bindings).

## Decision

1. **Lightweight OS-Native Capability Profiling**:
   System hardware capability (CPU model & core count, total physical RAM, and GPU/Unified Memory status) is inspected via standard operating system facilities (`platform`, `os`, `sysctl`/`SC_PHYS_PAGES`, and optional `nvidia-smi` inspection for discrete NVIDIA GPUs).
2. **On-Demand User Activation**:
   Profiling executes exclusively when the user interacts with the **"Calculate Speed"** trigger within the Whisper Engine preferences interface, with cached results persisted in browser `localStorage` to ensure instant subsequent rendering and an on-demand **"Re-scan"** action to recalculate when system conditions change.
3. **Objective Duration Estimation per 60-Second Video Clip**:
   Rather than imposing prescriptive "recommendation" labels that restrict user autonomy, the system provides transparent, objective time estimates normalized to a **60-second video clip** (e.g., `~6s per 60s video`, `~41s per 60s video`), dynamically calculated using detected CPU architecture, core count, and hardware acceleration multipliers.
4. **Autonomous Model Selection**:
   Users maintain full agency to select any Whisper model according to their specific accuracy and latency tolerance.
5. **Memory-Safety Guardrails**:
   Presets that exceed the physical capacity of the detected system are marked with proactive safety warnings (`May be slow on your PC`) to prevent resource exhaustion and application stalls during clip rendering.
6. **Cross-Surface Metric Visibility in Unified Analyzer**:
   To ensure creators have continuous awareness of the compute trade-off prior to triggering video analysis without causing toolbar crowdedness, the **Active Transcriber Interactive Pill** on the Unified Analyzer panel displays the active model in a compact duration format with a semantic microphone icon (e.g., `🎙️ BASE (~6s/60s) ›` or `🎙️ BASE (?/60s) ›` when unscanned). The pill unifies model status and direct navigation to transcription settings while exposing a streamlined hover tooltip displaying model description matching `/settings` Whisper Engine, benchmark time estimate (or `Not benchmarked`), accuracy, and an action-oriented settings shortcut (keeping deep hardware diagnostics and capacity warnings encapsulated within `/settings`).

## Consequences

### Positive
- Beginners receive instant, tailored guidance without needing deep knowledge of machine learning resource footprints.
- Mitigates out-of-memory crashes and thermal throttling during long video clip transcriptions.
- Keeps backend dependencies minimal without introducing heavy profiler daemons.

### Negative / Trade-offs
- Detection relies on static hardware capacity (total RAM and GPU presence) rather than real-time GPU compute benchmarks.
