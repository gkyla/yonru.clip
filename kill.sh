#!/bin/bash

echo "🔪 Killing Yonru services..."

# Kill backend (Port 8000)
PID_8000=$(lsof -t -i:8000)
if [ -n "$PID_8000" ]; then
    echo "Stopping Backend (PID $PID_8000)..."
    kill -9 $PID_8000
else
    echo "Backend (8000) not running."
fi

# Kill frontend (Port 3000)
PID_3000=$(lsof -t -i:3000)
if [ -n "$PID_3000" ]; then
    echo "Stopping Frontend (PID $PID_3000)..."
    kill -9 $PID_3000
else
    echo "Frontend (3000) not running."
fi

# Kill frontend (Port 3001 - fallback)
PID_3001=$(lsof -t -i:3001)
if [ -n "$PID_3001" ]; then
    echo "Stopping Frontend Fallback (PID $PID_3001)..."
    kill -9 $PID_3001
fi

# Kill Remotion (Port 3003)
PID_3003=$(lsof -t -i:3003)
if [ -n "$PID_3003" ]; then
    echo "Stopping Remotion Studio (PID $PID_3003)..."
    kill -9 $PID_3003
else
    echo "Remotion Studio (3003) not running."
fi

echo "✅ All clean."
