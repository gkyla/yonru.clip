import os
import re
import yt_dlp

class YouTubeClient:
    def __init__(self, cookie_path: str = None):
        self.cookie_path = cookie_path

    def extract_video_id(self, url: str) -> str:
        """Extract YouTube video ID from URL."""
        patterns = [
            r'(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})',
            r'(?:embed/)([a-zA-Z0-9_-]{11})',
            r'(?:shorts/)([a-zA-Z0-9_-]{11})',
        ]
        for p in patterns:
            m = re.search(p, url)
            if m:
                return m.group(1)
        return None

    def get_video_info_fast(self, url: str) -> dict:
        """Get video title and ID without downloading."""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'cookiefile': self.cookie_path if self.cookie_path and os.path.exists(self.cookie_path) else None,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                return {
                    "title": info.get("title", "Unknown"),
                    "id": info.get("id", self.extract_video_id(url))
                }
            except Exception as e:
                print(f"[youtube-client] Info Extraction Error: {e}")
                return {"title": "Unknown", "id": self.extract_video_id(url)}

    def fetch_transcript(self, video_id: str) -> list:
        """Fetch transcript and segment into snappy word-level structure."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            ytt = YouTubeTranscriptApi()
            transcript_list = ytt.list(video_id)
            
            try:
                # Try to find Indonesian specific first
                transcript = transcript_list.find_transcript(['id'])
            except:
                try:
                    # Fallback to English
                    transcript = transcript_list.find_transcript(['en', 'en-US'])
                except:
                    # Final fallback: first available
                    transcript = next(iter(transcript_list))
            
            segments = transcript.fetch()
            
            word_level = []
            for s in segments:
                if isinstance(s, dict):
                    text = s.get("text", "").replace("\n", " ").strip()
                    start = s.get("start", 0)
                    duration = s.get("duration", 0)
                else:
                    text = getattr(s, 'text', "").replace("\n", " ").strip()
                    start = getattr(s, 'start', 0)
                    duration = getattr(s, 'duration', 0)

                words = text.split()
                if not words: continue
                
                word_dur = duration / len(words)
                for i, w in enumerate(words):
                    word_level.append({
                        "start": start + (i * word_dur),
                        "duration": word_dur,
                        "text": w
                    })

            print(f"[youtube-client] Successfully word-split '{transcript.language}' transcript ({len(word_level)} words)")
            return word_level
        except Exception as e:
            print(f"[youtube-client] Transcript error: {e}")
            return []

    def download_video(self, url: str, target_dir: str) -> None:
        """Download high-quality video into target directory."""
        ydl_opts = {
            'format': 'bestvideo[height=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=1080]+bestaudio',
            'merge_output_format': 'mp4',
            'outtmpl': os.path.join(target_dir, "full.%(ext)s"),
            'cookiefile': self.cookie_path if self.cookie_path and os.path.exists(self.cookie_path) else None,
            'quiet': False,
            'no_playlist': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                ydl.download([url])
            except Exception as e:
                print(f"[youtube-client] Download Error: {e}")
                raise RuntimeError(f"YouTube Download Error: {e}")
