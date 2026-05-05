#!/bin/bash

# Yonru Run Script
# 
# Usage: ./run.sh [all|backend|frontend|remotion]
#
# all: Starts all services concurrently
# backend: Starts FastAPI server on port 8000
# frontend: Starts Nuxt server on port 3000
# remotion: Starts Remotion Studio on port 3003

echo "🛡️  Checking Yonru environment..."

TYPE=${1:-all}

run_backend() {
    echo "🚀 Starting Backend (Port 8000)..."
    cd backend
    source venv/bin/activate
    uvicorn main:app --env-file .env --host 0.0.0.0 --port 8000 --reload
}

run_frontend() {
    echo "🎨 Starting Frontend (Port 3000)..."
    cd frontend
    npm run dev
}

run_remotion() {
    echo "🎥 Starting Remotion Iframe Preview (Port 3003)..."
    cd remotion_engine
    npm run preview
}

case $TYPE in
    backend)
        run_backend
        ;;
    frontend)
        run_frontend
        ;;
    remotion)
        run_remotion
        ;;
    all)
        echo "🔥 Starting Yonru (Full Stack)..."
        (trap 'kill 0' SIGINT; run_backend & run_frontend & run_remotion)
        ;;
    *)
        echo "Usage: ./run.sh [backend|frontend|all]"
        exit 1
        ;;
esac
