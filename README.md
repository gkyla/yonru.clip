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

## Local Setup

### 1. Environment Variables
Before running anything, set up your secrets:
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env` and add your `GEMINI_API_KEY`.

### 2. Configure the Backend (Python)
Navigate inside the `/backend` folder:
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Download Local Fonts
Yonru uses a fully local, offline-capable font system for rendering. Download the required fonts (~25MB) by running this script from the project root:
```bash
# From the root directory (where download_fonts.py is located)
# Ensure you have the `requests` module installed (e.g., pip install requests)
python3 download_fonts.py
```
This automatically populates the `frontend` and `remotion_engine` with all necessary font weights.

### 4. Configure the Frontend (Nuxt)
Navigate inside the `/frontend` folder:
```bash
cd frontend
npm install
```

### 5. Configure the Video Render Engine
Navigate inside the `/remotion_engine` folder:
```bash
cd remotion_engine
npm install
```

---

## Execution
Run the launch commands safely:
```bash
# Unix platforms (Mac/Linux)
./run.sh

# Windows platforms (Powershell / Command line triggers)
cd backend && uvicorn main:app --env-file .env
cd frontend && npm run dev
cd remotion_engine && npm run preview
```
