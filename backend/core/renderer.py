import os
import json
import numpy as np
from core.render_engine import RemotionRenderEngine, RenderComposition

class VideoRenderer:
    def __init__(self, output_dir="static/output", render_engine=None):
        self.output_dir = output_dir
        self.engine = render_engine or RemotionRenderEngine(output_dir=output_dir)

    def format_time(self, seconds):
        h = int(seconds / 3600)
        m = int((seconds % 3600) / 60)
        s = int(seconds % 60)
        cs = int((seconds - int(seconds)) * 100)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    def process_and_render(self, original_video: str, subtitle_ass: str, crop_center_x, out_filename="final_clip.mp4", timeline_tracks: list = None, words_data: list = None, timeline_text_items: list = None, timeline_audio_items: list = None, position: str = "bottom", clip_duration: float = None, subtitle_style: dict = None, volume: float = 0.5, fps: float = 30.0, thumbnail_config: dict = None, source_width: int = 1920, source_height: int = 1080):
        """Map arguments to composition DTO and delegate to rendering engine."""
        comp = RenderComposition(
            original_video=original_video,
            crop_center_x=crop_center_x,
            timeline_tracks=timeline_tracks,
            words_data=words_data,
            timeline_text_items=timeline_text_items,
            timeline_audio_items=timeline_audio_items,
            position=position,
            clip_duration=clip_duration,
            subtitle_style=subtitle_style,
            volume=volume,
            fps=fps,
            thumbnail_config=thumbnail_config,
            source_width=source_width,
            source_height=source_height
        )
        return self.engine.render(comp, out_filename)

    def process_and_render_streaming(self, original_video: str, subtitle_ass: str, crop_center_x, out_filename="final_clip.mp4", timeline_tracks: list = None, words_data: list = None, timeline_text_items: list = None, timeline_audio_items: list = None, position: str = "bottom", clip_duration: float = None, subtitle_style: dict = None, volume: float = 0.5, fps: float = 30.0, thumbnail_config: dict = None, source_width: int = 1920, source_height: int = 1080):
        """Map arguments to composition DTO and delegate to streaming rendering engine."""
        comp = RenderComposition(
            original_video=original_video,
            crop_center_x=crop_center_x,
            timeline_tracks=timeline_tracks,
            words_data=words_data,
            timeline_text_items=timeline_text_items,
            timeline_audio_items=timeline_audio_items,
            position=position,
            clip_duration=clip_duration,
            subtitle_style=subtitle_style,
            volume=volume,
            fps=fps,
            thumbnail_config=thumbnail_config,
            source_width=source_width,
            source_height=source_height
        )
        return self.engine.render_streaming(comp, out_filename)
