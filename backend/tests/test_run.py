import pytest
import sys
import os

# Dynamic path resolution to root directory where run.py is located
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import run

def test_handle_signal_immunizes_and_shuts_down(mocker):
    """
    TDD Test: Verify that handle_signal immediately ignores subsequent
    SIGINT/SIGTERM signals to protect cleanup, calls coordinator.shutdown,
    and cleanly exits sys.exit(0).
    """
    # 1. Mock the signal registration module
    mock_signal = mocker.patch("run.signal.signal")
    
    # 2. Mock coordinator object and shutdown call
    mock_coordinator = mocker.MagicMock()
    mocker.patch("run.coordinator", mock_coordinator)
    
    # 3. Mock sys.exit to prevent terminating pytest itself
    mock_exit = mocker.patch("run.sys.exit")
    
    # 4. Mock print log helper
    mocker.patch("run.log_system")
    
    # 5. Invoke handle_signal (simulating a Ctrl+C input)
    run.handle_signal(run.signal.SIGINT, None)
    
    # Assertions:
    # A. Must call signal.signal(SIGINT, SIG_IGN) and signal.signal(SIGTERM, SIG_IGN)
    mock_signal.assert_any_call(run.signal.SIGINT, run.signal.SIG_IGN)
    mock_signal.assert_any_call(run.signal.SIGTERM, run.signal.SIG_IGN)
    
    # B. Must trigger the full shutdown routine via coordinator
    mock_coordinator.shutdown.assert_called_once()
    
    # C. Must exit cleanly with 0
    mock_exit.assert_called_once_with(0)


def test_service_coordinator_spawn_and_shutdown(mocker):
    """
    Test ServiceCoordinator spawning and shutdown logic using mocked subprocesses.
    """
    mocker.patch("run.log_system")
    mock_popen = mocker.patch("run.subprocess.Popen")
    
    coordinator = run.ServiceCoordinator("backend")
    service = run.ServiceDef(
        name="Backend",
        cmd=["mock"],
        cwd=".",
        prefix="[MOCK]",
        color_code="36",
        ready_signal="ready"
    )
    
    mock_proc = mock_popen.return_value
    mock_proc.stdout.readline.return_value = ""
    mock_proc.poll.return_value = None  # Still running
    mock_proc.pid = 1234
    
    coordinator.spawn(service)
    assert "Backend" in coordinator._procs
    
    # Verify Popen called correctly
    mock_popen.assert_called_once()
    
    # Test shutdown triggers termination cleanly on Windows and Unix
    if run.IS_WIN:
        mock_sub_run = mocker.patch("run.subprocess.run")
    else:
        mocker.patch("run.os.killpg")
        mocker.patch("run.os.getpgid", return_value=1234)
    
    coordinator.shutdown()
    assert coordinator._shutdown_initiated is True


def test_service_coordinator_with_mock_sweeper(mocker):
    """
    TDD Test: Verify that ServiceCoordinator clean_ports delegates cleanly
    to the injected MockPortSweeper without side-effects in production mode.
    """
    mocker.patch("run.log_system")
    
    mock_sweeper = run.MockPortSweeper()
    coordinator = run.ServiceCoordinator("all", sweeper=mock_sweeper)
    
    coordinator.clean_ports()
    
    # In production mode (default dev=False), only backend port 8765 is swept
    assert mock_sweeper.swept_ports == [8765]


def test_service_coordinator_clean_ports_dev_mode(mocker):
    """Verify that in dev mode, both backend 8765 and frontend 3765 ports are swept."""
    mocker.patch("run.log_system")
    mock_sweeper = run.MockPortSweeper()
    coordinator = run.ServiceCoordinator("all", sweeper=mock_sweeper, dev=True)
    coordinator.clean_ports()
    assert mock_sweeper.swept_ports == [8765, 3765]


def test_service_coordinator_clean_ports_custom_and_no_sweep(mocker):
    """Verify custom ports and --no-sweep flag behavior."""
    mocker.patch("run.log_system")
    mock_sweeper = run.MockPortSweeper()
    coordinator = run.ServiceCoordinator("all", sweeper=mock_sweeper, dev=True, port=9000, frontend_port=4000)
    coordinator.clean_ports()
    assert mock_sweeper.swept_ports == [9000, 4000]

    mock_sweeper_no_sweep = run.MockPortSweeper()
    coordinator_no_sweep = run.ServiceCoordinator("all", sweeper=mock_sweeper_no_sweep, no_sweep=True)
    coordinator_no_sweep.clean_ports()
    assert mock_sweeper_no_sweep.swept_ports == []


def test_backend_cmd_reload_exclude_no_globs(mocker):
    """
    Regression Test: Ensure backend_cmd does not pass unquoted glob wildcards
    to --reload-exclude in development mode, preventing Click/MSVC CRT wildcard expansion crashes on Windows.
    """
    launcher = run.BootstrappedLauncher(target="backend", dev=True)
    launcher.venv_python = "python"
    
    # Mock all bootstrapping methods to inspect execution configuration
    mocker.patch.object(launcher, "_check_dependencies")
    mocker.patch.object(launcher, "_bootstrap_backend", return_value="python")
    mocker.patch.object(launcher, "_bootstrap_fonts")
    mocker.patch.object(launcher, "_bootstrap_node_project")
    mocker.patch.object(launcher, "_ensure_frontend_build")
    mocker.patch.object(launcher, "_setup_remotion_browser")
    
    spawned_services = []
    mock_coordinator = mocker.MagicMock()
    mock_coordinator.spawn.side_effect = lambda s: spawned_services.append(s)
    mock_coordinator.run_loop.side_effect = KeyboardInterrupt
    mocker.patch("run.ServiceCoordinator", return_value=mock_coordinator)
    
    launcher.run()
    
    assert len(spawned_services) == 1
    backend_service = spawned_services[0]
    cmd = backend_service.cmd
    
    # Find all reload-exclude arguments
    reload_excludes = [
        cmd[i + 1] for i in range(len(cmd) - 1) if cmd[i] == "--reload-exclude"
    ]
    assert len(reload_excludes) >= 2
    for pattern in reload_excludes:
        assert "*" not in pattern, f"Pattern {pattern} contains wildcard * which causes Click glob expansion on Windows"
        assert "?" not in pattern, f"Pattern {pattern} contains wildcard ? which causes Click glob expansion on Windows"


def test_backend_cmd_no_reload_in_production(mocker):
    """
    Verify that in production mode (default dev=False), backend_cmd does NOT include --reload
    or --reload-exclude for optimal performance and zero file-watching overhead.
    """
    launcher = run.BootstrappedLauncher(target="backend", dev=False)
    launcher.venv_python = "python"

    mocker.patch.object(launcher, "_check_dependencies")
    mocker.patch.object(launcher, "_bootstrap_backend", return_value="python")
    mocker.patch.object(launcher, "_bootstrap_fonts")
    mocker.patch.object(launcher, "_bootstrap_node_project")
    mocker.patch.object(launcher, "_ensure_frontend_build")
    mocker.patch.object(launcher, "_setup_remotion_browser")

    spawned_services = []
    mock_coordinator = mocker.MagicMock()
    mock_coordinator.spawn.side_effect = lambda s: spawned_services.append(s)
    mock_coordinator.run_loop.side_effect = KeyboardInterrupt
    mocker.patch("run.ServiceCoordinator", return_value=mock_coordinator)

    launcher.run()

    assert len(spawned_services) == 1
    cmd = spawned_services[0].cmd
    assert "--reload" not in cmd
    assert "--reload-exclude" not in cmd


def test_production_mode_spawns_single_backend_service(mocker):
    """
    Verify that in production mode (target='all', dev=False), only the Backend service
    is spawned because FastAPI serves the frontend SPA static build directly.
    """
    launcher = run.BootstrappedLauncher(target="all", dev=False)
    launcher.venv_python = "python"

    mocker.patch.object(launcher, "_check_dependencies")
    mocker.patch.object(launcher, "_bootstrap_backend", return_value="python")
    mocker.patch.object(launcher, "_bootstrap_fonts")
    mocker.patch.object(launcher, "_ensure_frontend_build")
    mocker.patch.object(launcher, "_bootstrap_node_project")
    mocker.patch.object(launcher, "_setup_remotion_browser")

    spawned_services = []
    mock_coordinator = mocker.MagicMock()
    mock_coordinator.spawn.side_effect = lambda s: spawned_services.append(s)
    mock_coordinator.run_loop.side_effect = KeyboardInterrupt
    mocker.patch("run.ServiceCoordinator", return_value=mock_coordinator)

    launcher.run()

    assert len(spawned_services) == 1
    assert spawned_services[0].name == "Backend"


def test_dev_mode_spawns_both_services(mocker):
    """
    Verify that in development mode (target='all', dev=True), both Backend and Frontend
    services are spawned to enable Vite HMR.
    """
    launcher = run.BootstrappedLauncher(target="all", dev=True)
    launcher.venv_python = "python"

    mocker.patch.object(launcher, "_check_dependencies")
    mocker.patch.object(launcher, "_bootstrap_backend", return_value="python")
    mocker.patch.object(launcher, "_bootstrap_fonts")
    mocker.patch.object(launcher, "_bootstrap_node_project")
    mocker.patch.object(launcher, "_setup_remotion_browser")

    spawned_services = []
    mock_coordinator = mocker.MagicMock()
    mock_coordinator.spawn.side_effect = lambda s: spawned_services.append(s)
    mock_coordinator.run_loop.side_effect = KeyboardInterrupt
    mocker.patch("run.ServiceCoordinator", return_value=mock_coordinator)

    launcher.run()

    assert len(spawned_services) == 2
    service_names = [s.name for s in spawned_services]
    assert "Backend" in service_names
    assert "Frontend" in service_names
    frontend_service = next(s for s in spawned_services if s.name == "Frontend")
    assert frontend_service.env == {
        "PORT": "3765",
        "NUXT_PUBLIC_API_BASE": "http://localhost:8765"
    }



def test_bootstrap_node_project_opportunistic_bun(mocker, tmp_path):
    """Verify that _bootstrap_node_project uses bun install when bun is available."""
    mocker.patch("run.log_system")
    mock_sub_run = mocker.patch("run.subprocess.run")

    target_dir = tmp_path / "frontend"
    target_dir.mkdir()

    launcher = run.BootstrappedLauncher(target="frontend")
    mocker.patch.object(launcher, "_find_bun", return_value="/usr/local/bin/bun")
    launcher._bootstrap_node_project(str(target_dir), "Frontend")

    mock_sub_run.assert_called_once_with(
        ["/usr/local/bin/bun", "install"], cwd=str(target_dir), shell=run.IS_WIN, check=True
    )


def test_bootstrap_node_project_fallback_npm(mocker, tmp_path):
    """Verify that _bootstrap_node_project falls back to npm install when bun is not available."""
    mocker.patch("run.log_system")
    mock_sub_run = mocker.patch("run.subprocess.run")

    target_dir = tmp_path / "frontend"
    target_dir.mkdir()

    launcher = run.BootstrappedLauncher(target="frontend")
    mocker.patch.object(launcher, "_find_bun", return_value=None)
    launcher._bootstrap_node_project(str(target_dir), "Frontend")

    mock_sub_run.assert_called_once_with(
        ["npm", "install"], cwd=str(target_dir), shell=run.IS_WIN, check=True
    )


def test_bootstrap_backend_opportunistic_uv(mocker):
    """Verify that _bootstrap_backend uses uv pip install when uv is available."""
    mocker.patch("run.log_system")
    mocker.patch("run.os.path.exists", return_value=True)
    mocker.patch("run.shutil.rmtree")
    mocker.patch("builtins.open", mocker.mock_open(read_data="home = /fake/path\nbackend/venv"))
    mock_sub_run = mocker.patch("run.subprocess.run")
    mock_sub_run.return_value.returncode = 0

    launcher = run.BootstrappedLauncher(target="backend")
    mocker.patch.object(launcher, "_find_uv", return_value="/usr/local/bin/uv")
    venv_py = launcher._bootstrap_backend()

    # The last subprocess.run call should be uv pip install
    last_call = mock_sub_run.call_args_list[-1]
    expected_cmd = ["/usr/local/bin/uv", "pip", "install", "--python", venv_py, "-r", "requirements.txt"]
    assert last_call[0][0] == expected_cmd


def test_bootstrap_backend_fallback_pip(mocker):
    """Verify that _bootstrap_backend falls back to pip install when uv is not available."""
    mocker.patch("run.log_system")
    mocker.patch("run.os.path.exists", return_value=True)
    mocker.patch("run.shutil.rmtree")
    mocker.patch("builtins.open", mocker.mock_open(read_data="home = /fake/path\nbackend/venv"))
    mock_sub_run = mocker.patch("run.subprocess.run")
    mock_sub_run.return_value.returncode = 0

    launcher = run.BootstrappedLauncher(target="backend")
    mocker.patch.object(launcher, "_find_uv", return_value=None)
    venv_py = launcher._bootstrap_backend()

    # The last subprocess.run call should be python -m pip install
    last_call = mock_sub_run.call_args_list[-1]
    expected_cmd = [venv_py, "-m", "pip", "install", "-r", "requirements.txt"]
    assert last_call[0][0] == expected_cmd


def test_bootstrap_backend_skips_when_hash_matches(mocker):
    """Verify that _bootstrap_backend completely skips pip/uv verification when requirements hash matches."""
    mocker.patch("run.log_system")
    mocker.patch("run.os.path.exists", return_value=True)
    fake_hash = "abc123hash"
    venv_dir = os.path.abspath("backend/venv")
    
    file_map = {
        "pyvenv.cfg": f"home = /fake/path\n{venv_dir}",
        "requirements.txt": b"fastapi\n",
        ".requirements.hash": fake_hash,
    }

    def fake_open(filename, *args, **kwargs):
        for key, val in file_map.items():
            if key in str(filename):
                return mocker.mock_open(read_data=val)()
        return mocker.mock_open(read_data="")()

    mocker.patch("run.hashlib.sha256", return_value=mocker.MagicMock(hexdigest=lambda: fake_hash))
    mocker.patch("builtins.open", fake_open)
    mock_sub_run = mocker.patch("run.subprocess.run")
    mock_sub_run.return_value.returncode = 0

    launcher = run.BootstrappedLauncher(target="backend")
    launcher._bootstrap_backend()

    # Subprocess run should only be called for python --version check, never for pip or uv install
    for call in mock_sub_run.call_args_list:
        cmd = call[0][0]
        assert "pip" not in cmd, f"Expected pip not to be invoked, but got {cmd}"
        assert "install" not in cmd, f"Expected install not to be invoked, but got {cmd}"


def test_ensure_frontend_build_skips_when_hash_matches(mocker, tmp_path):
    """Verify that _ensure_frontend_build skips build execution when sentinel hash matches and index exists."""
    mocker.patch("run.log_system")
    mock_sub_run = mocker.patch("run.subprocess.run")

    frontend_dir = tmp_path / "frontend"
    output_dir = frontend_dir / ".output" / "public"
    output_dir.mkdir(parents=True)
    (output_dir / "index.html").write_text("ok")
    sentinel = frontend_dir / ".output" / ".build.hash"
    fake_hash = "hash_123"
    sentinel.write_text(fake_hash)

    launcher = run.BootstrappedLauncher(target="all", dev=False)
    mocker.patch.object(launcher, "_compute_frontend_hash", return_value=fake_hash)
    mocker.patch("os.path.abspath", return_value=str(frontend_dir))

    launcher._ensure_frontend_build()

    # Should not call subprocess.run for npm run generate
    for call in mock_sub_run.call_args_list:
        cmd = call[0][0]
        assert "generate" not in cmd


def test_ensure_frontend_build_triggers_when_hash_differs(mocker, tmp_path):
    """Verify that _ensure_frontend_build executes npm run generate when sentinel hash differs."""
    mocker.patch("run.log_system")
    mock_sub_run = mocker.patch("run.subprocess.run")
    mocker.patch.object(run.BootstrappedLauncher, "_bootstrap_node_project")

    frontend_dir = tmp_path / "frontend"
    output_dir = frontend_dir / ".output" / "public"
    output_dir.mkdir(parents=True)
    (output_dir / "index.html").write_text("ok")
    sentinel = frontend_dir / ".output" / ".build.hash"
    sentinel.write_text("old_hash")

    launcher = run.BootstrappedLauncher(target="all", dev=False)
    mocker.patch.object(launcher, "_compute_frontend_hash", return_value="new_hash")
    mocker.patch("os.path.abspath", return_value=str(frontend_dir))

    launcher._ensure_frontend_build()

    # Must invoke npm run generate
    assert mock_sub_run.call_count >= 1
    generate_called = any("generate" in call[0][0] for call in mock_sub_run.call_args_list)
    assert generate_called is True
    assert sentinel.read_text() == "new_hash"


def test_service_coordinator_get_browser_url():
    """
    TDD Test: Verify URL resolution across production, dev, and backend-only targets.
    """
    # 1. Production mode (default port 8765)
    coord_prod = run.ServiceCoordinator("all", dev=False)
    assert coord_prod.get_browser_url() == "http://localhost:8765"

    # 2. Dev mode (default frontend port 3765)
    coord_dev = run.ServiceCoordinator("all", dev=True)
    assert coord_dev.get_browser_url() == "http://localhost:3765"

    # 3. Custom ports
    coord_custom = run.ServiceCoordinator("all", dev=True, port=9000, frontend_port=4000)
    assert coord_custom.get_browser_url() == "http://localhost:4000"

    # 4. Backend-only target: must return None (headless API)
    coord_backend = run.ServiceCoordinator("backend", dev=False)
    assert coord_backend.get_browser_url() is None

    coord_backend_dev = run.ServiceCoordinator("backend", dev=True)
    assert coord_backend_dev.get_browser_url() is None


def test_service_coordinator_opens_browser_on_ready_once(mocker):
    """
    TDD Test: Verify that ServiceCoordinator delegates to browser_opener.open_url
    exactly once when services report ready.
    """
    mocker.patch("run.log_system")
    mocker.patch("run.print_dashboard")
    mock_opener = run.MockBrowserOpener()

    coordinator = run.ServiceCoordinator(
        "all", 
        browser_opener=mock_opener, 
        dev=False, 
        port=8765
    )
    
    coordinator._on_services_ready()

    assert mock_opener.opened_urls == ["http://localhost:8765"]
    assert coordinator._dashboard_printed is True

    # Calling it a second time should be a no-op (idempotent / only once)
    coordinator._on_services_ready()
    assert mock_opener.opened_urls == ["http://localhost:8765"]


def test_service_coordinator_backend_target_does_not_open_browser(mocker):
    """
    TDD Test: Verify that backend-only target does not trigger browser opening.
    """
    mocker.patch("run.log_system")
    mocker.patch("run.print_dashboard")
    mock_opener = run.MockBrowserOpener()

    coordinator = run.ServiceCoordinator(
        "backend", 
        browser_opener=mock_opener, 
        dev=False
    )
    coordinator._on_services_ready()

    assert mock_opener.opened_urls == []


def test_os_browser_opener_graceful_handling(mocker):
    """
    TDD Test: Verify OSBrowserOpener delegates to webbrowser.open_new_tab in a thread
    and handles exceptions gracefully without raising.
    """
    mocker.patch("run.log_system")
    mock_webbrowser = mocker.patch("webbrowser.open_new_tab")
    
    opener = run.OSBrowserOpener()
    success = opener.open_url("http://localhost:8765")
    assert success is True


def test_bootstrapped_launcher_passes_browser_opener_to_coordinator(mocker):
    """
    Verify that BootstrappedLauncher propagates browser_opener to ServiceCoordinator on run.
    """
    mock_opener = run.MockBrowserOpener()
    launcher = run.BootstrappedLauncher(target="all", dev=False, browser_opener=mock_opener)
    launcher.venv_python = "python"

    mocker.patch.object(launcher, "_check_dependencies")
    mocker.patch.object(launcher, "_bootstrap_backend", return_value="python")
    mocker.patch.object(launcher, "_bootstrap_fonts")
    mocker.patch.object(launcher, "_ensure_frontend_build")
    mocker.patch.object(launcher, "_bootstrap_node_project")
    mocker.patch.object(launcher, "_setup_remotion_browser")

    mock_coord_cls = mocker.patch("run.ServiceCoordinator")
    mock_instance = mock_coord_cls.return_value
    mock_instance.run_loop.side_effect = KeyboardInterrupt

    launcher.run()

    mock_coord_cls.assert_called_once()
    assert mock_coord_cls.call_args.kwargs.get("browser_opener") is mock_opener




