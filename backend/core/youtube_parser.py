import os
from typing import Optional
from core.youtube_client import YouTubeClient, AbstractYouTubeClient
from core.asset_repository import AssetRepository

class YouTubeParser:
    def __init__(self, output_dir="temp_assets", youtube_client: Optional[AbstractYouTubeClient] = None, config_store=None):
        self.cookie_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookies.txt"))
        self.client = youtube_client or YouTubeClient(cookie_path=self.cookie_path)
        
        if config_store is None:
            try:
                import sys
                main_module = sys.modules.get("main")
                if main_module and hasattr(main_module, "config_store"):
                    config_store = main_module.config_store
            except:
                pass
                
        self.repo = AssetRepository(output_dir=output_dir, youtube_client=self.client, config_store=config_store)

    @property
    def clips_dir(self) -> str:
        return self.repo.clips_dir

    def extract_video_id(self, url: str) -> str:
        return self.client.extract_video_id(url)

    def get_video_info_fast(self, url: str) -> dict:
        return self.client.get_video_info_fast(url)

    def get_video_resolution(self, video_path: str) -> tuple:
        return self.repo.get_video_resolution(video_path)

    def get_video_duration(self, video_path: str) -> float:
        return self.repo.get_video_duration(video_path)



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
