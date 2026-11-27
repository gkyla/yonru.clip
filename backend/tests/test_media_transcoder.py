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


def test_probe_video_caches_repeated_probes_and_invalidates_on_file_change(tmp_path):
    adapter = FakeMediaAdapter(default_duration=42.0, default_width=1920, default_height=1080, default_fps=30.0)
    transcoder = MediaTranscoder(adapter=adapter)

    video_file = tmp_path / "cached.mp4"
    video_file.write_bytes(b"initial bytes")

    specs1 = transcoder.probe_video(str(video_file))
    specs2 = transcoder.probe_video(str(video_file))
    dur = transcoder.get_video_duration(str(video_file))
    res = transcoder.get_video_resolution(str(video_file))

    assert specs1 == specs2
    assert dur == 42.0
    assert res == (1920, 1080)
    probe_calls = [c for c in adapter.calls if c[0] == "ffprobe_info"]
    assert len(probe_calls) == 1

    # Modifying the file size/mtime invalidates the cache key automatically
    video_file.write_bytes(b"updated bytes with different length")
    adapter.probe_overrides[str(video_file)] = {
        "streams": [{"codec_type": "video", "width": 1280, "height": 720, "avg_frame_rate": "24/1"}],
        "format": {"duration": "99.5"}
    }
    specs3 = transcoder.probe_video(str(video_file))
    assert specs3.duration == 99.5
    assert specs3.width == 1280
    assert specs3.height == 720
    assert specs3.fps == 24.0
    probe_calls = [c for c in adapter.calls if c[0] == "ffprobe_info"]
    assert len(probe_calls) == 2

    # Explicit invalidation clears entry for the path
    transcoder.invalidate_probe_cache(str(video_file))
    transcoder.probe_video(str(video_file))
    probe_calls = [c for c in adapter.calls if c[0] == "ffprobe_info"]
    assert len(probe_calls) == 3


def test_probe_video_bypasses_cache_when_file_stat_fails():
    adapter = FakeMediaAdapter()
    transcoder = MediaTranscoder(adapter=adapter)

    transcoder.probe_video("non_existent_virtual_path.mp4")
    transcoder.probe_video("non_existent_virtual_path.mp4")
    probe_calls = [c for c in adapter.calls if c[0] == "ffprobe_info"]
    assert len(probe_calls) == 2


def test_probe_video_falls_back_to_avg_frame_rate_when_r_frame_rate_zero(tmp_path):
    adapter = FakeMediaAdapter()
    video_file = tmp_path / "vfr.mp4"
    video_file.write_bytes(b"video")
    adapter.probe_overrides[str(video_file)] = {
        "streams": [
            {
                "codec_type": "video",
                "width": 1080,
                "height": 1920,
                "r_frame_rate": "0/0",
                "avg_frame_rate": "2997/100",
                "duration": "10.0"
            }
        ]
    }
    transcoder = MediaTranscoder(adapter=adapter)
    specs = transcoder.probe_video(str(video_file))
    assert specs.fps == 29.97


def test_ffmpeg_availability_and_dynamic_config_store_resolution(tmp_path):
    from core.config_store import InMemoryConfigStore

    unavailable_adapter = FakeMediaAdapter(ffmpeg_available=False)
    transcoder_missing = MediaTranscoder(adapter=unavailable_adapter)
    assert transcoder_missing.resolve_ffmpeg_path() is None
    assert transcoder_missing.is_ffmpeg_available() is False

    available_adapter = FakeMediaAdapter(ffmpeg_available=True, ffmpeg_path="/mock/bin/ffmpeg")
    transcoder_ok = MediaTranscoder(adapter=available_adapter)
    assert transcoder_ok.resolve_ffmpeg_path() == "/mock/bin/ffmpeg"
    assert transcoder_ok.is_ffmpeg_available() is True

    custom_dir = tmp_path / "dynamic_ffmpeg"
    custom_dir.mkdir()
    fake_ffmpeg = custom_dir / "ffmpeg"
    fake_ffmpeg.write_text("#!/bin/sh\n")

    cfg = InMemoryConfigStore({"FFMPEG_PATH": ""})
    sub_adapter = SubprocessMediaAdapter(config_store=cfg)
    assert str(custom_dir) not in sub_adapter._build_env()["PATH"]

    cfg.set("FFMPEG_PATH", str(fake_ffmpeg))
    assert sub_adapter.resolve_ffmpeg_path() == str(fake_ffmpeg)
    assert str(custom_dir) in sub_adapter._build_env()["PATH"]


def test_extract_clip_bundle_single_pass_produces_video_thumb_and_audio(tmp_path):
    adapter = FakeMediaAdapter()
    transcoder = MediaTranscoder(adapter=adapter)

    source_video = tmp_path / "source.mp4"
    source_video.write_text("source video bytes")
    out_video = tmp_path / "clip" / "video.mp4"
    out_thumb = tmp_path / "clip" / "thumbnail.jpg"
    out_audio = tmp_path / "ephemeral_audio.wav"

    result = transcoder.extract_clip_bundle(
        str(source_video),
        start_time=10.0,
        end_time=25.0,
        output_video_path=str(out_video),
        output_thumbnail_path=str(out_thumb),
        output_audio_path=str(out_audio),
    )

    assert result.video_path == str(out_video)
    assert result.thumbnail_path == str(out_thumb)
    assert result.audio_path == str(out_audio)
    assert result.encoder == "libx264"
    assert out_video.exists()
    assert out_thumb.exists()
    assert out_audio.exists()

    ffmpeg_calls = [args for name, args in adapter.calls if name == "run_ffmpeg"]
    ffprobe_calls = [arg for name, arg in adapter.calls if name == "ffprobe_info"]
    assert len(ffmpeg_calls) == 1
    assert len(ffprobe_calls) == 0

    args = ffmpeg_calls[0]
    assert "-accurate_seek" in args
    assert args[args.index("-bf") + 1] == "0"
    assert args[args.index("-avoid_negative_ts") + 1] == "auto"
    assert args[args.index("-movflags") + 1] == "+faststart"
    assert args[args.index("-frames:v") + 1] == "1"
    assert args[args.index("-update") + 1] == "1"
    assert args[args.index("-ar") + 1] == "16000"
    t_indices = [idx for idx, token in enumerate(args) if token == "-t"]
    assert len(t_indices) == 2
    assert all(args[idx + 1] == "15.0" for idx in t_indices)


def test_extract_clip_bundle_hardware_encoder_selection_and_override(tmp_path):
    from core.config_store import InMemoryConfigStore
    from core.hardware_profiler import FakeHardwareMetricsSource, HardwareProfiler

    source_video = tmp_path / "source.mp4"
    source_video.write_text("source")

    cases = [
        ("Darwin", "arm64", "apple_silicon", None, "libx264", ("-preset", "superfast", "-crf", "23", "-bf", "0")),
        ("Darwin", "arm64", "apple_silicon", "videotoolbox", "h264_videotoolbox", ("-q:v", "65", "-bf", "0")),
        ("Darwin", "arm64", "apple_silicon", "force", "h264_videotoolbox", ("-q:v", "65", "-bf", "0")),
        ("Darwin", "x86_64", "cpu", None, "h264_videotoolbox", ("-q:v", "65", "-bf", "0")),
        ("Darwin", "x86_64", "cpu", "disable", "libx264", ("-preset", "superfast", "-crf", "23", "-bf", "0")),
        ("Linux", "x86_64", "cuda", None, "h264_nvenc", ("-preset", "p4", "-cq", "23")),
        ("Linux", "x86_64", "cuda", "disable", "libx264", ("-preset", "superfast", "-crf", "23", "-bf", "0")),
        ("Linux", "x86_64", "cpu", None, "libx264", ("-preset", "superfast", "-crf", "23", "-bf", "0")),
    ]

    for idx, (system_os, cpu_arch, gpu_type, override, expected_codec, expected_tokens) in enumerate(cases):
        adapter = FakeMediaAdapter()
        profiler = HardwareProfiler(
            metrics_source=FakeHardwareMetricsSource(
                system_os=system_os,
                cpu_arch=cpu_arch,
                gpu_type=gpu_type,
            )
        )
        cfg = (
            InMemoryConfigStore({"FFMPEG_HARDWARE_ACCELERATION": override})
            if override is not None
            else None
        )
        transcoder = MediaTranscoder(adapter=adapter, config_store=cfg, hardware_profiler=profiler)
        out_video = tmp_path / f"clip_{idx}.mp4"

        result = transcoder.extract_clip_bundle(str(source_video), 1.0, 5.0, str(out_video))
        assert result.encoder == expected_codec
        call_args = [args for name, args in adapter.calls if name == "run_ffmpeg"][-1]
        assert call_args[call_args.index("-c:v") + 1] == expected_codec
        assert call_args[call_args.index("-pix_fmt") + 1] == "yuv420p"
        for i in range(0, len(expected_tokens), 2):
            flag, val = expected_tokens[i], expected_tokens[i + 1]
            assert call_args[call_args.index(flag) + 1] == val


def test_extract_clip_bundle_retries_once_with_software_on_hardware_failure(tmp_path):
    from core.config_store import InMemoryConfigStore
    from core.hardware_profiler import FakeHardwareMetricsSource, HardwareProfiler

    source_video = tmp_path / "source.mp4"
    source_video.write_text("source")

    scenarios = [
        ("Darwin", "x86_64", "cpu", None),
        ("Darwin", "arm64", "apple_silicon", "videotoolbox"),
    ]

    for idx, (system_os, cpu_arch, gpu_type, override) in enumerate(scenarios):
        out_video = tmp_path / f"out_{idx}.mp4"
        out_thumb = tmp_path / f"thumb_{idx}.jpg"
        out_audio = tmp_path / f"audio_{idx}.wav"

        adapter = FakeMediaAdapter(fail_codecs={"h264_videotoolbox"})
        profiler = HardwareProfiler(
            metrics_source=FakeHardwareMetricsSource(
                system_os=system_os,
                cpu_arch=cpu_arch,
                gpu_type=gpu_type,
            )
        )
        cfg = (
            InMemoryConfigStore({"FFMPEG_HARDWARE_ACCELERATION": override})
            if override is not None
            else None
        )
        transcoder = MediaTranscoder(adapter=adapter, config_store=cfg, hardware_profiler=profiler)

        result = transcoder.extract_clip_bundle(
            str(source_video),
            start_time=0.0,
            end_time=8.0,
            output_video_path=str(out_video),
            output_thumbnail_path=str(out_thumb),
            output_audio_path=str(out_audio),
        )

        ffmpeg_calls = [args for name, args in adapter.calls if name == "run_ffmpeg"]
        assert len(ffmpeg_calls) == 2
        assert ffmpeg_calls[0][ffmpeg_calls[0].index("-c:v") + 1] == "h264_videotoolbox"
        assert ffmpeg_calls[1][ffmpeg_calls[1].index("-c:v") + 1] == "libx264"
        assert result.encoder == "libx264"
        assert out_video.exists()
        assert out_thumb.exists()
        assert out_audio.exists()


def test_extract_clip_bundle_falls_back_without_audio_on_silent_video(tmp_path):
    source_video = tmp_path / "silent.mp4"
    source_video.write_text("silent video")
    out_video = tmp_path / "out.mp4"
    out_thumb = tmp_path / "thumb.jpg"
    out_audio = tmp_path / "audio.wav"

    def fail_on_audio_map(args):
        if "0:a:0" in args:
            raise RuntimeError("Stream map '0:a:0' matches no streams")

    adapter = FakeMediaAdapter(ffmpeg_side_effect=fail_on_audio_map)
    transcoder = MediaTranscoder(adapter=adapter)

    result = transcoder.extract_clip_bundle(
        str(source_video),
        start_time=2.0,
        end_time=6.0,
        output_video_path=str(out_video),
        output_thumbnail_path=str(out_thumb),
        output_audio_path=str(out_audio),
    )

    ffmpeg_calls = [args for name, args in adapter.calls if name == "run_ffmpeg"]
    assert len(ffmpeg_calls) == 2
    assert "0:a:0" in ffmpeg_calls[0]
    assert "0:a:0" not in ffmpeg_calls[1]
    assert result.video_path == str(out_video)
    assert result.thumbnail_path == str(out_thumb)
    assert result.audio_path is None
    assert out_video.exists()
    assert out_thumb.exists()
    assert not out_audio.exists()


def test_extract_frame_skips_ffprobe_at_timestamp_zero(tmp_path):
    adapter = FakeMediaAdapter()
    transcoder = MediaTranscoder(adapter=adapter)

    dummy_video = tmp_path / "clip.mp4"
    dummy_video.write_text("video")
    out_thumb = tmp_path / "thumb.jpg"

    success = transcoder.extract_frame(str(dummy_video), timestamp=0.0, output_path=str(out_thumb))
    assert success is True
    assert out_thumb.exists()

    ffmpeg_calls = [args for name, args in adapter.calls if name == "run_ffmpeg"]
    ffprobe_calls = [arg for name, arg in adapter.calls if name == "ffprobe_info"]
    assert len(ffmpeg_calls) == 1
    assert len(ffprobe_calls) == 0
    assert float(ffmpeg_calls[0][ffmpeg_calls[0].index("-ss") + 1]) == 0.0



