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
        log_error("Node.js (18+) was not detected on this machine.")
        if sys.platform == "win32":
            log_error("To install Node.js on Windows:")
            log_error("  - Download and run the installer from: https://nodejs.org/")
            log_error("  - Or use winget: 'winget install OpenJS.NodeJS'")
        elif sys.platform == "darwin":
            log_error("To install Node.js on macOS:")
            log_error("  - Run: 'brew install node'")
        else:
            log_error("To install Node.js on Linux (Debian/Ubuntu):")
            log_error("  - Run: 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs'")
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
        try:
            subprocess.run([sys.executable, "-m", "venv", "venv"], cwd=backend_dir, check=True)
        except subprocess.CalledProcessError:
            log_error("Failed to create Python virtual environment.")
            if sys.platform != "win32" and sys.platform != "darwin":
                log_error("On Ubuntu/Debian, you may need to install python3-venv first:")
                log_error("  - Run: 'sudo apt install python3-venv'")
            else:
                log_error("Please make sure you have the 'venv' standard module installed in your Python interpreter.")
            sys.exit(1)

    # Check if packages need installation using python -m pip to bypass path / shebang issues
    log_system("Verifying Python backend dependencies (this may take a moment)...")
    subprocess.run([venv_python, "-m", "pip", "install", "-r", "requirements.txt"], cwd=backend_dir, check=True)
    
    return venv_python

def bootstrap_fonts(venv_python, force=False):
    # Check if fonts are downloaded in frontend
    frontend_font_dir = "frontend/app/assets/fonts"
    remotion_font_dir = "remotion_engine/src/assets/fonts"
    fonts_missing = True
    
    if force:
        log_system("Force-redownload flag detected. Deleting existing offline fonts...")
        for path in [frontend_font_dir, remotion_font_dir]:
            if os.path.exists(path):
                try:
                    shutil.rmtree(path)
                    log_system(f"Cleaned {path} directory.")
                except Exception as e:
                    log_error(f"Failed to clean {path} directory: {e}")
                    
    if os.path.exists(frontend_font_dir) and not force:
        # Count woff2 files recursively in frontend
        woff2_count = sum(len([f for f in files if f.endswith('.woff2')]) for r, d, files in os.walk(frontend_font_dir))
        if woff2_count >= 10:
            fonts_missing = False
            
    if fonts_missing:
        log_system("Local offline fonts missing. Downloading automatically...")
        # Run download_fonts.py using virtual environment's python since it contains requests dependency
        subprocess.run([venv_python, "download_fonts.py"], check=True)
        
    # Ensure fonts are synchronized to remotion_engine
    remotion_missing = True
    if os.path.exists(remotion_font_dir):
        woff2_count = sum(len([f for f in files if f.endswith('.woff2')]) for r, d, files in os.walk(remotion_font_dir))
        if woff2_count >= 10:
            remotion_missing = False
            
    if remotion_missing:
        log_system("Synchronizing offline fonts to Remotion Engine...")
        if os.path.exists(remotion_font_dir):
            try:
                shutil.rmtree(remotion_font_dir)
            except Exception:
                pass
        try:
            shutil.copytree(frontend_font_dir, remotion_font_dir)
            log_system("Successfully synchronized offline fonts to Remotion Engine.")
        except Exception as e:
            log_error(f"Failed to copy fonts to Remotion Engine: {e}")


def clear_console():
    """Clears the terminal screen cleanly on all platforms."""
    if sys.platform == "win32":
        os.system("cls")
    else:
        os.system("clear")

def print_dashboard(target):
    """Prints a beautiful neon-lime green Doom-style Yonru.Clip ASCII logo and target-specific entrypoint links."""
    clear_console()
    
    logo = r"""
__   __                      _____ _ _       
\ \ / /                     /  __ \ (_)      
 \ V /___  _ __  _ __ _   _ | /  \/ |_ _ __  
  \ // _ \| '_ \| '__| | | || |   | | | '_ \ 
  | | (_) | | | | |  | |_| || \__/\ | | |_) |
  \_/\___/|_| |_|_|   \__,_(_)____/_|_| .__/ 
                                      | |    
                                      |_|    """
    print(f"\033[92m{logo}\033[0m")

    print("\033[1;30m ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m")
    print(" 🚀 \033[1;32mYonru Clip Studio is active and ready!\033[0m")
    print(" \033[90mAccess the running service components below:\033[0m\n")
    
    if target in ["all", "frontend"]:
        print("  • \033[1mWeb App (Frontend):\033[0m  \033[1;36mhttp://localhost:3000\033[0m  \033[1;33m👈 🌟 access Yonru UI\033[0m")
        
    if target in ["all", "backend"]:
        print("  • \033[1mAPI Server (Backend):\033[0m \033[1;36mhttp://localhost:8000\033[0m")
        
    if target in ["all", "remotion"]:
        print("  • \033[1mStudio (Remotion):\033[0m   \033[1;36mhttp://localhost:3003\033[0m")
        
    print("\033[1;30m ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m")
    print(" \033[90mBackground logs will stream below. Press Ctrl+C to terminate.\033[0m\n")




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
pending_ready_services = set()
dashboard_printed = False
ready_lock = threading.Lock()

def run_stream_reader(pipe, prefix, color_code, name, target):
    """Reads lines from a subprocess pipe and outputs them with a colored prefix. Triggers dashboard when ready."""
    global dashboard_printed
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
            
            # Check for ready pattern if dashboard has not been printed yet
            if not dashboard_printed:
                is_ready = False
                if prefix == "[BACKEND]" and "Application startup complete" in line:
                    is_ready = True
                elif prefix in ["[FRONTEND]", "[REMOTION]"] and ("ready in" in line.lower() or "local:" in line.lower() or "http://localhost" in line):
                    is_ready = True
                    
                if is_ready:
                    with ready_lock:
                        if name in pending_ready_services:
                            pending_ready_services.remove(name)
                            if not pending_ready_services:
                                dashboard_printed = True
                                print_dashboard(target)
    except Exception:
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass

def clean_ports(target):
    """Scan and kill any zombie processes listening on core Yonru ports to ensure self-healing boots."""
    ports = []
    if target in ["all", "backend"]:
        ports.append(8000)
    if target in ["all", "frontend"]:
        ports.append(3000)
    if target in ["all", "remotion"]:
        ports.append(3003)

    log_system("Sweeping ports " + ", ".join(map(str, ports)) + " for any active zombie processes...")
    
    for port in ports:
        if sys.platform == "win32":
            try:
                cmd = f"netstat -ano"
                output = subprocess.check_output(cmd, shell=True).decode(errors="ignore")
                for line in output.splitlines():
                    if f":{port}" in line and "LISTENING" in line:
                        parts = line.strip().split()
                        if parts:
                            pid_str = parts[-1]
                            try:
                                pid = int(pid_str)
                                if pid != os.getpid() and pid > 0:
                                    log_system(f"Terminating zombie process {pid} on port {port}...")
                                    subprocess.run(["taskkill", "/F", "/PID", str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                            except ValueError:
                                pass
            except Exception:
                pass
        else:
            # Unix (macOS / Linux)
            try:
                pids_str = subprocess.check_output(["lsof", "-t", "-i", f":{port}"]).decode().strip()
                if pids_str:
                    pids = pids_str.split()
                    for pid_str in pids:
                        try:
                            pid = int(pid_str)
                            if pid != os.getpid():
                                log_system(f"Terminating zombie process {pid} on port {port}...")
                                os.kill(pid, signal.SIGKILL)
                        except ValueError:
                            pass
            except subprocess.CalledProcessError:
                pass
            except Exception:
                pass

def spawn_service(name, cmd, cwd, prefix, color_code, target):
    """Spawns a subprocess and starts a reader thread for its output."""
    log_system(f"Launching {name}...")
    use_shell = (sys.platform == "win32")
    
    # On Windows, we create a new process group to allow clean termination of child processes
    creation_flags = 0
    if sys.platform == "win32":
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

    preexec = None
    if sys.platform != "win32":
        preexec = os.setsid

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
        creationflags=creation_flags,
        preexec_fn=preexec
    )
    
    active_processes[name] = proc
    
    # Start output streaming thread
    t = threading.Thread(
        target=run_stream_reader, 
        args=(proc.stdout, prefix, color_code, name, target), 
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
                # Unix termination of process group to cleanly kill all children
                try:
                    os.killpg(os.getpgid(pid), signal.SIGTERM)
                    proc.wait(timeout=3)
                    log_system(f"Successfully stopped {name} and its child process group tree cleanly.")
                except subprocess.TimeoutExpired:
                    log_system(f"Warning: {name} (PID {pid}) did not stop within 3 seconds. Force-killing process group...")
                    try:
                        os.killpg(os.getpgid(pid), signal.SIGKILL)
                        proc.wait()
                    except Exception:
                        pass
                    log_system(f"Force-killed process group for {name} successfully.")
                except Exception:
                    try:
                        proc.terminate()
                        proc.wait(timeout=2)
                    except Exception:
                        proc.kill()
        else:
            log_system(f"{name} (PID {pid}) has already stopped.")
            
    log_system("\033[32mAll services successfully stopped. Clean exit.\033[0m")

def handle_signal(sig, frame):
    # Ignore subsequent Ctrl+C signals to protect the shutdown routine from violent interruptions
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    log_system("Interruption signal received. Cleaning up services safely (do not force quit)...")
    terminate_all_services()
    sys.exit(0)

# --- Main Entry Point ---
def main():
    enable_colors()
    
    # Setup Signal Handlers
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    import argparse
    parser = argparse.ArgumentParser(description="Yonru Services Launcher")
    parser.add_argument(
        "target", 
        nargs="?", 
        default="all", 
        choices=["all", "backend", "frontend", "remotion"],
        help="Target service to run (all, backend, frontend, remotion)"
    )
    parser.add_argument(
        "--force-fonts", 
        action="store_true", 
        help="Force redownload of offline fonts"
    )
    args = parser.parse_args()
    
    target = args.target.lower()

    # 1. Dependency and Environment Checks
    check_dependencies()
    
    # 2. Bootstrapping
    venv_python = bootstrap_backend()
    
    if target in ["all", "frontend", "remotion"]:
        bootstrap_fonts(venv_python, force=args.force_fonts)

    if target in ["all", "frontend"]:
        bootstrap_node_project("frontend", "Frontend")
        
    if target in ["all", "remotion"]:
        bootstrap_node_project("remotion_engine", "Remotion Engine")
        
        # Ensure Chrome Headless Shell is downloaded for Remotion
        log_system("Verifying Remotion browser configuration (Chrome Headless Shell)...")
        use_shell = (sys.platform == "win32")
        try:
            subprocess.run(
                ["npx", "remotion", "browser", "ensure"], 
                cwd="remotion_engine", 
                shell=use_shell, 
                check=True
            )
            log_system("Remotion browser check complete.")
        except Exception as e:
            log_system(f"\033[33m[WARNING] Remotion browser verification failed: {e}. Proceeding...\033[0m")



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
    clean_ports(target)
    log_system(f"Starting services in target mode: '{target}'")
    
    # Populate waiting list for dashboard trigger
    active_services = []
    if target in ["all", "backend"]:
        active_services.append("Backend")
    if target in ["all", "frontend"]:
        active_services.append("Frontend")
    if target in ["all", "remotion"]:
        active_services.append("Remotion Studio")
        
    global pending_ready_services
    pending_ready_services = set(active_services)
    
    try:
        if target in ["all", "backend"]:
            spawn_service("Backend", backend_cmd, "backend", "[BACKEND]", "36", target) # Cyan
            
        if target in ["all", "frontend"]:
            spawn_service("Frontend", frontend_cmd, "frontend", "[FRONTEND]", "32", target) # Green
            
        if target in ["all", "remotion"]:
            spawn_service("Remotion Studio", remotion_cmd, "remotion_engine", "[REMOTION]", "35", target) # Magenta

        log_system("All requested services launched! Waiting for initialization...")
        
        # Start a daemon fallback timer (5.0 seconds) to ensure dashboard prints regardless
        def fallback_timer():
            import time
            time.sleep(5.0)
            global dashboard_printed
            with ready_lock:
                if not dashboard_printed:
                    dashboard_printed = True
                    print_dashboard(target)
                    
        threading.Thread(target=fallback_timer, daemon=True).start()



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
