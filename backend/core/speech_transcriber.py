from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from faster_whisper import WhisperModel

class SpeechTranscriber(ABC):
    def __init__(self):
        pass

    @abstractmethod
    def _transcribe(self, audio_path: str, model_size: Optional[str] = None, language: Optional[str] = None) -> List[Any]:
        """Protected method that concrete transcribers implement to get raw segments."""
        pass

    def clean_text(self, text: str) -> str:
        """Remove commas and trim whitespace."""
        return text.replace(',', '').strip()

    def transcribe(self, audio_path: str, model_size: Optional[str] = None, language: Optional[str] = None) -> List[Dict[str, Any]]:
        """Transcribe audio and return standard word-level timestamps."""
        segments = self._transcribe(audio_path, model_size=model_size, language=language)
        
        word_level = []
        for segment in segments:
            # Support both object attributes and dict-like mappings
            words = getattr(segment, "words", None) or (segment.get("words") if isinstance(segment, dict) else None)
            
            if words:
                for word in words:
                    w_text = getattr(word, "word", None) or (word.get("word") if isinstance(word, dict) else None)
                    w_start = getattr(word, "start", 0.0) or (word.get("start", 0.0) if isinstance(word, dict) else 0.0)
                    w_end = getattr(word, "end", 0.0) or (word.get("end", 0.0) if isinstance(word, dict) else 0.0)
                    
                    cleaned = self.clean_text(w_text or "")
                    if cleaned:
                        word_level.append({
                            "start": w_start,
                            "duration": w_end - w_start,
                            "text": cleaned
                        })
            else:
                # Fallback to segment text if word timestamps are absent
                s_text = getattr(segment, "text", None) or (segment.get("text") if isinstance(segment, dict) else None)
                s_start = getattr(segment, "start", 0.0) or (segment.get("start", 0.0) if isinstance(segment, dict) else 0.0)
                s_end = getattr(segment, "end", 0.0) or (segment.get("end", 0.0) if isinstance(segment, dict) else 0.0)
                
                cleaned = self.clean_text(s_text or "")
                if cleaned:
                    word_level.append({
                        "start": s_start,
                        "duration": s_end - s_start,
                        "text": cleaned
                    })
        
        return self._merge_hyphenated_words(word_level)

    def _merge_hyphenated_words(self, word_level: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not word_level:
            return []
            
        merged: List[Dict[str, Any]] = []
        i = 0
        n = len(word_level)
        
        while i < n:
            current: Dict[str, Any] = dict(word_level[i])
            
            # Case C: Next word is exactly '-' and there is a word after it
            if i + 2 < n and str(word_level[i + 1]["text"]) == "-":
                after_word = word_level[i + 2]
                merged_text = f"{str(current['text'])}-{str(after_word['text'])}"
                merged_start = float(current["start"])
                merged_end = float(after_word["start"]) + float(after_word["duration"])
                current = {
                    "start": merged_start,
                    "duration": max(0.0, merged_end - merged_start),
                    "text": merged_text
                }
                i += 3
            # Case A & B: Current ends with '-' or next starts with '-'
            elif i + 1 < n and (str(current["text"]).endswith("-") or str(word_level[i + 1]["text"]).startswith("-")):
                next_word = word_level[i + 1]
                left = str(current["text"])
                right = str(next_word["text"])
                if left.endswith("-") and right.startswith("-"):
                    merged_text = left + right[1:]
                else:
                    merged_text = left + right
                
                merged_start = float(current["start"])
                merged_end = float(next_word["start"]) + float(next_word["duration"])
                current = {
                    "start": merged_start,
                    "duration": max(0.0, merged_end - merged_start),
                    "text": merged_text
                }
                i += 2
            else:
                i += 1
                
            # Recursive check/merge with the last item in merged
            while merged:
                last = merged[-1]
                last_text = str(last["text"])
                curr_text = str(current["text"])
                if last_text.endswith("-") or curr_text.startswith("-") or curr_text == "-":
                    merged_text = last_text + curr_text
                    if last_text.endswith("-") and curr_text.startswith("-"):
                        merged_text = last_text + curr_text[1:]
                    
                    merged_text = merged_text.replace("--", "-")
                    merged_start = float(last["start"])
                    merged_end = float(current["start"]) + float(current["duration"])
                    
                    current = {
                        "start": merged_start,
                        "duration": max(0.0, merged_end - merged_start),
                        "text": merged_text
                    }
                    merged.pop()
                else:
                    break
                    
            merged.append(current)
            
        return merged




class FasterWhisperSpeechTranscriber(SpeechTranscriber):
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        super().__init__()
        self.default_model_size = model_size
        self.device = device
        self.compute_type = compute_type
        # Lazy model cache to avoid reloading
        self._models: Dict[str, WhisperModel] = {}

    def get_model(self, model_size: str) -> WhisperModel:
        if model_size not in self._models:
            print(f"[whisper-client] Loading Whisper model: {model_size} (device={self.device}, compute_type={self.compute_type})...")
            self._models[model_size] = WhisperModel(model_size, device=self.device, compute_type=self.compute_type)
        return self._models[model_size]

    def _transcribe(self, audio_path: str, model_size: Optional[str] = None, language: Optional[str] = None) -> List[Any]:
        selected_model = model_size or self.default_model_size
        model = self.get_model(selected_model)
        
        print(f"[whisper-client] Transcribing {audio_path} using model {selected_model}...")
        segments, info = model.transcribe(
            audio_path, 
            beam_size=5, 
            word_timestamps=True,
            language=language
        )
        return list(segments)


class MockWord:
    def __init__(self, word: str, start: float, end: float):
        self.word = word
        self.start = start
        self.end = end

    def get(self, key, default=None):
        return getattr(self, key, default)


class MockSegment:
    def __init__(self, text: str, start: float, end: float, words: Optional[List[MockWord]] = None):
        self.text = text
        self.start = start
        self.end = end
        self.words = words or []

    def get(self, key, default=None):
        return getattr(self, key, default)


class MockSpeechTranscriber(SpeechTranscriber):
    def __init__(self, mock_segments: Optional[List[Any]] = None):
        super().__init__()
        self.mock_segments = mock_segments or []
        self.last_audio_path = None
        self.last_model_size = None

    def _transcribe(self, audio_path: str, model_size: Optional[str] = None, language: Optional[str] = None) -> List[Any]:
        self.last_audio_path = audio_path
        self.last_model_size = model_size
        return self.mock_segments
