import os
import sys
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.youtube_client import MockYouTubeClient, YouTubeClient


def _make_fake_ydl_cls(
    *,
    extract_fn,
    process_fn=None,
    download_fn=None,
    created_opts=None,
):
    class FakeYoutubeDL:
        def __init__(self, opts):
            self.opts = opts
            if created_opts is not None:
                created_opts.append(opts)

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def extract_info(self, target_url, download=True, process=True):
            return extract_fn(self.opts, target_url, download, process)

        def process_ie_result(self, ie_result, download=True):
            if process_fn is None:
                return ie_result
            return process_fn(self.opts, ie_result, download)

        def download(self, urls):
            if download_fn is not None:
                download_fn(self.opts, urls)

    return FakeYoutubeDL


def test_fetch_transcript_normalizes_overlapping_captions_monotonically():
    """Rolling YouTube captions are clamped to prevent overlapping or backward word timestamps."""
    raw_captions = [
        {"start": 0.12, "duration": 3.68, "text": "Yuk sekarang kita mulai"},
        {"start": 1.80, "duration": 3.40, "text": "makannya kita atur"},
        {"start": 3.80, "duration": 2.32, "text": "kalimat terakhir"},
    ]

    mock_transcript = MagicMock()
    mock_transcript.language = "Indonesian"
    mock_transcript.fetch.return_value = raw_captions

    mock_list = MagicMock()
    mock_list.find_transcript.return_value = mock_transcript

    with patch("youtube_transcript_api.YouTubeTranscriptApi") as mock_api_cls:
        mock_api_cls.return_value.list.return_value = mock_list
        words = YouTubeClient().fetch_transcript("video_123")

    assert [w["text"] for w in words] == [
        "Yuk", "sekarang", "kita", "mulai",
        "makannya", "kita", "atur",
        "kalimat", "terakhir",
    ]

    for i, word in enumerate(words):
        assert word["duration"] >= 0.0
        if i > 0:
            prev_end = words[i - 1]["start"] + words[i - 1]["duration"]
            assert word["start"] >= words[i - 1]["start"]
            assert word["start"] >= prev_end - 1e-6

    # First caption's words fit before second caption starts at 1.80s
    assert words[3]["start"] + words[3]["duration"] <= 1.80 + 1e-6
    # Second caption's words start at 1.80s and end before third caption starts at 3.80s
    assert abs(words[4]["start"] - 1.80) < 1e-6
    assert words[6]["start"] + words[6]["duration"] <= 3.80 + 1e-6


def test_get_video_info_fast_passes_noplaylist_returns_duration_and_reuses_cache_across_qualities(tmp_path):
    """One raw extract_info feeds get_video_info_fast + 360p + 1080p even if yt-dlp mutates ie_result."""
    url = "https://www.youtube.com/watch?v=abc123def45"
    raw_ie_result = {
        "id": "abc123def45",
        "title": "Deep Module Talk",
        "channel": "Tech Channel",
        "duration": 185,
        "formats": [{"format_id": "18", "ext": "mp4", "height": 360}],
    }
    created_ydl_opts = []
    extract_calls = []
    process_calls = []
    download_calls = []

    def extract_fn(_opts, target_url, download, process):
        extract_calls.append((target_url, download, process))
        return raw_ie_result

    def process_fn(opts, ie_result, download):
        process_calls.append((download, opts.get("format"), ie_result["formats"][0]["format_id"]))
        # Simulate yt-dlp mutating ie_result in place during download processing
        ie_result["formats"].clear()
        ie_result["requested_formats"] = [{"format_id": "mutated"}]
        return ie_result

    fake_ydl = _make_fake_ydl_cls(
        extract_fn=extract_fn,
        process_fn=process_fn,
        download_fn=lambda _opts, urls: download_calls.append(list(urls)),
        created_opts=created_ydl_opts,
    )

    client = YouTubeClient()
    with patch("core.youtube_client.yt_dlp.YoutubeDL", fake_ydl):
        info = client.get_video_info_fast(url)
        client.download_video(url, str(tmp_path), quality="360p")
        client.download_video(url, str(tmp_path), quality="1080p")

    assert info == {
        "title": "Deep Module Talk",
        "id": "abc123def45",
        "channel": "Tech Channel",
        "duration": 185.0,
    }
    assert extract_calls == [(url, False, False)]
    assert len(process_calls) == 2
    assert process_calls[0][0] is True
    assert process_calls[1][0] is True
    assert download_calls == []
    assert len(created_ydl_opts) == 3
    for opts in created_ydl_opts:
        assert opts.get("noplaylist") is True
        assert "no_playlist" not in opts


def test_download_video_evicts_all_keys_on_corrupt_cache_and_falls_back_to_download(tmp_path):
    """If process_ie_result raises, download_video evicts primary and secondary ID keys and falls back to ydl.download."""
    redirect_url = "https://example.invalid/custom-redirect"
    canonical_url = "https://www.youtube.com/watch?v=abc123def45"
    raw_ie_result = {
        "id": "abc123def45",
        "title": "Fallback Video",
        "channel": "Chan",
        "duration": 90.0,
        "formats": [{"format_id": "18"}],
    }
    process_attempts = 0
    download_calls = []

    def process_fn(_opts, _ie_result, _download):
        nonlocal process_attempts
        process_attempts += 1
        raise RuntimeError("stale stream signature")

    fake_ydl = _make_fake_ydl_cls(
        extract_fn=lambda _opts, _url, _dl, _proc: raw_ie_result,
        process_fn=process_fn,
        download_fn=lambda _opts, urls: download_calls.append(list(urls)),
    )

    client = YouTubeClient()
    with patch("core.youtube_client.yt_dlp.YoutubeDL", fake_ydl):
        client.get_video_info_fast(redirect_url)
        client.download_video(redirect_url, str(tmp_path), quality="360p")
        # Subsequent download by canonical ID URL also sees secondary key evicted
        client.download_video(canonical_url, str(tmp_path), quality="1080p")

    assert process_attempts == 1
    assert download_calls == [[redirect_url], [canonical_url]]


def test_download_video_ignores_expired_cached_ie_result(tmp_path):
    """Expired cached ie_result entries are evicted and download_video falls back to ydl.download."""
    url = "https://www.youtube.com/watch?v=ttl12345678"
    now = [100.0]
    process_calls = []
    download_calls = []

    fake_ydl = _make_fake_ydl_cls(
        extract_fn=lambda _opts, _url, _dl, _proc: {
            "id": "ttl12345678",
            "title": "TTL Video",
            "channel": "TTL Chan",
            "duration": 60,
            "formats": [{"format_id": "18"}],
        },
        process_fn=lambda _opts, ie_result, download: (process_calls.append(download), ie_result)[1],
        download_fn=lambda _opts, urls: download_calls.append(list(urls)),
    )

    client = YouTubeClient(info_cache_ttl_seconds=30.0, clock=lambda: now[0])
    with patch("core.youtube_client.yt_dlp.YoutubeDL", fake_ydl):
        client.get_video_info_fast(url)
        now[0] = 135.0
        client.download_video(url, str(tmp_path), quality="360p")

    assert process_calls == []
    assert download_calls == [[url]]


def test_youtube_client_info_cache_evicts_lru_and_is_thread_safe(tmp_path):
    """Cache enforces info_cache_max_entries via LRU eviction and safely handles concurrent lookups/downloads."""
    urls = [
        "https://www.youtube.com/watch?v=vid00000001",
        "https://www.youtube.com/watch?v=vid00000002",
        "https://www.youtube.com/watch?v=vid00000003",
    ]
    process_ids = []
    download_calls = []

    def extract_fn(_opts, target_url, _dl, _proc):
        vid = target_url.split("v=")[-1]
        return {"id": vid, "title": vid, "channel": "C", "duration": 60, "formats": [{"format_id": "18"}]}

    fake_ydl = _make_fake_ydl_cls(
        extract_fn=extract_fn,
        process_fn=lambda _opts, ie_result, _dl: (process_ids.append(ie_result["id"]), ie_result)[1],
        download_fn=lambda _opts, dl_urls: download_calls.append(list(dl_urls)),
    )

    client = YouTubeClient(info_cache_max_entries=2)
    with patch("core.youtube_client.yt_dlp.YoutubeDL", fake_ydl):
        client.get_video_info_fast(urls[0])
        client.get_video_info_fast(urls[1])
        # Refresh vid1 via download_video so vid2 becomes least-recently-used
        client.download_video(urls[0], str(tmp_path), quality="360p")
        client.get_video_info_fast(urls[2])

        # vid2 was evicted when vid3 arrived; vid1 and vid3 stay cached
        client.download_video(urls[1], str(tmp_path), quality="360p")
        with ThreadPoolExecutor(max_workers=4) as pool:
            f1 = pool.submit(client.download_video, urls[0], str(tmp_path), "1080p")
            f2 = pool.submit(client.download_video, urls[2], str(tmp_path), "1080p")
            f3 = pool.submit(client.get_video_info_fast, urls[0])
            f1.result()
            f2.result()
            assert f3.result()["id"] == "vid00000001"

    assert download_calls == [[urls[1]]]
    assert sorted(process_ids) == ["vid00000001", "vid00000001", "vid00000003"]


def test_get_video_info_fast_resolves_non_video_type_without_caching(tmp_path):
    """Non-video _type responses (playlist/url) resolve via process_ie_result(download=False) and are not cached."""
    url = "https://www.youtube.com/watch?v=lst12345678"
    process_calls = []
    download_calls = []

    def process_fn(_opts, ie_result, download):
        process_calls.append((ie_result.get("_type"), download))
        if not download:
            return {
                "id": "lst12345678",
                "title": "Resolved Redirect",
                "uploader": "Uploader Name",
                "duration": 240.5,
            }
        raise AssertionError("Non-video result should not be re-processed for download")

    fake_ydl = _make_fake_ydl_cls(
        extract_fn=lambda _opts, _url, _dl, _proc: {
            "_type": "url",
            "url": "https://www.youtube.com/watch?v=lst12345678",
            "id": "lst12345678",
        },
        process_fn=process_fn,
        download_fn=lambda _opts, urls: download_calls.append(list(urls)),
    )

    client = YouTubeClient()
    with patch("core.youtube_client.yt_dlp.YoutubeDL", fake_ydl):
        info = client.get_video_info_fast(url)
        client.download_video(url, str(tmp_path), quality="360p")

    assert info == {
        "title": "Resolved Redirect",
        "id": "lst12345678",
        "channel": "Uploader Name",
        "duration": 240.5,
    }
    assert process_calls == [("url", False)]
    assert download_calls == [[url]]


def test_mock_youtube_client_preserves_optional_duration():
    client_with_dur = MockYouTubeClient(
        mock_info={"title": "Mock", "id": "vid12345678", "channel": "Chan", "duration": 142.5}
    )
    assert client_with_dur.get_video_info_fast("https://youtube.com/watch?v=vid12345678") == {
        "title": "Mock",
        "id": "vid12345678",
        "channel": "Chan",
        "duration": 142.5,
    }

    client_without_dur = MockYouTubeClient()
    assert client_without_dur.get_video_info_fast("https://youtube.com/watch?v=vid12345678") == {
        "title": "Mock Video",
        "id": "mock_id_123",
        "channel": "Mock Channel",
        "duration": None,
    }
