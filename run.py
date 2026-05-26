#!/usr/bin/env python3
import os
import sys
import shutil
import subprocess
import threading
import time
import signal
from abc import ABC, abstractmethod

# --- Formatting Helpers ---
IS_WIN = (sys.platform == "win32")

def enable_colors():
    """Enable ANSI escape sequences on Windows 10/11 if applicable."""
    if IS_WIN:
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

def clear_console():
    """Clears the terminal screen cleanly on all platforms."""
    if IS_WIN:
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


# --- Process Execution Modeling ---

class ServiceDef:
    def __init__(self, name, cmd, cwd, prefix, color_code, ready_signal):
        self.name = name
        self.cmd = cmd
        self.cwd = cwd
        self.prefix = prefix
        self.color_code = color_code
        self.ready_signal = ready_signal

class PortSweeper(ABC):
    """Seam for sweeping ports and terminating zombie processes."""
    @abstractmethod
    def clean_ports(self, ports: list[int]) -> None:
        pass


class OSPortSweeper(PortSweeper):
    """Production adapter executing OS shell commands to sweep active ports."""
    def clean_ports(self, ports: list[int]) -> None:
        for port in ports:
            if IS_WIN:
                try:
                    cmd = "netstat -ano"
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


class MockPortSweeper(PortSweeper):
    """Mock adapter recording swept ports without executing OS-level side effects."""
    def __init__(self):
        self.swept_ports = []

    def clean_ports(self, ports: list[int]) -> None:
        self.swept_ports.extend(ports)


class ServiceCoordinator:
    def __init__(self, target, sweeper: PortSweeper = None):
        self.target = target
        self.sweeper = sweeper or OSPortSweeper()
        self._procs = {}
        self._shutdown_initiated = False
        self._pending_ready = set()
        self._dashboard_printed = False
        self._lock = threading.Lock()
        
    def clean_ports(self):
        """Scan and kill any zombie processes listening on core Yonru ports to ensure self-healing boots."""
        ports = []
        if self.target in ["all", "backend"]:
            ports.append(8000)
        if self.target in ["all", "frontend"]:
            ports.append(3000)
        if self.target in ["all", "remotion"]:
            ports.append(3003)

        log_system("Sweeping ports " + ", ".join(map(str, ports)) + " for any active zombie processes...")
        self.sweeper.clean_ports(ports)

    def _stream_reader(self, pipe, service: ServiceDef):
        """Reads lines from a subprocess pipe and outputs them with a colored prefix. Triggers dashboard when ready."""
        try:
            for line in iter(pipe.readline, ''):
                if self._shutdown_initiated:
                    break
                if not line:
                    continue
                stripped = line.rstrip('\r\n')
                sys.stdout.write(f"\033[{service.color_code}m{service.prefix}\033[0m {stripped}\n")
                sys.stdout.flush()
                
                # Check for ready pattern if dashboard has not been printed yet
                if not self._dashboard_printed:
                    is_ready = False
                    if service.ready_signal:
                        signals = [service.ready_signal] if isinstance(service.ready_signal, str) else service.ready_signal
                        is_ready = any(sig in line or sig.lower() in line.lower() for sig in signals)
                        
                    if is_ready:
                        with self._lock:
                            if service.name in self._pending_ready:
                                self._pending_ready.remove(service.name)
                                if not self._pending_ready:
                                    self._dashboard_printed = True
                                    print_dashboard(self.target)
        except Exception:
            pass
        finally:
            try:
                pipe.close()
            except Exception:
                pass

    def spawn(self, service: ServiceDef):
        """Spawns a subprocess and starts a reader thread for its output."""
        log_system(f"Launching {service.name}...")
        
        creation_flags = 0
        if IS_WIN:
            creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

        preexec = None
        if not IS_WIN:
            preexec = os.setsid

        proc = subprocess.Popen(
            service.cmd,
            cwd=service.cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            shell=IS_WIN,
            creationflags=creation_flags,
            preexec_fn=preexec
        )
        
        with self._lock:
            self._procs[service.name] = proc
            self._pending_ready.add(service.name)
        
        t = threading.Thread(
            target=self._stream_reader, 
            args=(proc.stdout, service), 
            daemon=True
        )
        t.start()

    def shutdown(self):
        """Cleanly shuts down all running child processes, dealing with Windows-specific process tree complexities."""
        with self._lock:
            if self._shutdown_initiated:
                return
            self._shutdown_initiated = True
        
        log_system("Initiating graceful shutdown of all active services...")
        
        for name, proc in list(self._procs.items()):
            pid = proc.pid
            if proc.poll() is None: # Still running
                log_system(f"Sending termination signal to {name} (PID {pid})...")
                if IS_WIN:
                    try:
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(pid)], 
                            stdout=subprocess.DEVNULL, 
                            stderr=subprocess.DEVNULL
                        )
                        log_system(f"Successfully stopped {name} and its child process tree via taskkill.")
                    except Exception:
                        proc.terminate()
                else:
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

    def run_loop(self):
        """Monitor running processes and handle unexpected exit status."""
        log_system("All requested services launched! Waiting for initialization...")
        
        def fallback_timer():
            time.sleep(5.0)
            with self._lock:
                if not self._dashboard_printed:
                    self._dashboard_printed = True
                    print_dashboard(self.target)
                    
        threading.Thread(target=fallback_timer, daemon=True).start()

        while True:
            time.sleep(0.5)
            with self._lock:
                procs = list(self._procs.items())
            for name, proc in procs:
                ret = proc.poll()
                if ret is not None:
                    log_system(f"\033[31mProcess {name} exited unexpectedly with code {ret}.\033[0m")
                    raise KeyboardInterrupt


# --- Deep Orchestration Engine ---

class BootstrappedLauncher:
    """
    A deep module that encapsulates Yonru's entire ecosystem lifecycle.
    Hides dependency checking, self-healing virtualenvs, offline font syncing,
    NPM packaging, zombie port sweeping, subprocess orchestration, and signal handling.
    """
    def __init__(self, target: str = "all", force_fonts: bool = False):
        self.target = target.lower()
        self.force_fonts = force_fonts
        self.coordinator = None
        self.venv_python = None

    def _check_dependencies(self):
        log_system("Verifying core dependencies...")

        # 1. Check Node.js
        if not shutil.which("node"):
            log_error("Node.js (18+) was not detected on this machine.")
            if IS_WIN:
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
            if sys.platform.startswith("win") or IS_WIN:
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

    def _bootstrap_backend(self):
        backend_dir = os.path.abspath("backend")
        venv_dir = os.path.join(backend_dir, "venv")
        
        if IS_WIN:
            venv_python = os.path.join(venv_dir, "Scripts", "python.exe")
        else:
            venv_python = os.path.join(venv_dir, "bin", "python")

        env_file = os.path.join(backend_dir, ".env")
        env_example = os.path.join(backend_dir, ".env.example")
        if not os.path.exists(env_file):
            if os.path.exists(env_example):
                log_system("Creating backend/.env from .env.example...")
                shutil.copy2(env_example, env_file)
                log_system("\033[33mACTION REQUIRED: Please open backend/.env and set your GEMINI_API_KEY.\033[0m")
            else:
                log_error("backend/.env is missing and .env.example was not found.")

        is_valid_venv = False
        if os.path.exists(venv_dir) and os.path.exists(venv_python):
            try:
                cfg_path = os.path.join(venv_dir, "pyvenv.cfg")
                if os.path.exists(cfg_path):
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        cfg_content = f.read()
                    
                    norm_venv_dir = os.path.normpath(venv_dir).lower()
                    norm_cfg_content = os.path.normpath(cfg_content).lower()
                    
                    if norm_venv_dir in norm_cfg_content:
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
                if not IS_WIN and sys.platform != "darwin":
                    log_error("On Ubuntu/Debian, you may need to install python3-venv first:")
                    log_error("  - Run: 'sudo apt install python3-venv'")
                else:
                    log_error("Please make sure you have the 'venv' standard module installed in your Python interpreter.")
                sys.exit(1)

        log_system("Verifying Python backend dependencies (this may take a moment)...")
        subprocess.run([venv_python, "-m", "pip", "install", "-r", "requirements.txt"], cwd=backend_dir, check=True)
        return venv_python

    def _bootstrap_fonts(self):
        frontend_font_dir = "frontend/app/assets/fonts"
        remotion_font_dir = "remotion_engine/src/assets/fonts"
        fonts_missing = True
        
        if self.force_fonts:
            log_system("Force-redownload flag detected. Deleting existing offline fonts...")
            for path in [frontend_font_dir, remotion_font_dir]:
                if os.path.exists(path):
                    try:
                        shutil.rmtree(path)
                        log_system(f"Cleaned {path} directory.")
                    except Exception as e:
                        log_error(f"Failed to clean {path} directory: {e}")
                        
        if os.path.exists(frontend_font_dir) and not self.force_fonts:
            woff2_count = sum(len([f for f in files if f.endswith('.woff2')]) for r, d, files in os.walk(frontend_font_dir))
            if woff2_count >= 10:
                fonts_missing = False
                
        if fonts_missing:
            log_system("Local offline fonts missing. Downloading automatically...")
            subprocess.run([self.venv_python, "download_fonts.py"], check=True)
            
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

    def _bootstrap_node_project(self, directory, name):
        node_modules = os.path.join(directory, "node_modules")
        if not os.path.exists(node_modules):
            log_system(f"Installing NPM packages for {name}...")
            subprocess.run(["npm", "install"], cwd=directory, shell=IS_WIN, check=True)

    def _setup_remotion_browser(self):
        log_system("Verifying Remotion browser configuration (Chrome Headless Shell)...")
        try:
            subprocess.run(
                ["npx", "remotion", "browser", "ensure"], 
                cwd="remotion_engine", 
                shell=IS_WIN, 
                check=True
            )
            log_system("Remotion browser check complete.")
        except Exception as e:
            log_system(f"\033[33m[WARNING] Remotion browser verification failed: {e}. Proceeding...\033[0m")

    def run(self):
        global coordinator
        
        # 1. Dependency and Environment Checks
        self._check_dependencies()
        
        # 2. Bootstrapping
        self.venv_python = self._bootstrap_backend()
        
        if self.target in ["all", "frontend", "remotion"]:
            self._bootstrap_fonts()

        if self.target in ["all", "frontend"]:
            self._bootstrap_node_project("frontend", "Frontend")
            
        if self.target in ["all", "remotion"]:
            self._bootstrap_node_project("remotion_engine", "Remotion Engine")
            self._setup_remotion_browser()

        # 3. Execution Commands Configuration
        backend_cmd = [
            self.venv_python, "-m", "uvicorn", "main:app", 
            "--env-file", ".env", 
            "--host", "0.0.0.0", 
            "--port", "8000", 
            "--reload"
        ]
        frontend_cmd = ["npm", "run", "dev"]
        remotion_cmd = ["npm", "run", "preview"]

        # 4. Spawn Active Services
        self.coordinator = ServiceCoordinator(self.target)
        coordinator = self.coordinator # Maintain global reference for signals and testing
        self.coordinator.clean_ports()
        
        log_system(f"Starting services in target mode: '{self.target}'")
        
        try:
            if self.target in ["all", "backend"]:
                backend_def = ServiceDef(
                    name="Backend",
                    cmd=backend_cmd,
                    cwd="backend",
                    prefix="[BACKEND]",
                    color_code="36",
                    ready_signal="Application startup complete"
                )
                self.coordinator.spawn(backend_def)
                
            if self.target in ["all", "frontend"]:
                frontend_def = ServiceDef(
                    name="Frontend",
                    cmd=frontend_cmd,
                    cwd="frontend",
                    prefix="[FRONTEND]",
                    color_code="32",
                    ready_signal=["ready in", "local:", "http://localhost"]
                )
                self.coordinator.spawn(frontend_def)
                
            if self.target in ["all", "remotion"]:
                remotion_def = ServiceDef(
                    name="Remotion Studio",
                    cmd=remotion_cmd,
                    cwd="remotion_engine",
                    prefix="[REMOTION]",
                    color_code="35",
                    ready_signal=["local:", "ready in", "http://localhost"]
                )
                self.coordinator.spawn(remotion_def)

            self.coordinator.run_loop()
                        
        except KeyboardInterrupt:
            log_system("Shutting down...")
        finally:
            self.coordinator.shutdown()


# --- Global Coordinator Instance for Signal Handlers ---
coordinator = None

def handle_signal(sig, frame):
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    log_system("Interruption signal received. Cleaning up services safely (do not force quit)...")
    if coordinator:
        coordinator.shutdown()
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
    
    launcher = BootstrappedLauncher(target=args.target, force_fonts=args.force_fonts)
    launcher.run()


if __name__ == "__main__":
    main()
