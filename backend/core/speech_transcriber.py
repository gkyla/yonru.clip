from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from faster_whisper import WhisperModel

class SpeechTranscriber(ABC):
    @abstractmethod
    def transcribe(self, audio_path: str, language: Optional[str] = None) -> List[Any]:
        """Transcribe audio and return raw word segments as a list of objects."""
        pass


class FasterWhisperSpeechTranscriber(SpeechTranscriber):
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> List[Any]:
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


class MockSegment:
    def __init__(self, text: str, start: float, end: float, words: List[MockWord] = None):
        self.text = text
        self.start = start
        self.end = end
        self.words = words or []


class MockSpeechTranscriber(SpeechTranscriber):
    def __init__(self, mock_segments: List[Any] = None):
        self.mock_segments = mock_segments or []
        self.last_audio_path = None

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> List[Any]:
        self.last_audio_path = audio_path
        return self.mock_segments
