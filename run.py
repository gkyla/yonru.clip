#!/usr/bin/env python3
import os
import sys
import shutil
import subprocess
import threading
import time
import signal

# --- Formatting Helpers ---
def enable_colors():
    """Enable ANSI escape sequences on Windows 10/11 if applicable."""
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            # 7 = ENABLE_PROCESSED_OUTPUT | ENABLE_WRAP_AT_EOL_OUTPUT | ENABLE_VIRTUAL_TERMINAL_PROCESSING
            kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
        except Exception:
            pass

def log_system(msg):
    sys.stdout.write(f"\033[33m[SYSTEM]\033[0m {msg}\n")
    sys.stdout.flush()

def log_error(msg):
    sys.stderr.write(f"\033[31m[ERROR]\033[0m {msg}\n")
    sys.stderr.flush()

# --- Bootstrapping Logic ---
def check_dependencies():
    log_system("Verifying core dependencies...")

    # 1. Check Node.js
    if not shutil.which("node"):
        log_error("Node.js was not detected on this machine. Please install Node.js (18+) first.")
        sys.exit(1)

    # 2. Check FFmpeg
    if not shutil.which("ffmpeg"):
        log_system("\033[31mFriendly Alert: FFmpeg was not detected in your system PATH.\033[0m")
        if sys.platform.startswith("win"):
            log_system("To install FFmpeg on Windows:")
            log_system("  - Use Chocolatey: 'choco install ffmpeg'")
            log_system("  - Use Scoop: 'scoop install ffmpeg'")
            log_system("  - Or download manually and add it to system Environment Variables.")
        elif sys.platform == "darwin":
            log_system("To install FFmpeg on macOS:")
            log_system("  - Run: 'brew install ffmpeg'")
        else:
            log_system("To install FFmpeg on Linux:")
            log_system("  - Run: 'sudo apt install ffmpeg' (Debian/Ubuntu) or equivalent.")
        
        # We don't crash here immediately because the backend renderer also has custom path overrides
        # But we print a strong warning.

def bootstrap_backend():
    backend_dir = os.path.abspath("backend")
    venv_dir = os.path.join(backend_dir, "venv")
    
    # Platform-specific paths
    if sys.platform == "win32":
        venv_python = os.path.join(venv_dir, "Scripts", "python.exe")
    else:
        venv_python = os.path.join(venv_dir, "bin", "python")

    # Copy .env if missing
    env_file = os.path.join(backend_dir, ".env")
    env_example = os.path.join(backend_dir, ".env.example")
    if not os.path.exists(env_file):
        if os.path.exists(env_example):
            log_system("Creating backend/.env from .env.example...")
            shutil.copy2(env_example, env_file)
            log_system("\033[33mACTION REQUIRED: Please open backend/.env and set your GEMINI_API_KEY.\033[0m")
        else:
            log_error("backend/.env is missing and .env.example was not found.")

    # Self-Healing: Recreate virtualenv if broken, missing, or pointing to a different folder
    is_valid_venv = False
    if os.path.exists(venv_dir) and os.path.exists(venv_python):
        try:
            # Verify virtualenv hasn't been moved by inspecting pyvenv.cfg
            cfg_path = os.path.join(venv_dir, "pyvenv.cfg")
            if os.path.exists(cfg_path):
                with open(cfg_path, "r", encoding="utf-8") as f:
                    cfg_content = f.read()
                
                # Check if current venv_dir normalized path is contained in the config command
                norm_venv_dir = os.path.normpath(venv_dir).lower()
                norm_cfg_content = os.path.normpath(cfg_content).lower()
                
                if norm_venv_dir in norm_cfg_content:
                    # Also double check it actually executes
                    res = subprocess.run([venv_python, "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2)
                    if res.returncode == 0:
                        is_valid_venv = True
        except Exception:
            pass

    if not is_valid_venv:
        log_system("Python virtual environment is missing, moved, or broken. Re-provisioning backend/venv...")
        if os.path.exists(venv_dir):
            try:
                shutil.rmtree(venv_dir)
            except Exception:
                pass
        subprocess.run([sys.executable, "-m", "venv", "venv"], cwd=backend_dir, check=True)

    # Check if packages need installation using python -m pip to bypass path / shebang issues
    log_system("Verifying Python backend dependencies (this may take a moment)...")
    subprocess.run([venv_python, "-m", "pip", "install", "-r", "requirements.txt"], cwd=backend_dir, check=True)
    
    return venv_python

def bootstrap_fonts(venv_python):
    # Check if fonts are downloaded
    fonts_css = "frontend/app/assets/css/fonts.css"
    if not os.path.exists(fonts_css) or os.path.getsize(fonts_css) < 100:
        log_system("Local offline fonts missing. Downloading automatically...")
        # Run download_fonts.py using virtual environment's python since it contains requests dependency
        subprocess.run([venv_python, "download_fonts.py"], check=True)

def bootstrap_node_project(directory, name):
    node_modules = os.path.join(directory, "node_modules")
    if not os.path.exists(node_modules):
        log_system(f"Installing NPM packages for {name}...")
        # Use shell=True on Windows for npm
        use_shell = (sys.platform == "win32")
        subprocess.run(["npm", "install"], cwd=directory, shell=use_shell, check=True)

# --- Process Execution & Logging ---
active_processes = {}
shutdown_initiated = False

def run_stream_reader(pipe, prefix, color_code):
    """Reads lines from a subprocess pipe and outputs them with a colored prefix."""
    try:
        # bufsize=1 and text=True ensures we get line-buffered string inputs
        for line in iter(pipe.readline, ''):
            if shutdown_initiated:
                break
            if not line:
                continue
            stripped = line.rstrip('\r\n')
            # 36=Cyan (Backend), 32=Green (Frontend), 35=Magenta (Remotion)
            sys.stdout.write(f"\033[{color_code}m{prefix}\033[0m {stripped}\n")
            sys.stdout.flush()
    except Exception:
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass

def spawn_service(name, cmd, cwd, prefix, color_code):
    """Spawns a subprocess and starts a reader thread for its output."""
    log_system(f"Launching {name}...")
    use_shell = (sys.platform == "win32")
    
    # On Windows, we create a new process group to allow clean termination of child processes
    creation_flags = 0
    if sys.platform == "win32":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        shell=use_shell,
        creationflags=creation_flags
    )
    
    active_processes[name] = proc
    
    # Start output streaming thread
    t = threading.Thread(
        target=run_stream_reader, 
        args=(proc.stdout, prefix, color_code), 
        daemon=True
    )
    t.start()

def terminate_all_services():
    """Cleanly shuts down all running child processes, dealing with Windows-specific process tree complexities."""
    global shutdown_initiated
    if shutdown_initiated:
        return
    shutdown_initiated = True
    
    log_system("Initiating graceful shutdown of all active services...")
    
    for name, proc in list(active_processes.items()):
        pid = proc.pid
        if proc.poll() is None: # Still running
            log_system(f"Sending termination signal to {name} (PID {pid})...")
            if sys.platform == "win32":
                # On Windows, taskkill /F /T kills the entire process group tree cleanly
                try:
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(pid)], 
                        stdout=subprocess.DEVNULL, 
                        stderr=subprocess.DEVNULL
                    )
                    log_system(f"Successfully stopped {name} and its child process tree via taskkill.")
                except Exception as e:
                    log_system(f"Taskkill failed for {name}. Attempting fallback basic termination...")
                    proc.terminate()
            else:
                # Unix termination
                try:
                    proc.terminate()
                    proc.wait(timeout=3)
                    log_system(f"Successfully stopped {name} (PID {pid}) cleanly.")
                except subprocess.TimeoutExpired:
                    log_system(f"Warning: {name} (PID {pid}) did not stop within 3 seconds. Force-killing...")
                    proc.kill()
                    log_system(f"Force-killed {name} successfully.")
        else:
            log_system(f"{name} (PID {pid}) has already stopped.")
            
    log_system("\033[32mAll services successfully stopped. Clean exit.\033[0m")

def handle_signal(sig, frame):
    log_system("Interruption signal received.")
    terminate_all_services()
    sys.exit(0)

# --- Main Entry Point ---
def main():
    enable_colors()
    
    # Setup Signal Handlers
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    target = "all"
    if len(sys.argv) > 1:
        target = sys.argv[1].lower()
        if target not in ["all", "backend", "frontend", "remotion"]:
            log_error(f"Unknown target: '{target}'. Available targets: all, backend, frontend, remotion")
            sys.exit(1)

    # 1. Dependency and Environment Checks
    check_dependencies()
    
    # 2. Bootstrapping
    venv_python = bootstrap_backend()
    
    if target in ["all", "frontend"]:
        bootstrap_fonts(venv_python)
        bootstrap_node_project("frontend", "Frontend")
        
    if target in ["all", "remotion"]:
        bootstrap_fonts(venv_python)
        bootstrap_node_project("remotion_engine", "Remotion Engine")

    # 3. Execution Commands Configuration
    use_shell = (sys.platform == "win32")
    
    # Run uvicorn via python -m uvicorn to ensure it runs within the virtualenv context
    # and to bypass shebang path limits/relocation issues on all operating systems.
    backend_cmd = [
        venv_python, "-m", "uvicorn", "main:app", 
        "--env-file", ".env", 
        "--host", "0.0.0.0", 
        "--port", "8000", 
        "--reload"
    ]
    
    # NPM dev commands
    frontend_cmd = ["npm", "run", "dev"]
    remotion_cmd = ["npm", "run", "preview"]

    # 4. Spawn Active Services
    log_system(f"Starting services in target mode: '{target}'")
    
    try:
        if target in ["all", "backend"]:
            spawn_service("Backend", backend_cmd, "backend", "[BACKEND]", "36") # Cyan
            
        if target in ["all", "frontend"]:
            spawn_service("Frontend", frontend_cmd, "frontend", "[FRONTEND]", "32") # Green
            
        if target in ["all", "remotion"]:
            spawn_service("Remotion Studio", remotion_cmd, "remotion_engine", "[REMOTION]", "35") # Magenta

        log_system("All requested services launched! Press Ctrl+C to terminate.")

        # Keep main thread alive and monitor processes for unexpected crashes
        while True:
            time.sleep(0.5)
            for name, proc in list(active_processes.items()):
                ret = proc.poll()
                if ret is not None:
                    log_system(f"\033[31mProcess {name} exited unexpectedly with code {ret}.\033[0m")
                    raise KeyboardInterrupt
                    
    except KeyboardInterrupt:
        log_system("Shutting down...")
    finally:
        terminate_all_services()

if __name__ == "__main__":
    main()
