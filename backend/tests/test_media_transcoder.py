import os
import pytest
from core.media_transcoder import (
    MediaTranscoder,
    MediaSpecs,
    FakeMediaAdapter,
    SubprocessMediaAdapter,
    MediaProcessAdapter
)


def test_fake_media_adapter_records_calls_and_returns_defaults(tmp_path):
    adapter = FakeMediaAdapter(default_duration=45.5, default_width=1280, default_height=720, default_fps=24.0)
    transcoder = MediaTranscoder(adapter=adapter)

    dummy_video = tmp_path / "video.mp4"
    dummy_video.write_text("video")

    specs = transcoder.probe_video(str(dummy_video))
    assert specs.duration == 45.5
    assert specs.width == 1280
    assert specs.height == 720
    assert specs.fps == 24.0

    assert transcoder.get_video_duration(str(dummy_video)) == 45.5
    assert transcoder.get_video_resolution(str(dummy_video)) == (1280, 720)
    assert len(adapter.calls) >= 1


def test_extract_frame_clamps_timestamps_and_creates_output(tmp_path):
    adapter = FakeMediaAdapter(default_duration=10.0)
    transcoder = MediaTranscoder(adapter=adapter)

    dummy_video = tmp_path / "clip.mp4"
    dummy_video.write_text("video")
    out_thumb = tmp_path / "output" / "thumbnail.jpg"

    # Request 25.0s on a 10.0s video -> clamped to 9.9s
    success = transcoder.extract_frame(str(dummy_video), timestamp=25.0, output_path=str(out_thumb))
    assert success is True
    assert out_thumb.exists()

    # Verify clamped timestamp passed to ffmpeg
    last_call = [args for name, args in adapter.calls if name == "run_ffmpeg"][-1]
    ss_idx = last_call.index("-ss")
    assert float(last_call[ss_idx + 1]) == 9.9


def test_extract_frame_returns_false_for_nonexistent_video(tmp_path):
    adapter = FakeMediaAdapter()
    transcoder = MediaTranscoder(adapter=adapter)

    out_thumb = tmp_path / "thumb.jpg"
    success = transcoder.extract_frame(str(tmp_path / "missing.mp4"), timestamp=5.0, output_path=str(out_thumb))
    assert success is False
    assert not out_thumb.exists()


def test_slice_video_validates_boundaries(tmp_path):
    adapter = FakeMediaAdapter()
    transcoder = MediaTranscoder(adapter=adapter)

    dummy_video = tmp_path / "source.mp4"
    dummy_video.write_text("dummy")
    out_clip = tmp_path / "clip.mp4"

    # Invalid boundary: start < 0
    with pytest.raises(ValueError, match="Invalid clip boundaries"):
        transcoder.slice_video(str(dummy_video), start_time=-1.0, end_time=10.0, output_path=str(out_clip))

    # Invalid boundary: end <= start
    with pytest.raises(ValueError, match="Invalid clip boundaries"):
        transcoder.slice_video(str(dummy_video), start_time=10.0, end_time=5.0, output_path=str(out_clip))

    # Valid boundary
    success = transcoder.slice_video(str(dummy_video), start_time=5.0, end_time=15.0, output_path=str(out_clip))
    assert success is True
    assert out_clip.exists()

    last_call = [args for name, args in adapter.calls if name == "run_ffmpeg"][-1]
    assert "-accurate_seek" in last_call
    assert str(dummy_video) in last_call


def test_extract_audio_produces_wav(tmp_path):
    adapter = FakeMediaAdapter()
    transcoder = MediaTranscoder(adapter=adapter)

    dummy_video = tmp_path / "source.mp4"
    dummy_video.write_text("dummy")
    out_audio = tmp_path / "audio_v2.wav"

    res = transcoder.extract_audio(str(dummy_video), str(out_audio))
    assert res == str(out_audio)
    assert out_audio.exists()

    last_call = [args for name, args in adapter.calls if name == "run_ffmpeg"][-1]
    assert "-acodec" in last_call
    assert "pcm_s16le" in last_call
    assert "16000" in last_call


def test_probe_video_handles_fractional_fps(tmp_path):
    adapter = FakeMediaAdapter()
    adapter.probe_overrides["mock.mp4"] = {
        "streams": [
            {
                "codec_type": "video",
                "width": 1920,
                "height": 1080,
                "r_frame_rate": "30000/1001",
                "duration": "12.345"
            }
        ]
    }
    transcoder = MediaTranscoder(adapter=adapter)
    specs = transcoder.probe_video("mock.mp4")
    assert specs.duration == 12.345
    assert specs.width == 1920
    assert specs.height == 1080
    assert specs.fps == 29.97


def test_subprocess_adapter_initialization_with_custom_ffmpeg_path(tmp_path):
    custom_bin = tmp_path / "custom_bin"
    custom_bin.mkdir()
    fake_ffmpeg = custom_bin / "ffmpeg"
    fake_ffmpeg.write_text("#!/bin/sh")

    class DummyConfigStore:
        def get(self, key):
            if key == "FFMPEG_PATH":
                return str(fake_ffmpeg)
            return None

    adapter = SubprocessMediaAdapter(config_store=DummyConfigStore())
    assert str(custom_bin) in adapter._env["PATH"]

