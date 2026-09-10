<div align="center">

# yonru.clip

Transform long-form podcasts, interviews, and streams into high-virality 9:16 vertical clips in seconds. Powered by local Whisper transcription, Google Gemini AI hook curation, and Remotion.


[![Remotion](https://img.shields.io/badge/Rendering-Remotion-0B84F3?style=flat-square&logo=react&logoColor=white)](https://www.remotion.dev/)
[![Gemini](https://img.shields.io/badge/AI-Gemini%20Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Whisper](https://img.shields.io/badge/Audio-Faster--Whisper-orange?style=flat-square)](https://github.com/SYSTRAN/faster-whisper)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

<br />

[Overview](#a-quick-look-at-yonru) • [Quick Start](#quick-start)

<br />

### A Quick Look at Yonru

<p align="center">
  <video controls autoplay loop muted playsinline width="100%" src="https://github.com/user-attachments/assets/bd472290-81de-43c0-a85e-e6e3ffb9c7e7">
    <source src="https://github.com/user-attachments/assets/bd472290-81de-43c0-a85e-e6e3ffb9c7e7" type="video/mp4">
  </video>
</p>

*Paste a video link, and let Yonru handle the rest: transcribe speech, spot the best hooks, and extract ready clips.*
<br />

</div>

## Key Capabilities at a Glance

| Feature | Description |
|---|---|
| `AI Hook Discovery` | Spots high-retention moments with virality scores (0-100) via Gemini AI |
| `Thumbnail Extraction` | Captures sharp static thumbnail snapshots (`thumb_{start}.jpg`) automatically |
| `Local Transcription` | Runs faster-whisper locally with GPU profiling for private speech-to-text |
| `Face Tracking` | Dynamically centers speakers when reframing 16:9 widescreen into vertical 9:16 |
| `Studio Editor` | Multi-track Timeline Viewport with frame-accurate scrubbing and canvas drag |
| `Animated Subtitles` | Karaoke-style captions synced to spoken words with bundled viral typography |
| `Audio Censorship` | Word-level muting or bleep audio overlay presets without video cuts |
| `Prompt Editor` | Custom prompt templates with tagging to steer AI detection toward genres |

---

## Hook Selection & Preview

Browse AI-curated moments from your **Cached Video Library** or recent analysis jobs, inspect virality rationale breakdowns, and preview synchronized audio before moving into the editor:

<p align="center">
  <video controls autoplay loop muted playsinline width="100%" src="https://github.com/user-attachments/assets/ca72a735-640b-4498-9840-e06de7341c44">
    <source src="https://github.com/user-attachments/assets/ca72a735-640b-4498-9840-e06de7341c44" type="video/mp4">
  </video>
</p>

### What You Can Do in Hook Selection:
- **Instant Cache Loading**: Revisit previously analyzed videos and restore generated hooks instantly without re-downloading source media.
- **Virality Score & Rationale Breakdown**: Review retention scores (0-100) alongside Gemini AI narrative explanations for why each moment captures attention.
- **Cinematic In-Sync Preview**: Playback candidate clips with SD/HD toggles and fine-tune start and end timestamps before entering the Studio.

---

## Deep Dive: Precision Multi-Track Studio

Once Yonru discovers viral Hooks from your Source Video, you can open any clip in the **Studio Editor** for granular frame-by-frame customization:

<p align="center">
  <video controls autoplay loop muted playsinline width="100%" src="https://github.com/user-attachments/assets/cefe4339-bd5c-4ebb-9017-534347b2d70e">
    <source src="https://github.com/user-attachments/assets/cefe4339-bd5c-4ebb-9017-534347b2d70e" type="video/mp4">
  </video>
</p>

### What You Can Do in the Studio:

#### 1. Timeline & Face Tracking
- **Decoupled Timeline Viewport**: Pan, zoom, and navigate long multi-track sequences without mutating your current playhead time.
- **Face Tracking & 9:16 Auto-Reframe**: Precomputed computer vision dynamically centers active speakers into vertical 9:16, with instant WYSIWYG canvas drag-to-override.
- **Surgical Word-Level Audio Censorship**: Click any word in the interactive transcript to silence it or overlay a customizable bleep preset (`censor_bleep.wav`, `retro_bleep.wav`).

#### 2. Subtitle Animations & Highlight Effects
- **Kinetic Caption Animations**: Bring subtitles to life with animated word-tracking styles (Karaoke, Pop, Scale, Bounce).
- **Active Word Highlight Modes**: Choose how currently spoken words pop on screen - via color tinting, background pill boxes, scale enlargements, or animated underlines.
- **Word Chunking Modes**: Switch subtitle density between 1 Word (punchy short-form style), 3 Words, or 4 Words per screen.
- **Millisecond Sync Timing Offset**: Fine-tune audio-to-text alignment using a precision slider (-2000ms to +2000ms) for frame-perfect lip-sync.

#### 3. Typography & 3-Channel Color System
- **Curated Creator Font Library**: Bundled offline viral fonts (TheBoldFont, Bebas Neue, Montserrat, Impact, Inter) with guaranteed zero layout shifts.
- **Deep Text Geometry**: Granular sliders for font size (40-140px), font weights (400-900), text case (UPPERCASE/Normal), word spacing, and stroke outlines.
- **3-Channel Color**: Dedicated color swatches for base text, active spoken word highlight, and stroke/border outlines.
- **Text Backdrop Treatments**: Enhance readability against busy backgrounds with solid boxes, glassmorphism blur, soft gradients, or clean transparent styles.

<br />

## Modular Prompt Editor & Custom Templates

Yonru puts prompt engineering directly into your hands. Tailor how Gemini AI discovers viral hooks to match your exact content genre - from sarcastic comedy and technical debates to high-stakes storytelling.

### 1. Browse & Create Custom Templates
Explore pre-built prompt strategies or design your own custom templates with domain-specific modifiers, hook criteria, and duration bounds:

<p align="center">
  <video controls autoplay loop muted playsinline width="100%" src="https://github.com/user-attachments/assets/08f81dba-c511-4cad-89c3-602b498f9926">
    <source src="https://github.com/user-attachments/assets/08f81dba-c511-4cad-89c3-602b498f9926" type="video/mp4">
  </video>
</p>

### 2. Choose & Activate Templates
Select and configure active prompt templates with live parameter tuning and preview model instructions before initiating video analysis:

<p align="center">
  <video controls autoplay loop muted playsinline width="100%" src="https://github.com/user-attachments/assets/cf5dee57-0cf1-4c9f-b3dd-c87cb53bc720">
    <source src="https://github.com/user-attachments/assets/cf5dee57-0cf1-4c9f-b3dd-c87cb53bc720" type="video/mp4">
  </video>
</p>

- **Custom Extraction Criteria**: Write clear natural language rules telling the AI exactly what kind of moments to look for (e.g. comedic punchlines, technical debates, or emotional storytelling).
- **Niche & Category Tagging**: Organize your prompt templates with custom tags (`#podcast`, `#comedy`, `#interview`, `#education`) for quick discovery.
- **One-Click Preset Selection**: Choose and activate your favorite template preset right before analyzing any new video - no need to rewrite prompts from scratch.

---

## System Architecture

```
yonru.clip/
├── frontend/             # Nuxt 4 (^4.4.x) + Vue 3.5 + TailwindCSS UI
│   └── app/              # Clean Nuxt 4 directory structure & stores
├── backend/              # FastAPI + Python 3.12 core service
│   ├── services/         # Pipeline, Whisper STT, Gemini hooks, auto-reframe
│   └── main.py           # REST APIs & background task orchestrator
├── remotion_engine/      # Remotion (React 19) multi-track compositor
└── run.py                # Unified cross-platform self-healing launcher
```

For complete architectural patterns, state management rules, and ADRs:
- [Domain Model & Canonical Glossary](CONTEXT.md)
- [Architecture Decision Records (ADRs)](docs/adr/)
- [Internal Architecture Guidelines](.agents/instructions/architecture.md)

---

## Quick Start

Get Yonru Clip running locally in 3 simple steps:

### 1. Install Core Prerequisites
Ensure your computer has these 3 tools installed:
- [Python (3.10 - 3.12)](https://www.python.org/downloads/)
  *(Important for Windows: make sure to check **"Add Python to PATH"** during installation).*
- [Node.js (18+)](https://nodejs.org/)
- [FFmpeg](https://ffmpeg.org/download.html)
  *(macOS: `brew install ffmpeg` | Windows: `winget install Gyan.FFmpeg` | Linux: `sudo apt install ffmpeg`).*

### 2. Clone & Launch
Open your terminal and run:
```bash
git clone https://github.com/gitkyla/yonru.clip.git
cd yonru.clip
python run.py
```
> [!TIP]
> The unified `run.py` launcher handles all heavy lifting automatically: creating virtual environments, installing dependencies, syncing offline creator fonts, and starting all services.

### 3. Open Yonru & Add Gemini API Key
1. Open your browser and navigate to **`http://localhost:3000`**.
2. Go to **Settings** (`http://localhost:3000/settings`) from the navigation sidebar.
3. Paste your free [Gemini API Key from Google AI Studio](https://aistudio.google.com/apikey).
*(Alternatively, you can add `GEMINI_API_KEY="your_api_key_here"` directly inside `backend/.env`).*

---

## (Optional) Bypass YouTube Download Limits with cookies.txt

YouTube can restrict video downloads with bot verification or rate limits. Importing your browser session cookies keeps all video downloading operations fast and reliable:

1. **Install Browser Extension**: Add the open-source "Get cookies.txt LOCALLY" extension for [Chrome / Brave](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) or [Firefox](https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/).
2. **Export YouTube Cookies**: Open [YouTube](https://youtube.com) while signed in, click the extension icon, and choose **Export** (Netscape format) to save a `.txt` file.
3. **Upload in Settings**: In Yonru Clip, go to **Settings > YouTube Cookies** (`http://localhost:3000/settings`) and drag-and-drop your `.txt` file onto the upload card.

