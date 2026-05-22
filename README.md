# Yonru Setup & Deployment Guide

Welcome! This document will help you configure and run the Yonru clipping ecosystem across diverse platforms securely.

---

## Prerequisites

Before running the stack, confirm your host machine possesses the following core binary environments:

1. **Node.js**: (Version 18.0.0 or greater). [Download Node here](https://nodejs.org/).
2. **Python**: (Version 3.9 through 3.12). [Download Python here](https://www.python.org/).
3. **FFmpeg**: Required for overlay processing tasks.
   - **MacOS**: `brew install ffmpeg`
   - **Windows**: Use [Chocolatey](https://chocolatey.org/): `choco install ffmpeg` or extract binaries manually.

---

## Quick Start (Recommended)

Yonru features a unified, self-healing cross-platform launcher script (`run.py`) that handles dependency checks, creates virtual environments, installs packages (both Python and Node), downloads offline fonts, and runs all services concurrently.

### 1. Prerequisite Binaries
Ensure you have the core runtimes installed:
- **Node.js** (18+)
- **Python** (3.9 - 3.12)
- **FFmpeg**:
  - **macOS**: `brew install ffmpeg`
  - **Windows**: Use Chocolatey (`choco install ffmpeg`), Scoop (`scoop install ffmpeg`), or download manually.

### 2. Set API Key
Create a `.env` file inside the `backend/` folder and insert your Gemini API Key:
```bash
# Inside backend/.env
GEMINI_API_KEY="your_api_key_here"
```
*(If you run the launcher, it will automatically copy the example file for you if missing!)*

### 3. Bootstrap & Launch
From the root directory, simply run:
```bash
python run.py
```
This single command will:
1. Verify Node, Python, and FFmpeg installations.
2. Automatically create the Python virtual environment and run `pip install`.
3. Automatically download offline fonts and compile stylesheets.
4. Run `npm install` inside `/frontend` and `/remotion_engine` if needed.
5. Concurrently boot the Backend (Port 8000), Nuxt Frontend (Port 3000), and Remotion Preview (Port 3003) with beautiful color-coded terminal log multiplexing.

To exit, press `Ctrl+C`. All child processes will be terminated cleanly.

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

