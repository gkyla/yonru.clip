import os
import re
from faster_whisper import WhisperModel

class Transcriber:
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        # "base" is fast and relatively accurate. 
        # For Mac, device="cpu" is usually best for faster-whisper unless using specialized builds.
        # But faster-whisper can use "auto" or "cuda". On Mac, CPU is the default.
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)

    def clean_text(self, text: str):
        """Only remove commas from the text."""
        cleaned = text.replace(',', '')
        return cleaned.strip()

    def transcribe(self, audio_path: str, language=None):
        """
        Transcribe audio and return word-level timestamps.
        """
        print(f"[whisper] Transcribing {audio_path}...")
        segments, info = self.model.transcribe(
            audio_path, 
            beam_size=5, 
            word_timestamps=True,
            language=language
        )
        
        word_level = []
        for segment in segments:
            if segment.words:
                for word in segment.words:
                    cleaned = self.clean_text(word.word)
                    if cleaned:
                        word_level.append({
                            "start": word.start,
                            "duration": word.end - word.start,
                            "text": cleaned
                        })
            else:
                # Fallback to segment text if word timestamps failed for some reason
                cleaned = self.clean_text(segment.text)
                if cleaned:
                    word_level.append({
                        "start": segment.start,
                        "duration": segment.end - segment.start,
                        "text": cleaned
                    })
        
        return word_level
