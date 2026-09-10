<div align="center">

# yonru.clip

Transform long-form podcasts, interviews, and streams into high-virality 9:16 vertical clips in seconds. Powered by local Whisper transcription, Google Gemini AI hook curation, and Remotion.

<br />

[![Remotion](https://img.shields.io/badge/Rendering-Remotion-0B84F3?style=flat-square&logo=react&logoColor=white)](https://www.remotion.dev/)
[![Gemini](https://img.shields.io/badge/AI-Gemini%20Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev/)
[![Whisper](https://img.shields.io/badge/Audio-Faster--Whisper-orange?style=flat-square)](https://github.com/SYSTRAN/faster-whisper)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

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
| :--- | :--- |
| **AI Hook Discovery** | Identifies high-retention moments with virality scores (0-100) using Gemini AI. |
| **Thumbnail Extraction** | Automatically captures sharp static thumbnail snapshots (`thumb_{start}.jpg`). |
| **Local Transcription** | Runs faster-whisper locally with GPU profiling for fast, private speech-to-text. |
| **Face Tracking & Auto-Reframe** | Keeps speakers centered when adapting 16:9 widescreen into 9:16 vertical. |
| **Studio Editor** | Non-destructive multi-track Timeline Viewport with frame-accurate scrubbing. |
| **Animated Subtitles** | Karaoke-style captions synced to spoken words with bundled typography. |
| **Audio Censorship** | Millisecond-accurate word muting or bleep audio presets without video cuts. |
| **Prompt Editor** | Custom prompt templates with tagging to steer AI detection toward specific genres. |

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
- **3-Channel Color Engine**: Dedicated color swatches for base text, active spoken word highlight, and stroke/border outlines.
- **Text Backdrop Treatments**: Enhance readability against busy backgrounds with solid boxes, glassmorphism blur, soft gradients, or clean transparent styles.

---

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

## Prerequisites

Before running the stack, verify that your host machine possesses the following core binary environments:

1. **Node.js**: (Version 18.0.0 or greater).
   - **macOS**: `brew install node`
   - **Ubuntu/Debian**: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`
   - **Windows**: Download installer from [nodejs.org](https://nodejs.org/) or run `winget install OpenJS.NodeJS`.
2. **Python**: (Version 3.10 through 3.12).
   - **macOS**: `brew install python`
   - **Ubuntu/Debian**: `sudo apt install python3 python3-pip python3-venv`
   - **Windows**: Download from [python.org](https://www.python.org/).
3. **FFmpeg**: Required for overlay and video processing tasks.
   - **macOS**: `brew install ffmpeg`
   - **Ubuntu/Debian**: `sudo apt update && sudo apt install -y ffmpeg`
   - **Windows**: Use Chocolatey (`choco install ffmpeg`), Scoop (`scoop install ffmpeg`), or download pre-compiled static builds manually and append to system PATH.

---

## Quick Start (Recommended)

Yonru features a unified, self-healing cross-platform launcher script (`run.py`) that handles dependency checks, creates virtual environments, installs packages (both Python and Node), downloads offline fonts, and runs all services concurrently.

### 1. Set Gemini API Key
Create a `.env` file inside the `backend/` folder and insert your Gemini API Key:
```bash
# Inside backend/.env
GEMINI_API_KEY="your_api_key_here"
```
*(If you run the launcher, it will automatically copy the example file for you if missing!)*

### 2. Bootstrap & Launch
From the root directory, simply run:
```bash
python run.py
```

This single command will:
1. Verify Node, Python, and FFmpeg installations.
2. Automatically create the Python virtual environment and run `pip install`.
3. Automatically download offline fonts and compile stylesheets.
4. Run `npm install` inside `/frontend` and `/remotion_engine` if needed.
5. Concurrently boot the **Backend (Port 8000)**, **Nuxt Frontend (Port 3000)**, and **Remotion Preview (Port 3003)** with color-coded terminal log multiplexing.

To exit, press `Ctrl+C`. All child processes will be terminated cleanly.

---

## YouTube Download Restrictions & cookies.txt

YouTube aggressively blocks automated scrapers and CLI tools. To avoid downloads failing with "Sign in to confirm you are not a bot" or other captcha restrictions, you should import your YouTube browser session cookies:

1. **Get a Cookie Extractor Extension**: Install the open-source [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/ccloeocionehidjhhicdjiijlkocoodm) extension in Google Chrome / Brave or Firefox.
2. **Export YouTube Cookies**: Navigate to [YouTube](https://youtube.com), make sure you are logged in, click the extension icon, and export/download the cookies for `youtube.com` in Netscape format.
3. **Upload in Settings**: Open the **Settings** panel inside the Yonru web interface, and drag and drop your downloaded `.txt` file directly onto the upload card.

The application will validate the file format and save it locally as `backend/cookies.txt` to keep all video downloading operations functional and robust.

---

## Advanced CLI Controls

The launcher supports selective service starting via command-line targets:

```bash
# Start all services (default)
python run.py all

# Start only the FastAPI backend (Port 8000)
python run.py backend

# Start only the Nuxt frontend (Port 3000)
python run.py frontend

# Start only the Remotion Preview Studio (Port 3003)
python run.py remotion
```

---

## Legacy Execution (Manual)

If you prefer manual control, you can still initialize and execute services individually:

```bash
# Configure & Run Backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --env-file .env --reload

# Download fonts manually
python download_fonts.py

# Run Frontend
cd frontend
npm install
npm run dev

# Run Remotion Preview
cd remotion_engine
npm install
npm run preview
```
