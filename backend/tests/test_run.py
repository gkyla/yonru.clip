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
    
    coordinator.spawn(service)
    assert "Backend" in coordinator._procs
    
    # Verify Popen called correctly
    mock_popen.assert_called_once()
    
    # Test shutdown triggers termination
    mock_proc = mock_popen.return_value
    mock_proc.poll.return_value = None  # Still running
    mock_proc.pid = 1234
    
    mocker.patch("run.os.killpg")
    mocker.patch("run.os.getpgid", return_value=1234)
    
    coordinator.shutdown()
    assert coordinator._shutdown_initiated is True
