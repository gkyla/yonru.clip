from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from faster_whisper import WhisperModel

class SpeechTranscriber(ABC):
    def __init__(self):
        pass

    @abstractmethod
    def _transcribe(self, audio_path: str, language: Optional[str] = None) -> List[Any]:
        """Protected method that concrete transcribers implement to get raw segments."""
        pass

    def clean_text(self, text: str) -> str:
        """Remove commas and trim whitespace."""
        return text.replace(',', '').strip()

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> List[Dict[str, Any]]:
        """Transcribe audio and return standard word-level timestamps."""
        segments = self._transcribe(audio_path, language=language)
        
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
        
        return word_level


class FasterWhisperSpeechTranscriber(SpeechTranscriber):
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        super().__init__()
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def _transcribe(self, audio_path: str, language: Optional[str] = None) -> List[Any]:
        print(f"[whisper-client] Transcribing {audio_path}...")
        segments, info = self.model.transcribe(
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
    def __init__(self, text: str, start: float, end: float, words: List[MockWord] = None):
        self.text = text
        self.start = start
        self.end = end
        self.words = words or []

    def get(self, key, default=None):
        return getattr(self, key, default)


class MockSpeechTranscriber(SpeechTranscriber):
    def __init__(self, mock_segments: List[Any] = None):
        super().__init__()
        self.mock_segments = mock_segments or []
        self.last_audio_path = None

    def _transcribe(self, audio_path: str, language: Optional[str] = None) -> List[Any]:
        self.last_audio_path = audio_path
        return self.mock_segments
