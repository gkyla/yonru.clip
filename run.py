#!/usr/bin/env python3
import os
import sys
import json
import shutil
import socket
import subprocess
import threading
import time
import signal
import hashlib
from abc import ABC, abstractmethod
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

# --- Port Configuration Constants ---
DEFAULT_PORT = 8765
DEFAULT_FRONTEND_PORT = 3765

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

def print_dashboard(target, dev: bool = False, port: int = DEFAULT_PORT, frontend_port: int = DEFAULT_FRONTEND_PORT):
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
    if dev:
        print(" \033[93m[DEVELOPMENT MODE]\033[0m \033[90mHot Module Replacement (HMR) & Reload Active:\033[0m\n")
        if target in ["all", "frontend"]:
            print(f"  • \033[1mWeb App (Frontend):\033[0m  \033[1;36mhttp://localhost:{frontend_port}\033[0m  \033[1;33m👈 🌟 access Yonru UI\033[0m")
        if target in ["all", "backend"]:
            print(f"  • \033[1mAPI Server (Backend):\033[0m \033[1;36mhttp://localhost:{port}\033[0m")
    else:
        print(" \033[92m[PRODUCTION MODE]\033[0m \033[90mSingle-server optimized build active:\033[0m\n")
        print(f"  • \033[1mYonru Studio & API:\033[0m   \033[1;36mhttp://localhost:{port}\033[0m  \033[1;33m👈 🌟 access Yonru UI\033[0m")
        
    print("\033[1;30m ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m")
    print(" \033[90mBackground logs will stream below. Press Ctrl+C to terminate.\033[0m\n")


# --- Process Execution Modeling ---

class ServiceDef:
    def __init__(self, name, cmd, cwd, prefix, color_code, ready_signal, env: dict[str, str] | None = None):
        self.name = name
        self.cmd = cmd
        self.cwd = cwd
        self.prefix = prefix
        self.color_code = color_code
        self.ready_signal = ready_signal
        self.env = env

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


class BrowserOpener(ABC):
    """Seam for opening URLs in the default browser."""
    @abstractmethod
    def open_url(self, url: str) -> bool:
        pass


class OSBrowserOpener(BrowserOpener):
    """Production adapter opening browser tabs via Python's webbrowser standard library."""
    def open_url(self, url: str) -> bool:
        import webbrowser
        try:
            log_system(f"Opening Yonru Studio in your browser: \033[1;36m{url}\033[0m")
            t = threading.Thread(target=webbrowser.open_new_tab, args=(url,), daemon=True)
            t.start()
            return True
        except Exception as e:
            log_system(f"Note: Could not automatically open browser ({e}). Please open {url} manually.")
            return False


class MockBrowserOpener(BrowserOpener):
    """Mock adapter recording opened URLs for testing without opening real browser tabs."""
    def __init__(self):
        self.opened_urls = []

    def open_url(self, url: str) -> bool:
        self.opened_urls.append(url)
        return True


class NoopBrowserOpener(BrowserOpener):
    """Browser opener adapter used under --no-browser (e.g., post-update restarts)."""

    def open_url(self, url: str) -> bool:
        return False


def _resolve_cors_origin(origin: str | None) -> str:
    if not origin:
        return "*"
    parsed = urlparse(origin.strip())
    if parsed.scheme in ("http", "https") and parsed.hostname and parsed.hostname.lower() in ("localhost", "127.0.0.1", "::1"):
        return origin.strip()
    return "*"


def _utc_now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def _atomic_write_json(path: str, payload: dict) -> None:
    """Atomically write JSON payload to disk using write + fsync + replace."""
    parent = os.path.dirname(os.path.abspath(path))
    os.makedirs(parent, exist_ok=True)
    tmp_path = f"{path}.tmp.{os.getpid()}.{threading.get_ident()}"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_path, path)


def _remove_file_if_exists(path: str) -> None:
    if os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass


def _format_update_error(exc: Exception) -> str:
    if isinstance(exc, subprocess.CalledProcessError):
        detail = (exc.stderr or exc.stdout or "").strip()
        if detail:
            return f"{exc} | {detail}"
    return str(exc) or exc.__class__.__name__


def _build_update_steps(
    tag: str,
    dev_mode: bool,
    active_step: str,
    failed_step: str | None = None,
) -> list[dict[str, str]]:
    """Build ordered progress stepper matching SelfUpdateService steps."""
    raw_steps = [
        ("stopping_services", "Stopping services"),
        ("backing_up_prompts", "Preserving local prompts"),
        ("fetching_tags", f"Fetching release tag {tag}"),
        ("merging_tag", f"Updating repository to {tag}"),
        ("installing_dependencies", "Updating dependencies"),
    ]
    if not dev_mode:
        raw_steps.append(("building_frontend", "Building interface"))
    raw_steps.append(("restarting", "Restarting Yonru"))

    steps: list[dict[str, str]] = []
    seen_target = False
    for step_id, label in raw_steps:
        if failed_step and step_id == failed_step:
            status = "failed"
            seen_target = True
        elif not failed_step and step_id == active_step:
            status = "active"
            seen_target = True
        elif not seen_target:
            status = "done"
        else:
            status = "pending"
        steps.append({"id": step_id, "label": label, "status": status})
    return steps


def _wait_port_free(port: int, timeout: float = 5.0) -> None:
    """Wait briefly until a local TCP port stops accepting connections."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.2)
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return
        time.sleep(0.1)


def _reexec_self(argv: list[str]) -> None:
    """Replace the current launcher process (POSIX) or respawn and exit (Windows)."""
    if IS_WIN:
        subprocess.Popen(argv, cwd=os.path.dirname(os.path.abspath(__file__)))
        sys.exit(0)
    os.execv(argv[0], argv)


class _ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


class UpdateStatusHttpServer:
    """Temporary stdlib HTTP server exposing live self-update progress while FastAPI is offline."""

    def __init__(self, port: int, get_status, host: str = "0.0.0.0"):
        self.requested_port = port
        self.host = host
        self._get_status = get_status
        self._httpd: _ReusableThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self.port = port

    def start(self) -> None:
        get_status = self._get_status

        class StatusHandler(BaseHTTPRequestHandler):
            def _send_cors_headers(self) -> None:
                origin = _resolve_cors_origin(self.headers.get("Origin"))
                self.send_header("Access-Control-Allow-Origin", origin)
                if origin != "*":
                    self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.send_header("Cache-Control", "no-store")

            def do_OPTIONS(self) -> None:
                self.send_response(204)
                self._send_cors_headers()
                self.end_headers()

            def do_GET(self) -> None:
                path = urlparse(self.path).path
                if path == "/api/self-update/status":
                    body = json.dumps(get_status()).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(body)
                    return

                body = json.dumps(
                    {"detail": "Yonru is updating and restarting...", "updating": True}
                ).encode("utf-8")
                self.send_response(503)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, format: str, *args) -> None:
                return

        self._httpd = _ReusableThreadingHTTPServer((self.host, self.requested_port), StatusHandler)
        self.port = int(self._httpd.server_address[1])
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        if self._httpd is not None:
            try:
                self._httpd.shutdown()
            except Exception:
                pass
            try:
                self._httpd.server_close()
            except Exception:
                pass
            self._httpd = None
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None


class ServiceCoordinator:
    def __init__(
        self, 
        target: str, 
        sweeper: PortSweeper | None = None, 
        browser_opener: BrowserOpener | None = None,
        dev: bool = False,
        port: int = DEFAULT_PORT,
        frontend_port: int = DEFAULT_FRONTEND_PORT,
        no_sweep: bool = False,
        update_request_file: str | None = None
    ):
        self.target = target
        self.sweeper = sweeper or OSPortSweeper()
        self.browser_opener = browser_opener or OSBrowserOpener()
        self.dev = dev
        self.port = port
        self.frontend_port = frontend_port
        self.no_sweep = no_sweep
        self.update_request_file = update_request_file
        self._procs = {}
        self._shutdown_initiated = False
        self._pending_ready = set()
        self._dashboard_printed = False
        self._lock = threading.Lock()

    def get_browser_url(self) -> str | None:
        """Determines the UI URL to open in the browser based on target and mode."""
        if self.target == "backend":
            return None
        if self.dev:
            return f"http://localhost:{self.frontend_port}"
        return f"http://localhost:{self.port}"

    def _on_services_ready(self):
        """Triggers the dashboard and automatically opens the browser tab exactly once."""
        with self._lock:
            if self._dashboard_printed:
                return
            self._dashboard_printed = True

        print_dashboard(
            self.target, 
            dev=self.dev, 
            port=self.port, 
            frontend_port=self.frontend_port
        )

        url = self.get_browser_url()
        if url:
            self.browser_opener.open_url(url)

        
    def clean_ports(self):
        """Scan and kill any zombie processes listening on core Yonru ports to ensure self-healing boots."""
        if self.no_sweep:
            log_system("Port sweeping skipped (--no-sweep active).")
            return

        ports = []
        if self.target in ["all", "backend"] or not self.dev:
            ports.append(self.port)
        if self.dev and self.target in ["all", "frontend"]:
            ports.append(self.frontend_port)

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
                        should_notify = False
                        with self._lock:
                            if service.name in self._pending_ready:
                                self._pending_ready.remove(service.name)
                                if not self._pending_ready:
                                    should_notify = True
                        if should_notify:
                            self._on_services_ready()
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

        env = os.environ.copy()
        if service.env:
            env.update(service.env)

        proc = subprocess.Popen(
            service.cmd,
            cwd=service.cwd,
            env=env,
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

    def _read_update_request(self) -> dict | None:
        if not self.update_request_file or not os.path.isfile(self.update_request_file):
            return None
        try:
            with open(self.update_request_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def run_loop(self):
        """Monitor running processes and handle unexpected exit status or supervised self-update IPC."""
        log_system("All requested services launched! Waiting for initialization...")
        
        def fallback_timer():
            time.sleep(5.0)
            self._on_services_ready()
                    
        threading.Thread(target=fallback_timer, daemon=True).start()

        while True:
            time.sleep(0.25)
            update_req = self._read_update_request()
            if update_req is not None:
                log_system(f"Self-update signal received for {update_req.get('targetTag', 'release')}.")
                return update_req
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
    def __init__(
        self, 
        target: str = "all", 
        force_fonts: bool = False, 
        dev: bool = False, 
        force_build: bool = False,
        port: int = DEFAULT_PORT,
        frontend_port: int = DEFAULT_FRONTEND_PORT,
        no_sweep: bool = False,
        no_browser: bool = False,
        ipc_dir: str | None = None,
        browser_opener: BrowserOpener | None = None
    ):
        self.target = target.lower()
        self.force_fonts = force_fonts
        self.dev = dev
        self.force_build = force_build
        self.port = port
        self.frontend_port = frontend_port
        self.no_sweep = no_sweep
        self.no_browser = no_browser
        self.ipc_dir = os.path.abspath(
            ipc_dir or os.path.join("backend", "temp_assets", "self_update")
        )
        if browser_opener is not None:
            self.browser_opener = browser_opener
        elif no_browser:
            self.browser_opener = NoopBrowserOpener()
        else:
            self.browser_opener = None
        self.coordinator = None
        self.venv_python = None

    def build_reexec_argv(self) -> list[str]:
        """Build CLI argv preserving launcher flags while appending --no-browser."""
        argv = [
            sys.executable,
            os.path.abspath(__file__),
            self.target,
            "--port",
            str(self.port),
            "--frontend-port",
            str(self.frontend_port),
        ]
        if self.dev:
            argv.append("--dev")
        if self.no_sweep:
            argv.append("--no-sweep")
        if self.force_fonts:
            argv.append("--force-fonts")
        argv.append("--no-browser")
        return argv

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

    @staticmethod
    def _find_tool(name, fallback_paths=None):
        found = shutil.which(name)
        if found:
            return found
        if fallback_paths:
            for p in fallback_paths:
                exp = os.path.expanduser(p)
                if os.path.isfile(exp) and os.access(exp, os.X_OK):
                    return exp
        return None

    def _find_uv(self):
        return self._find_tool("uv", ["~/.local/bin/uv", "~/.cargo/bin/uv"])

    def _find_bun(self):
        return self._find_tool("bun", ["~/.bun/bin/bun"])

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
                    
                    if norm_venv_dir in norm_cfg_content or "uv =" in cfg_content:
                        res = subprocess.run([venv_python, "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2)
                        if res.returncode == 0:
                            is_valid_venv = True
            except Exception:
                pass

        uv_bin = self._find_uv()
        if not is_valid_venv:
            log_system("Python virtual environment is missing, moved, or broken. Re-provisioning backend/venv...")
            if os.path.exists(venv_dir):
                try:
                    shutil.rmtree(venv_dir)
                except Exception:
                    pass
            created_venv = False
            if uv_bin:
                try:
                    log_system("uv detected! Rapid-creating backend/venv via uv...")
                    subprocess.run([uv_bin, "venv", "venv"], cwd=backend_dir, shell=IS_WIN, check=True)
                    created_venv = True
                except Exception:
                    pass
            if not created_venv:
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

        req_file = os.path.join(backend_dir, "requirements.txt")
        sentinel_file = os.path.join(venv_dir, ".requirements.hash")

        current_hash = ""
        if os.path.exists(req_file):
            try:
                with open(req_file, "rb") as f:
                    current_hash = hashlib.sha256(f.read()).hexdigest()
            except Exception:
                pass

        stored_hash = ""
        if is_valid_venv and os.path.exists(sentinel_file):
            try:
                with open(sentinel_file, "r", encoding="utf-8") as f:
                    stored_hash = f.read().strip()
            except Exception:
                pass

        need_install = (not is_valid_venv) or (not current_hash) or (current_hash != stored_hash)

        if need_install:
            if uv_bin:
                log_system("uv detected! Rapid-verifying Python dependencies via uv pip...")
                subprocess.run(
                    [uv_bin, "pip", "install", "--python", venv_python, "-r", "requirements.txt"],
                    cwd=backend_dir,
                    shell=IS_WIN,
                    check=True
                )
            else:
                log_system("Verifying Python backend dependencies (this may take a moment)...")
                subprocess.run(
                    [venv_python, "-m", "pip", "install", "-r", "requirements.txt"],
                    cwd=backend_dir,
                    shell=IS_WIN,
                    check=True
                )
            if current_hash and os.path.exists(venv_dir):
                try:
                    with open(sentinel_file, "w", encoding="utf-8") as f:
                        f.write(current_hash)
                except Exception:
                    pass
        return venv_python

    def _bootstrap_fonts(self):
        frontend_font_dir = "frontend/app/assets/fonts"
        remotion_font_dir = "shared/remotion/src/assets/fonts"
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
            log_system("Synchronizing offline fonts to shared/remotion...")
            if os.path.exists(remotion_font_dir):
                try:
                    shutil.rmtree(remotion_font_dir)
                except Exception:
                    pass
            try:
                shutil.copytree(frontend_font_dir, remotion_font_dir)
                log_system("Successfully synchronized offline fonts to shared/remotion.")
            except Exception as e:
                log_error(f"Failed to copy fonts to shared/remotion: {e}")

    @staticmethod
    def _compute_node_deps_hash(directory: str) -> str:
        """Compute deterministic SHA-256 hash of tracked Node manifest files in directory."""
        hasher = hashlib.sha256()
        found = False
        for fname in ("package.json", "package-lock.json"):
            fpath = os.path.join(directory, fname)
            if os.path.isfile(fpath):
                found = True
                hasher.update(fname.encode("utf-8"))
                try:
                    with open(fpath, "rb") as f:
                        hasher.update(f.read())
                except Exception:
                    pass
        return hasher.hexdigest() if found else ""

    @staticmethod
    def _clear_vite_caches(node_modules: str) -> None:
        """Delete Vite pre-bundle caches so Vite rebuilds deps and rotates browserHash."""
        for cache_dir in (
            os.path.join(node_modules, ".cache", "vite"),
            os.path.join(node_modules, ".vite"),
        ):
            if os.path.isdir(cache_dir):
                shutil.rmtree(cache_dir, ignore_errors=True)

    @classmethod
    def _reconcile_node_package_caches(
        cls,
        directory: str,
        node_modules: str,
        *,
        installed_with_bun: bool | None = None,
    ) -> None:
        """Keep one active internal lockfile and clear stale Vite caches after package updates.

        `npm run dev` sets `npm_config_user_agent=npm/...`, which makes Vite read
        `node_modules/.package-lock.json` before `bun.lock`. Removing the older
        lockfile and Vite cache forces Vite to recompute `browserHash` so browsers
        do not pair fresh `.vue` files with old immutable-cached JS chunks.
        """
        npm_hidden_lock = os.path.join(node_modules, ".package-lock.json")
        bun_locks = [
            path
            for path in (
                os.path.join(directory, "bun.lock"),
                os.path.join(directory, "bun.lockb"),
            )
            if os.path.isfile(path)
        ]

        if installed_with_bun is True:
            _remove_file_if_exists(npm_hidden_lock)
            cls._clear_vite_caches(node_modules)
            return

        if installed_with_bun is False:
            for bun_lock in bun_locks:
                _remove_file_if_exists(bun_lock)
            cls._clear_vite_caches(node_modules)
            return

        has_npm_lock = os.path.isfile(npm_hidden_lock)
        if has_npm_lock and bun_locks:
            npm_mtime = os.path.getmtime(npm_hidden_lock)
            bun_mtime = max(os.path.getmtime(p) for p in bun_locks)
            if bun_mtime >= npm_mtime:
                _remove_file_if_exists(npm_hidden_lock)
            else:
                for bun_lock in bun_locks:
                    _remove_file_if_exists(bun_lock)
            cls._clear_vite_caches(node_modules)
            return

        vite_metadata = os.path.join(
            node_modules, ".cache", "vite", "client", "deps", "_metadata.json"
        )
        if os.path.isfile(vite_metadata):
            active_locks = ([npm_hidden_lock] if has_npm_lock else []) + bun_locks
            if active_locks and max(os.path.getmtime(p) for p in active_locks) > os.path.getmtime(vite_metadata):
                cls._clear_vite_caches(node_modules)

    def _bootstrap_node_project(self, directory, name):
        node_modules = os.path.join(directory, "node_modules")
        sentinel_file = os.path.join(node_modules, ".deps.hash")
        current_hash = self._compute_node_deps_hash(directory)

        stored_hash = ""
        if os.path.exists(node_modules) and os.path.isfile(sentinel_file):
            try:
                with open(sentinel_file, "r", encoding="utf-8") as f:
                    stored_hash = f.read().strip()
            except Exception:
                pass

        need_install = (not os.path.exists(node_modules)) or (
            bool(current_hash) and current_hash != stored_hash
        )
        if not need_install:
            self._reconcile_node_package_caches(directory, node_modules)
            return

        bun_bin = self._find_bun()
        if bun_bin:
            log_system(f"Bun detected! Rapid-installing packages for {name} via bun...")
            cmd = [bun_bin, "install"]
        else:
            log_system(f"Installing packages for {name} via npm (tip: install Bun for 10x faster installs)...")
            cmd = ["npm", "install"]
        subprocess.run(cmd, cwd=directory, shell=IS_WIN, check=True)
        self._reconcile_node_package_caches(
            directory, node_modules, installed_with_bun=bool(bun_bin)
        )

        if current_hash and os.path.isdir(node_modules):
            try:
                with open(sentinel_file, "w", encoding="utf-8") as f:
                    f.write(current_hash)
            except Exception as e:
                log_system(f"Warning: Failed to write Node dependency hash sentinel for {name}: {e}")

    def _setup_remotion_browser(self):
        log_system("Verifying Remotion browser configuration (Chrome Headless Shell)...")
        remotion_dir = os.path.abspath("shared/remotion")
        bin_name = "remotion.cmd" if IS_WIN else "remotion"
        local_bin = os.path.join(remotion_dir, "node_modules", ".bin", bin_name)

        if os.path.isfile(local_bin):
            cmd = [local_bin, "browser", "ensure"]
        else:
            npx_bin = "npx.cmd" if IS_WIN else "npx"
            cmd = [npx_bin, "--package=@remotion/cli", "remotion", "browser", "ensure"]

        try:
            subprocess.run(
                cmd, 
                cwd=remotion_dir, 
                shell=IS_WIN, 
                check=True
            )
            log_system("Remotion browser check complete.")
        except Exception as e:
            log_system(f"\033[33m[WARNING] Remotion browser verification failed: {e}. Proceeding...\033[0m")

    def _compute_frontend_hash(self, frontend_dir: str) -> str:
        """
        Computes a deterministic hash of frontend source files, configurations,
        and dependencies to trigger smart production builds only when changes occur.
        """
        hasher = hashlib.sha256()

        # 1. Configuration & Dependency files
        for fname in ["package.json", "package-lock.json", "nuxt.config.ts"]:
            fpath = os.path.join(frontend_dir, fname)
            if os.path.isfile(fpath):
                hasher.update(fname.encode("utf-8"))
                try:
                    with open(fpath, "rb") as f:
                        hasher.update(f.read())
                except Exception:
                    pass

        # 2. Source directories: app/ and public/
        for subdir in ["app", "public"]:
            dir_path = os.path.join(frontend_dir, subdir)
            if os.path.isdir(dir_path):
                file_entries = []
                for root, _, files in os.walk(dir_path):
                    for file in files:
                        full_p = os.path.join(root, file)
                        rel_p = os.path.relpath(full_p, frontend_dir)
                        try:
                            st = os.stat(full_p)
                            file_entries.append((rel_p, st.st_size, st.st_mtime))
                        except Exception:
                            pass
                file_entries.sort()
                for rel_p, size, mtime in file_entries:
                    hasher.update(f"{rel_p}:{size}:{mtime}".encode("utf-8"))

        return hasher.hexdigest()

    def _ensure_frontend_build(self):
        """
        Ensures the production SPA bundle exists in frontend/.output/public.
        Rebuilds if .output/public is missing, hash sentinel differs, or force_build is True.
        """
        frontend_dir = os.path.abspath("frontend")
        output_dir = os.path.join(frontend_dir, ".output", "public")
        index_file = os.path.join(output_dir, "index.html")
        sentinel_file = os.path.join(frontend_dir, ".output", ".build.hash")

        current_hash = self._compute_frontend_hash(frontend_dir)
        stored_hash = ""
        if os.path.exists(sentinel_file):
            try:
                with open(sentinel_file, "r", encoding="utf-8") as f:
                    stored_hash = f.read().strip()
            except Exception:
                pass

        build_needed = (
            self.force_build
            or (not os.path.exists(index_file))
            or (not stored_hash)
            or (stored_hash != current_hash)
        )

        if build_needed:
            log_system("Frontend production bundle missing or changes detected. Building frontend...")
            self._bootstrap_node_project(frontend_dir, "Frontend")
            cmd = ["npm", "run", "generate"]
            log_system("Executing 'npm run generate' under Node.js LTS...")
            subprocess.run(cmd, cwd=frontend_dir, shell=IS_WIN, check=True)

            try:
                os.makedirs(os.path.dirname(sentinel_file), exist_ok=True)
                with open(sentinel_file, "w", encoding="utf-8") as f:
                    f.write(current_hash)
            except Exception as e:
                log_system(f"Warning: Failed to write frontend build hash sentinel: {e}")

            log_system("\033[32mFrontend production bundle generated successfully.\033[0m")
        else:
            log_system("Frontend production bundle is up to date (<1s instant start).")

    def _restore_prompt_backup(self, backup_path: str, prompt_path: str, *, remove_backup: bool = False) -> None:
        if not os.path.isfile(backup_path):
            return
        os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
        shutil.copy2(backup_path, prompt_path)
        if remove_backup:
            _remove_file_if_exists(backup_path)

    def _execute_self_update(
        self,
        update_req: dict,
        repo_root: str | None = None,
        start_status_server: bool = True,
        reexec_fn=None,
    ) -> None:
        """Execute tag fast-forward self-update with prompt backup, temp status HTTP, rollback, and re-exec."""
        root = os.path.abspath(repo_root or os.path.dirname(os.path.abspath(__file__)))
        os.makedirs(self.ipc_dir, exist_ok=True)
        request_path = os.path.join(self.ipc_dir, "request.json")
        status_path = os.path.join(self.ipc_dir, "status.json")
        prompt_path = os.path.join(root, "backend", "prompts", "prompt.json")
        prompt_backup_path = os.path.join(self.ipc_dir, "prompt.json.backup")

        def run_git(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
            res = subprocess.run(
                ["git", *args],
                cwd=root,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            if check and res.returncode != 0:
                detail = (res.stderr or res.stdout or f"git {' '.join(args)} exited with {res.returncode}").strip()
                raise RuntimeError(detail)
            return res

        update_id = str(update_req.get("updateId") or "")
        target_version = str(update_req.get("targetVersion") or "")
        target_tag = str(update_req.get("targetTag") or f"v{target_version}")
        current_version = str(update_req.get("currentVersion") or "")
        initial_commit = str(update_req.get("initialCommit") or "").strip()
        if not initial_commit:
            initial_commit = run_git(["rev-parse", "HEAD"]).stdout.strip()

        status_lock = threading.Lock()
        current_status: dict = {}

        def get_live_status() -> dict:
            with status_lock:
                return dict(current_status)

        def publish_status(
            *,
            state: str,
            step: str,
            message: str,
            rolled_back: bool = False,
            error: str | None = None,
            failed_step: str | None = None,
        ) -> None:
            payload = {
                "updateId": update_id,
                "state": state,
                "step": step,
                "message": message,
                "currentVersion": current_version,
                "targetVersion": target_version,
                "targetTag": target_tag,
                "mode": "dev" if self.dev else "production",
                "initialCommit": initial_commit,
                "rolledBack": rolled_back,
                "error": error,
                "updatedAt": _utc_now_iso(),
                "steps": _build_update_steps(target_tag, self.dev, active_step=step, failed_step=failed_step),
            }
            with status_lock:
                current_status.clear()
                current_status.update(payload)
            _atomic_write_json(status_path, payload)

        status_server: UpdateStatusHttpServer | None = None
        publish_status(
            state="updating",
            step="backing_up_prompts",
            message=f"Preserving local prompts before updating to {target_tag}...",
        )

        if start_status_server:
            _wait_port_free(self.port, timeout=5.0)
            for _ in range(3):
                try:
                    status_server = UpdateStatusHttpServer(self.port, get_status=get_live_status)
                    status_server.start()
                    break
                except OSError:
                    status_server = None
                    time.sleep(0.25)

        active_step = "backing_up_prompts"
        prev_cwd = os.getcwd()
        try:
            # Step 1: Backup prompt.json and reset tracked copy (if any) so fast-forward merge never conflicts
            if os.path.isfile(prompt_path):
                shutil.copy2(prompt_path, prompt_backup_path)
                tracked = run_git(["ls-files", "--error-unmatch", "backend/prompts/prompt.json"], check=False)
                if tracked.returncode == 0:
                    run_git(["checkout", "--", "backend/prompts/prompt.json"])

            # Step 2: Fetch release tags
            active_step = "fetching_tags"
            publish_status(
                state="updating",
                step=active_step,
                message=f"Fetching release tag {target_tag} from origin...",
            )
            run_git(["fetch", "origin", "--tags"])

            # Step 3: Fast-forward current branch to exact release tag and restore user prompts
            active_step = "merging_tag"
            publish_status(
                state="updating",
                step=active_step,
                message=f"Updating repository to {target_tag}...",
            )
            run_git(["merge", "--ff-only", f"refs/tags/{target_tag}"])
            self._restore_prompt_backup(prompt_backup_path, prompt_path)

            # Ensure relative bootstrap/build calls operate against repo root
            if root != prev_cwd:
                os.chdir(root)

            # Step 4: Update Python, font, and Node dependencies
            active_step = "installing_dependencies"
            publish_status(
                state="updating",
                step=active_step,
                message="Updating backend and frontend dependencies...",
            )
            self.venv_python = self._bootstrap_backend()
            if self.target in ["all", "frontend"]:
                self._bootstrap_fonts()
            if self.target in ["all", "backend"]:
                self._bootstrap_node_project("shared/remotion", "Shared Remotion")
            if self.dev and self.target in ["all", "frontend"]:
                self._bootstrap_node_project("frontend", "Frontend")

            # Step 5: Rebuild frontend production SPA when not running dev HMR
            if not self.dev and self.target in ["all", "frontend"]:
                active_step = "building_frontend"
                publish_status(
                    state="updating",
                    step=active_step,
                    message="Building production web interface...",
                )
                self._ensure_frontend_build()

            # Step 6: Handoff back to fresh launcher process with --no-browser
            active_step = "restarting"
            _remove_file_if_exists(prompt_backup_path)
            _remove_file_if_exists(request_path)
            publish_status(
                state="restarting",
                step=active_step,
                message=f"Update to {target_tag} complete. Restarting Yonru...",
            )
        except Exception as exc:
            err_msg = _format_update_error(exc)
            log_error(f"Self-update to {target_tag} failed during '{active_step}': {err_msg}")
            log_system(f"Rolling back repository to {initial_commit[:8]}...")
            run_git(["merge", "--abort"], check=False)
            run_git(["reset", "--hard", initial_commit], check=False)
            self._restore_prompt_backup(prompt_backup_path, prompt_path, remove_backup=True)
            _remove_file_if_exists(request_path)
            publish_status(
                state="failed",
                step=active_step,
                message=f"Update to {target_tag} failed and was rolled back.",
                rolled_back=True,
                error=err_msg,
                failed_step=active_step,
            )
        finally:
            if os.getcwd() != prev_cwd and os.path.isdir(prev_cwd):
                os.chdir(prev_cwd)
            if status_server is not None:
                status_server.stop()

        exec_fn = reexec_fn or _reexec_self
        exec_fn(self.build_reexec_argv())

    def _recover_interrupted_update_ipc(self, request_path: str) -> None:
        """Clear stale request signals and unlock single-flight state if a prior update crashed."""
        _remove_file_if_exists(request_path)
        status_path = os.path.join(self.ipc_dir, "status.json")
        if not os.path.isfile(status_path):
            return
        try:
            with open(status_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            _remove_file_if_exists(status_path)
            return
        if isinstance(data, dict) and data.get("state") in ("pending_restart", "updating"):
            interrupted = {
                **data,
                "state": "failed",
                "rolledBack": False,
                "error": "Previous self-update was interrupted before finishing.",
                "message": "Previous self-update was interrupted before finishing.",
                "updatedAt": _utc_now_iso(),
            }
            _atomic_write_json(status_path, interrupted)

    def run(self):
        global coordinator

        request_path = os.path.join(self.ipc_dir, "request.json")
        self._recover_interrupted_update_ipc(request_path)
        
        # 1. Dependency and Environment Checks
        self._check_dependencies()
        
        # 2. Bootstrapping
        self.venv_python = self._bootstrap_backend()
        
        if self.target in ["all", "frontend"]:
            self._bootstrap_fonts()
            if self.dev:
                self._bootstrap_node_project("frontend", "Frontend")
            else:
                self._ensure_frontend_build()
            
        if self.target in ["all", "backend"]:
            self._bootstrap_node_project("shared/remotion", "Shared Remotion")
            self._setup_remotion_browser()

        # 3. Execution Commands Configuration
        backend_cmd = [
            self.venv_python, "-m", "uvicorn", "main:app", 
            "--env-file", ".env", 
            "--host", "0.0.0.0", 
            "--port", str(self.port)
        ]
        if self.dev:
            backend_cmd.extend([
                "--reload",
                "--reload-exclude", "temp_assets",
                "--reload-exclude", "static"
            ])

        frontend_cmd = ["npm", "run", "dev"]

        backend_env = {
            "YONRU_SUPERVISOR_PID": str(os.getpid()),
            "YONRU_UPDATE_IPC_DIR": self.ipc_dir,
            "YONRU_SUPERVISOR_DEV": "1" if self.dev else "0",
        }

        # 4. Spawn Active Services
        self.coordinator = ServiceCoordinator(
            self.target, 
            browser_opener=self.browser_opener,
            dev=self.dev, 
            port=self.port, 
            frontend_port=self.frontend_port, 
            no_sweep=self.no_sweep,
            update_request_file=request_path
        )
        coordinator = self.coordinator # Maintain global reference for signals and testing
        self.coordinator.clean_ports()
        
        mode_label = "development" if self.dev else "production"
        log_system(f"Starting services in {mode_label} mode (target: '{self.target}')")
        
        update_req = None
        try:
            if self.target in ["all", "backend"]:
                backend_def = ServiceDef(
                    name="Backend",
                    cmd=backend_cmd,
                    cwd="backend",
                    prefix="[BACKEND]",
                    color_code="36",
                    ready_signal="Application startup complete",
                    env=backend_env
                )
                self.coordinator.spawn(backend_def)

            if not self.dev and self.target == "frontend":
                backend_def = ServiceDef(
                    name="Backend",
                    cmd=backend_cmd,
                    cwd="backend",
                    prefix="[SERVER]",
                    color_code="32",
                    ready_signal="Application startup complete",
                    env=backend_env
                )
                self.coordinator.spawn(backend_def)
                
            if self.dev and self.target in ["all", "frontend"]:
                frontend_def = ServiceDef(
                    name="Frontend",
                    cmd=frontend_cmd,
                    cwd="frontend",
                    prefix="[FRONTEND]",
                    color_code="32",
                    ready_signal=["ready in", "local:", "http://localhost"],
                    env={
                        "PORT": str(self.frontend_port),
                        "NUXT_PUBLIC_API_BASE": f"http://localhost:{self.port}"
                    }
                )
                self.coordinator.spawn(frontend_def)

            update_req = self.coordinator.run_loop()
                        
        except KeyboardInterrupt:
            log_system("Shutting down...")
        finally:
            self.coordinator.shutdown()

        if isinstance(update_req, dict) and update_req:
            self._execute_self_update(update_req)


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
        choices=["all", "backend", "frontend", "release"],
        help="Target service to run (all, backend, frontend, release)"
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help=f"Run in development mode (spawns Vite dev server on port {DEFAULT_FRONTEND_PORT} with HMR and Uvicorn on port {DEFAULT_PORT} with reload)"
    )
    parser.add_argument(
        "--build",
        action="store_true",
        help="Force rebuild frontend production bundle"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Backend/production server port (default: {DEFAULT_PORT})"
    )
    parser.add_argument(
        "--frontend-port",
        type=int,
        default=DEFAULT_FRONTEND_PORT,
        help=f"Frontend dev server port in --dev mode (default: {DEFAULT_FRONTEND_PORT})"
    )
    parser.add_argument(
        "--no-sweep",
        action="store_true",
        help="Skip automatic zombie process port sweeping before service boot"
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Skip opening the browser automatically once services are ready"
    )
    parser.add_argument(
        "--force-fonts", 
        action="store_true", 
        help="Force redownload of offline fonts"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Perform a dry run of the release process (no files will be modified)"
    )
    args = parser.parse_args()
    
    if args.target == "release":
        cmd = ["node", "scripts/release.js"]
        if args.dry_run:
            cmd.append("--dry-run")
        try:
            res = subprocess.run(cmd)
            sys.exit(res.returncode)
        except Exception as e:
            log_error(f"Failed to execute release script: {e}")
            sys.exit(1)
            
    launcher = BootstrappedLauncher(
        target=args.target, 
        force_fonts=args.force_fonts,
        dev=args.dev,
        force_build=args.build,
        port=args.port,
        frontend_port=args.frontend_port,
        no_sweep=args.no_sweep,
        no_browser=args.no_browser
    )
    launcher.run()


if __name__ == "__main__":
    main()
