from abc import ABC, abstractmethod
from typing import Optional

class SubtitleEngine(ABC):
    @abstractmethod
    def format_subtitles(
        self,
        segments: list,
        subtitle_mode: str,
        sync_offset_ms: float,
        clip_duration: float,
        clip_start: float = 0.0,
        is_relative: bool = False
    ) -> list:
        """
        Process raw segments into absolute clip-relative timeline words_data chunks:
        [{"start": float, "end": float, "word": str}]
        """
        pass


class DefaultSubtitleEngine(SubtitleEngine):
    def format_subtitles(
        self,
        segments: list,
        subtitle_mode: str,
        sync_offset_ms: float,
        clip_duration: float,
        clip_start: float = 0.0,
        is_relative: bool = False
    ) -> list:
        if not segments:
            return []

        words_data = []
        offset_sec = sync_offset_ms / 1000.0
        clip_end = clip_start + clip_duration
        flat_words = []

        # 1. Adjust timing and flatten all matching segment words into absolute clip-relative timeline
        for s in segments:
            if is_relative:
                w_start_abs = s["start"] + offset_sec
                w_end_abs = (s["start"] + s["duration"]) + offset_sec
                if w_start_abs >= clip_duration:
                    continue
            else:
                seg_start = s["start"] + offset_sec
                seg_end = (s["start"] + s["duration"]) + offset_sec
                if seg_end > clip_start and seg_start < clip_end:
                    w_start_abs = max(0.0, seg_start - clip_start)
                    w_end_abs = min(clip_duration, seg_end - clip_start)
                else:
                    continue

            text = s["text"].strip()
            words = text.split()
            if not words:
                continue

            seg_dur = w_end_abs - w_start_abs
            word_dur = seg_dur / len(words)
            for idx, w in enumerate(words):
                flat_words.append({
                    "text": w,
                    "start": w_start_abs + (idx * word_dur),
                    "end": w_start_abs + ((idx + 1) * word_dur)
                })

        if not flat_words:
            return []

        # 2. Group flat_words based on subtitle_mode
        grouped_chunks = []
        if subtitle_mode in ("word", "1_word"):
            grouped_chunks = flat_words
        elif "word" in subtitle_mode:
            try:
                num_words = int(subtitle_mode.split('_')[0])
            except ValueError:
                num_words = 1

            for i in range(0, len(flat_words), num_words):
                chunk = flat_words[i : i + num_words]
                start = chunk[0]["start"]
                end = chunk[-1]["end"]
                text = " ".join([cw["text"] for cw in chunk])
                grouped_chunks.append({"text": text, "start": start, "end": end})
        elif "chars" in subtitle_mode:
            try:
                limit = int(subtitle_mode.split('_')[0])
            except ValueError:
                limit = 999

            curr_chunk = []
            curr_len = 0
            for cw in flat_words:
                if curr_len + len(cw["text"]) > limit and curr_chunk:
                    start = curr_chunk[0]["start"]
                    end = curr_chunk[-1]["end"]
                    text = " ".join([c["text"] for c in curr_chunk])
                    grouped_chunks.append({"text": text, "start": start, "end": end})
                    
                    curr_chunk = [cw]
                    curr_len = len(cw["text"])
                else:
                    curr_chunk.append(cw)
                    curr_len += len(cw["text"]) + (1 if len(curr_chunk) > 1 else 0)
            if curr_chunk:
                start = curr_chunk[0]["start"]
                end = curr_chunk[-1]["end"]
                text = " ".join([c["text"] for c in curr_chunk])
                grouped_chunks.append({"text": text, "start": start, "end": end})
        else:
            grouped_chunks = flat_words

        # 3. Assemble final output
        for gc in grouped_chunks:
            words_data.append({
                "start": gc["start"],
                "end": gc["end"],
                "word": gc["text"]
            })

        return words_data


class MockSubtitleEngine(SubtitleEngine):
    def __init__(self, mock_output: Optional[list] = None):
        self.mock_output = mock_output or []
        self.calls = []

    def format_subtitles(
        self,
        segments: list,
        subtitle_mode: str,
        sync_offset_ms: float,
        clip_duration: float,
        clip_start: float = 0.0,
        is_relative: bool = False
    ) -> list:
        self.calls.append({
            "segments": segments,
            "subtitle_mode": subtitle_mode,
            "sync_offset_ms": sync_offset_ms,
            "clip_duration": clip_duration,
            "clip_start": clip_start,
            "is_relative": is_relative
        })
        return self.mock_output
