import os
from core.youtube_client import YouTubeClient
from core.asset_repository import AssetRepository

class YouTubeParser:
    def __init__(self, output_dir="temp_assets"):
        self.cookie_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookies.txt"))
        self.client = YouTubeClient(cookie_path=self.cookie_path)
        self.repo = AssetRepository(output_dir=output_dir, youtube_client=self.client)

    def get_cached_video(self, url: str) -> dict:
        return self.repo.get_cached_video(url)

    def get_cached_video_by_folder(self, folder_name: str) -> dict:
        return self.repo.get_cached_video_by_folder(folder_name)

    def fetch_transcript(self, video_id: str) -> list:
        return self.client.fetch_transcript(video_id)

    def list_cached_videos(self) -> list:
        return self.repo.list_cached_videos()

    def get_saved_hooks(self, folder_name: str) -> list:
        return self.repo.get_saved_hooks(folder_name)

    def add_saved_hook(self, folder_name: str, hook: dict) -> list:
        return self.repo.add_saved_hook(folder_name, hook)

    def delete_saved_hook(self, folder_name: str, hook_id: str) -> list:
        return self.repo.delete_saved_hook(folder_name, hook_id)

    def delete_cached_video(self, folder_name: str) -> int:
        return self.repo.delete_cached_video(folder_name)

    def download_full_video(self, url: str) -> dict:
        return self.repo.get_or_create_source(url)

    def extract_audio_from_local(self, video_path: str) -> str:
        return self.repo.extract_audio_from_local(video_path)

    def cut_segment(self, video_path: str, start_time: float, end_time: float, theme: str = None) -> dict:
        return self.repo.create_clip(video_path, start_time, end_time, theme)

    def list_all_clips(self) -> list:
        return self.repo.list_all_clips()

    def delete_clip(self, folder_name: str, clip_id: str) -> bool:
        return self.repo.delete_clip(folder_name, clip_id)
