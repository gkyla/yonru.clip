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
    to the injected MockPortSweeper without side-effects.
    """
    mocker.patch("run.log_system")
    
    mock_sweeper = run.MockPortSweeper()
    coordinator = run.ServiceCoordinator("all", sweeper=mock_sweeper)
    
    coordinator.clean_ports()
    
    # Assert that all core Yonru ports are captured by the MockPortSweeper
    assert mock_sweeper.swept_ports == [8000, 3000]


def test_backend_cmd_reload_exclude_no_globs(mocker):
    """
    Regression Test: Ensure backend_cmd does not pass unquoted glob wildcards
    to --reload-exclude, preventing Click/MSVC CRT wildcard expansion crashes on Windows.
    """
    launcher = run.BootstrappedLauncher(target="backend")
    launcher.venv_python = "python"
    
    # Mock all bootstrapping methods to inspect execution configuration
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

