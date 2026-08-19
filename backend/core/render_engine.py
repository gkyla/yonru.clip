from abc import ABC, abstractmethod
import os
import sys
import subprocess
import json
import shutil
import re
import time
from typing import Generator, Any, Optional, Dict, List, Tuple


class RenderComposition:
    """A data DTO containing the complete settings of a video composition."""
    def __init__(self, original_video: str, crop_center_x: Any, **kwargs):
        self.original_video = original_video
        self.crop_center_x = crop_center_x
        self.video_layout = kwargs.get("video_layout", "vertical")
        self.timeline_tracks = kwargs.get("timeline_tracks")
        self.words_data = kwargs.get("words_data")
        self.timeline_text_items = kwargs.get("timeline_text_items")
        self.timeline_audio_items = kwargs.get("timeline_audio_items")
        self.timeline_video_items = kwargs.get("timeline_video_items")
        self.position = kwargs.get("position", "bottom")
        self.clip_duration = kwargs.get("clip_duration")
        self.subtitle_style = kwargs.get("subtitle_style")
        self.volume = kwargs.get("volume", 0.5)
        self.fps = kwargs.get("fps", 30.0)
        self.thumbnail_config = kwargs.get("thumbnail_config")
        self.source_width = kwargs.get("source_width", 1920)
        self.source_height = kwargs.get("source_height", 1080)


class SafeEncoder(json.JSONEncoder):
    """JSON encoder that safely handles numpy types from MediaPipe/OpenCV."""
    def default(self, o):
        try:
            import numpy as np
            if isinstance(o, np.integer):
                return int(o)
            if isinstance(o, np.floating):
                return float(o)
            if isinstance(o, np.ndarray):
                return o.tolist()
        except ImportError:
            pass
        return super().default(o)


class RemotionProgressParser:
    """
    Pure stateful parser converting raw Remotion CLI stdout lines into structured SSE event dicts.
    Handles ANSI stripping, bundling stage, rendering frame/percent parsing, and ETA estimation.
    """
    def __init__(self, total_frames: int, start_time: Optional[float] = None):
        self.total_frames = max(1, total_frames)
        self.start_time = start_time if start_time is not None else time.time()
        self.render_start_time: Optional[float] = None
        self.last_overall: int = 0
        self.last_frame: int = -1
        self.current_stage: str = "bundling"
        self.frame_re = re.compile(r'(?:Rendered\s+)?(?:\()?(\d+)/(\d+)(?:\))?', re.IGNORECASE)
        self.time_re = re.compile(r'time remaining:\s*(?:(\d+)m\s*)?(\d+)s', re.IGNORECASE)
        self.pct_re = re.compile(r'(\d+)%')
        self.ansi_re = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')

    def clean_line(self, line: str) -> str:
        return self.ansi_re.sub('', line).strip()

    def parse_line(self, raw_line: str) -> Optional[Dict[str, Any]]:
        clean = self.clean_line(raw_line)
        if not clean:
            return None

        line_lower = clean.lower()

        # Stage 1: Bundling
        if "bundling" in line_lower:
            self.current_stage = "bundling"
            m = self.pct_re.search(clean)
            if m:
                bpct = int(m.group(1))
                overall = int(bpct * 0.15)
                if overall > self.last_overall:
                    self.last_overall = overall
                    return {
                        "stage": "bundling",
                        "percent": overall,
                        "frame": 0,
                        "totalFrames": self.total_frames,
                        "etaSeconds": 0
                    }
            return None

        # Stage transition: Entering rendering or frame lines
        if "rendered" in line_lower or ("rendering" in line_lower and "encoding" not in line_lower) or "concurrency" in line_lower:
            fm = self.frame_re.search(clean)
            if fm:
                self.current_stage = "rendering"
                if not self.render_start_time:
                    self.render_start_time = time.time()

                frame_num = int(fm.group(1))
                total = int(fm.group(2))
                render_pct = (frame_num / max(total, 1)) * 100
                overall = int(15 + (render_pct * 0.80))

                tm = self.time_re.search(clean)
                if tm:
                    mins = int(tm.group(1)) if tm.group(1) else 0
                    secs = int(tm.group(2)) if tm.group(2) else 0
                    eta_sec = mins * 60 + secs
                else:
                    elapsed = time.time() - (self.render_start_time or self.start_time)
                    eta_sec = max(0, int((elapsed / max(render_pct, 0.001)) * (100 - render_pct))) if render_pct > 0 else 0

                if frame_num > self.last_frame or overall > self.last_overall:
                    self.last_frame = frame_num
                    self.last_overall = max(self.last_overall, overall)
                    return {
                        "stage": "rendering",
                        "percent": min(overall, 95),
                        "frame": frame_num,
                        "totalFrames": total,
                        "etaSeconds": eta_sec
                    }
                return None

            if self.current_stage != "rendering":
                self.current_stage = "rendering"
                self.render_start_time = time.time()
                self.last_overall = max(self.last_overall, 15)
                return {
                    "stage": "rendering",
                    "percent": 15,
                    "frame": 0,
                    "totalFrames": self.total_frames,
                    "etaSeconds": 0
                }

        # Stage 2: Fallback rendering percent without explicit frame match
        if self.current_stage == "rendering":
            pm = self.pct_re.search(clean)
            if pm and "bundling" not in line_lower:
                rpct = int(pm.group(1))
                overall = int(15 + (rpct * 0.80))
                if overall > self.last_overall:
                    self.last_overall = overall
                    elapsed = time.time() - (self.render_start_time or self.start_time)
                    eta_sec = max(0, int((elapsed / max(rpct, 1)) * (100 - rpct))) if rpct > 0 else 0
                    return {
                        "stage": "rendering",
                        "percent": min(overall, 95),
                        "frame": int(self.total_frames * rpct / 100),
                        "totalFrames": self.total_frames,
                        "etaSeconds": eta_sec
                    }
                return None

        # Stage 3: Encoding / Muxing
        if "encoding" in line_lower or "muxing" in line_lower or "stitching" in line_lower:
            self.current_stage = "encoding"
            if self.last_overall < 96:
                self.last_overall = 96
            return {
                "stage": "encoding",
                "percent": self.last_overall,
                "frame": self.total_frames,
                "totalFrames": self.total_frames,
                "etaSeconds": 0
            }

        return None

    def starting_event(self) -> Dict[str, Any]:
        return {"stage": "starting", "percent": 0, "frame": 0, "totalFrames": self.total_frames}

    def complete_event(self, output_path: str, output_url: str) -> Dict[str, Any]:
        return {
            "stage": "done",
            "percent": 100,
            "frame": self.total_frames,
            "totalFrames": self.total_frames,
            "outputPath": output_path,
            "outputUrl": output_url
        }

    def error_event(self, message: str) -> Dict[str, Any]:
        return {"stage": "error", "message": message}


class StagedRenderContext:
    """
    Context manager that prepares and cleans up staged video assets and props JSON
    in remotion_engine/public/ and static/output/ for Remotion rendering.
    Guarantees cleanup on normal completion, failures, and exceptions.
    """
    def __init__(self, comp: RenderComposition, out_filename: str, output_dir: str = "static/output"):
        self.comp = comp
        self.out_filename = out_filename
        self.output_dir = output_dir
        self.remotion_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../remotion_engine"))
        self.public_dir = os.path.join(self.remotion_dir, "public")
        self.public_video_path: Optional[str] = None
        self.thumbnail_image_path: Optional[str] = None
        self.props_path: Optional[str] = None
        self.frames: int = 0

    def __enter__(self):
        os.makedirs(self.public_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

        temp_public_video_name = f"source_{self.out_filename}"
        self.public_video_path = os.path.join(self.public_dir, temp_public_video_name)
        shutil.copy2(self.comp.original_video, self.public_video_path)

        thumbnail_image_name = None
        thumb_duration = 0.0
        if self.comp.thumbnail_config and self.comp.thumbnail_config.get("enabled"):
            thumb_src = self.comp.thumbnail_config.get("imagePath")
            if thumb_src and os.path.exists(thumb_src):
                thumbnail_image_name = f"thumb_{self.out_filename}.jpg"
                self.thumbnail_image_path = os.path.join(self.public_dir, thumbnail_image_name)
                shutil.copy2(thumb_src, self.thumbnail_image_path)
                thumb_duration = self.comp.thumbnail_config.get("duration", 1.0)

        clip_dur = self.comp.clip_duration
        if self.comp.timeline_tracks:
            max_timeline_end = 0.0
            for track in self.comp.timeline_tracks:
                for item in track.get("items", []):
                    end = float(item.get("start") or 0.0) + float(item.get("duration") or 0.0)
                    if end > max_timeline_end:
                        max_timeline_end = end
            if max_timeline_end > 0.0:
                clip_dur = max_timeline_end

        timeline_video_items = self.comp.timeline_video_items
        if timeline_video_items is None and self.comp.timeline_tracks:
            video_track = next((t for t in self.comp.timeline_tracks if t.get('id') == 'video'), None)
            if video_track:
                timeline_video_items = video_track.get('items', [])
            elif len(self.comp.timeline_tracks) > 0:
                timeline_video_items = self.comp.timeline_tracks[0].get('items', [])
        timeline_video_items = timeline_video_items or []

        video_frames = max(1, int((clip_dur or 10.0) * self.comp.fps))
        thumbnail_frames = int(thumb_duration * self.comp.fps)
        self.frames = video_frames + thumbnail_frames

        props = {
            "videoPath": temp_public_video_name,
            "words": self.comp.words_data or [],
            "cropX": self.comp.crop_center_x if isinstance(self.comp.crop_center_x, (int, float)) else (self.comp.crop_center_x[0]["x"] if isinstance(self.comp.crop_center_x, list) and len(self.comp.crop_center_x) > 0 else 960),
            "cropMap": self.comp.crop_center_x if isinstance(self.comp.crop_center_x, list) else [],
            "position": self.comp.position,
            "videoLayout": self.comp.video_layout,
            "subtitleOffset": self.comp.subtitle_style.get("subtitleOffset", 50) if self.comp.subtitle_style else 50,
            "durationInFrames": self.frames,
            "subtitleStyle": self.comp.subtitle_style or {},
            "timelineTextItems": self.comp.timeline_text_items or [],
            "timelineAudioItems": self.comp.timeline_audio_items or [],
            "timelineVideoItems": timeline_video_items,
            "volume": self.comp.volume,
            "fps": self.comp.fps,
            "thumbnailEnabled": thumbnail_image_name is not None,
            "thumbnailDuration": thumb_duration,
            "thumbnailImagePath": thumbnail_image_name,
            "thumbnailTextOverlays": self.comp.thumbnail_config.get("textOverlays", []) if self.comp.thumbnail_config else [],
            "thumbnailXOffset": self.comp.thumbnail_config.get("xOffset", 50.0) if self.comp.thumbnail_config else 50.0,
            "sourceWidth": self.comp.source_width,
            "sourceHeight": self.comp.source_height,
        }

        self.props_path = os.path.abspath(os.path.join(self.output_dir, f"props_{self.out_filename}.json"))
        with open(self.props_path, "w", encoding="utf-8") as f:
            json.dump(props, f, cls=SafeEncoder)

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.props_path and os.path.exists(self.props_path):
            try:
                os.remove(self.props_path)
            except Exception:
                pass
        if self.public_video_path and os.path.exists(self.public_video_path):
            try:
                os.remove(self.public_video_path)
            except Exception:
                pass
        if self.thumbnail_image_path and os.path.exists(self.thumbnail_image_path):
            try:
                os.remove(self.thumbnail_image_path)
            except Exception:
                pass


class RenderEngine(ABC):
    face_tracker: Any
    output_dir: str = "static/output"

    def resolve_output_filename(self, output_name: Optional[str], job_id: str, hook_index: int = 0) -> str:
        """Determines and deduplicates output filename against the output directory."""
        output_dir = getattr(self, "output_dir", "static/output")
        os.makedirs(output_dir, exist_ok=True)

        if output_name:
            safe_name = re.sub(r'[^\w\s-]', '', output_name).strip().replace(' ', '_')
            if not safe_name:
                safe_name = f"{job_id}_clip_{hook_index}"
            base_filename = f"{safe_name}.mp4"

            if os.path.exists(os.path.join(output_dir, base_filename)):
                counter = 2
                while os.path.exists(os.path.join(output_dir, f"{safe_name}_v{counter}.mp4")):
                    counter += 1
                return f"{safe_name}_v{counter}.mp4"
            return base_filename
        else:
            return f"{job_id}_clip_{hook_index}.mp4"

    @abstractmethod
    def _render_comp(self, comp: RenderComposition, out_filename: str) -> Optional[str]:
        """Internal synchronous render method for RenderComposition."""
        pass

    @abstractmethod
    def render_streaming(self, comp: RenderComposition, out_filename: str) -> Generator[dict, None, None]:
        """Asynchronously render and yield progress dictionaries."""
        pass

    def render(self, target: Any, out_filename_or_req: Any = None, asset_repository: Any = None, output_name: Optional[str] = None) -> Any:
        """
        Unified render entrypoint.
        Can be called with:
          render(comp, out_filename) -> str (legacy DTO path)
          render(job, req, asset_repository, output_name=...) -> dict
        """
        if isinstance(target, RenderComposition):
            return self._render_comp(target, out_filename_or_req)

        job = target
        req = out_filename_or_req
        job_id = req.job_id if hasattr(req, "job_id") else job.get("job_id", "job")
        hook_index = getattr(req, "hook_index", 0)
        resolved_name = output_name or getattr(req, "output_name", None)
        out_filename = self.resolve_output_filename(resolved_name, job_id, hook_index)

        comp = self.compile_composition(job, req, asset_repository)
        output_path = self._render_comp(comp, out_filename)
        if output_path:
            return {
                "status": "done",
                "out_filename": out_filename,
                "output_path": output_path,
                "output_url": f"/static/output/{out_filename}"
            }
        return None

    def render_stream(self, job: dict, req: Any, asset_repository: Any, output_name: Optional[str] = None) -> Generator[dict, None, None]:
        """Unified SSE progress streaming entrypoint."""
        job_id = req.job_id if hasattr(req, "job_id") else job.get("job_id", "job")
        hook_index = getattr(req, "hook_index", 0)
        resolved_name = output_name or getattr(req, "output_name", None)
        out_filename = self.resolve_output_filename(resolved_name, job_id, hook_index)

        comp = self.compile_composition(job, req, asset_repository)
        yield from self.render_streaming(comp, out_filename)

    def compile_composition(self, job: dict, req: Any, asset_repository: Any) -> RenderComposition:
        """
        Translates raw timestamps, subtitle grouping modes, face tracking paths, 
        and thumbnail options directly from job metadata and request options 
        into a consolidated RenderComposition DTO.
        """
        video_path = job.get("clip_path") or job["video_info"]["file_path"]
        fps = job.get("fps") or job["video_info"].get("fps") or req.fps or 30.0

        hook = job["hooks"][req.hook_index] if "hooks" in job and len(job["hooks"]) > req.hook_index else None

        if job.get("clip_path"):
            clip_start = 0
            clip_duration = job.get("clip_duration") or 0
            if not clip_duration and job.get("clip"):
                clip_duration = job["clip"].get("duration") or 0
        elif hook:
            clip_start = hook["start"]
            clip_duration = hook["duration"]
        else:
            clip_start = 0
            clip_duration = job.get("video_info", {}).get("duration") or 0

        # Extract tracks and calculate duration override in a single consolidated pass
        timeline_text = []
        timeline_audio = []
        timeline_video = []
        max_timeline_end = 0.0
        has_timeline_items = False

        if req.timeline_tracks:
            for track in req.timeline_tracks:
                track_id = track.get('id')
                items = track.get("items", [])
                if track_id == 'text':
                    timeline_text = items
                elif track_id == 'audio':
                    timeline_audio = items
                elif track_id == 'video':
                    timeline_video = items

                if items:
                    has_timeline_items = True
                    for item in items:
                        start = float(item.get("start") or 0.0)
                        dur = float(item.get("duration") or 0.0)
                        end = start + dur
                        if end > max_timeline_end:
                            max_timeline_end = end

        if not timeline_video and req.timeline_tracks and len(req.timeline_tracks) > 0:
            timeline_video = req.timeline_tracks[0].get('items', [])

        if has_timeline_items and max_timeline_end > 0.0:
            print(f"[render-engine] Overriding clip_duration with timeline duration: {max_timeline_end:.2f}s (was: {clip_duration}s)")
            clip_duration = max_timeline_end

        clip_transcript = os.path.join(os.path.dirname(video_path), "transcript.json")
        if os.path.exists(clip_transcript):
            transcript_path = clip_transcript
        else:
            transcript_path = os.path.join(os.path.dirname(job["video_info"]["file_path"]), "transcript.json")

        if req.transcript:
            segments = req.transcript
        elif os.path.exists(transcript_path):
            with open(transcript_path, "r", encoding="utf-8") as f:
                segments = json.load(f)
        else:
            segments = []

        is_relative = "/clips/" in transcript_path.replace("\\", "/") or req.transcript is not None

        from core.subtitle_engine import DefaultSubtitleEngine
        subtitle_engine = DefaultSubtitleEngine()
        words_data = subtitle_engine.format_subtitles(
            segments=segments,
            subtitle_mode=req.subtitle_mode,
            sync_offset_ms=req.subtitle_sync_offset,
            clip_duration=clip_duration,
            clip_start=clip_start,
            is_relative=is_relative
        )

        w, h = asset_repository.get_video_resolution(video_path) if asset_repository else (1920, 1080)
        source_width = w if w > 0 else 1920
        source_height = h if h > 0 else 1080

        if req.face_tracking:
            clip_dir = os.path.dirname(video_path)
            cached_crop_map_path = os.path.join(clip_dir, "crop_map.json")
            crop_x = None
            if os.path.exists(cached_crop_map_path):
                try:
                    with open(cached_crop_map_path, "r", encoding="utf-8") as f:
                        cached_data = json.load(f)
                        if (isinstance(cached_data, list) and len(cached_data) > 0) or isinstance(cached_data, (int, float)):
                            crop_x = cached_data
                except Exception as e:
                    print(f"[render-engine] Failed to load cached crop_map.json: {e}")
                    crop_x = None

            if crop_x is None:
                tracker = getattr(self, "face_tracker", None)
                if not tracker:
                    from core.face_tracker import FaceTracker
                    tracker = FaceTracker()
                crop_x = tracker.analyze_video(video_path, words_data=words_data)
        else:
            crop_x = int((req.crop_percent_x / 100.0) * source_width)

        thumbnail_config = None
        if req.thumbnail_enabled:
            thumbnail_config = {
                "enabled": True,
                "duration": req.thumbnail_duration,
                "textOverlays": req.thumbnail_text_overlays or [],
                "xOffset": req.thumbnail_x_offset,
            }
            clip_dir = os.path.dirname(video_path)
            thumb_path = os.path.join(clip_dir, "thumbnail.jpg")
            if os.path.exists(thumb_path):
                thumbnail_config["imagePath"] = thumb_path
            else:
                thumbnail_config["enabled"] = False

        return RenderComposition(
            original_video=video_path,
            crop_center_x=crop_x or 960,
            video_layout=getattr(req, "video_layout", "vertical") or "vertical",
            timeline_tracks=req.timeline_tracks,
            words_data=words_data,
            timeline_text_items=timeline_text,
            timeline_audio_items=timeline_audio,
            timeline_video_items=timeline_video,
            position=req.subtitle_position,
            clip_duration=clip_duration,
            subtitle_style={
                "fontFamily": req.font,
                "fontSize": req.font_size,
                "subtitleOffset": req.subtitle_offset,
                "fontWeight": req.subtitle_font_weight,
                "color": req.subtitle_text_color,
                "highlightColor": req.subtitle_highlight_color,
                "strokeColor": req.subtitle_stroke_color,
                "strokeWidth": req.subtitle_stroke_width,
                "textTransform": req.subtitle_text_transform,
                "animation": req.subtitle_animation,
                "highlightMode": req.subtitle_highlight_mode,
                "background": req.subtitle_background,
                "backgroundOpacity": req.subtitle_background_opacity,
                "wordSpacing": req.subtitle_word_spacing
            },
            volume=req.volume,
            fps=fps,
            thumbnail_config=thumbnail_config,
            source_width=source_width,
            source_height=source_height
        )

    def compile_and_render(self, job: dict, req: Any, asset_repository: Any, out_filename: str) -> Optional[str]:
        """Legacy helper: compiles composition properties and triggers rendering."""
        comp = self.compile_composition(job, req, asset_repository)
        return self._render_comp(comp, out_filename)

    def compile_and_render_streaming(self, job: dict, req: Any, asset_repository: Any, out_filename: str) -> Generator[dict, None, None]:
        """Legacy helper: compiles composition properties and yields progress dicts streaming."""
        comp = self.compile_composition(job, req, asset_repository)
        yield from self.render_streaming(comp, out_filename)


class RenderPipelineCoordinator(RenderEngine):
    """
    Deep coordinator managing composition compilation, asset staging,
    Remotion subprocess lifecycle, and SSE progress streaming.
    """
    def __init__(self, output_dir: str = "static/output", config_store: Any = None, face_tracker: Any = None):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.face_tracker = face_tracker

        if config_store is None:
            try:
                main_module = sys.modules.get("main")
                if main_module and hasattr(main_module, "config_store"):
                    config_store = main_module.config_store
            except Exception:
                pass

        self.config_store = config_store

        # Setup and verify FFmpeg binary path
        env_path = os.environ.get("PATH", "")
        extra_paths = []

        custom_ffmpeg = self.config_store.get("FFMPEG_PATH") if self.config_store else os.environ.get("FFMPEG_PATH")
        if custom_ffmpeg:
            if os.path.isdir(custom_ffmpeg):
                extra_paths.append(custom_ffmpeg)
            else:
                extra_paths.append(os.path.dirname(custom_ffmpeg))

        if sys.platform.startswith("win"):
            extra_paths.extend(["C:\\Program Files\\ffmpeg\\bin", "C:\\ffmpeg\\bin", "C:\\Program Files\\nodejs"])
        else:
            extra_paths.extend(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"])

        sep = ";" if sys.platform.startswith("win") else ":"
        for p in extra_paths:
            if os.path.exists(p) and p not in env_path.split(sep):
                env_path = f"{p}{sep}{env_path}" if env_path else p

        os.environ["PATH"] = env_path

        if not shutil.which("ffmpeg"):
            raise RuntimeError("Friendly Alert: FFmpeg was not detected on this machine. Please download/install FFmpeg and map it to your execution variables.")

    def _prepare_props_and_paths(self, comp: RenderComposition, out_filename: str) -> tuple:
        """Legacy helper for testing and direct staging inspection."""
        ctx = StagedRenderContext(comp, out_filename, self.output_dir)
        ctx.__enter__()
        return ctx.remotion_dir, ctx.public_video_path, ctx.props_path, ctx.frames

    def _render_comp(self, comp: RenderComposition, out_filename: str) -> Optional[str]:
        output_path = os.path.join(self.output_dir, out_filename)

        with StagedRenderContext(comp, out_filename, self.output_dir) as ctx:
            cmd = [
                "npx", "remotion", "render",
                "src/index.ts", "YonruClip",
                "--props", ctx.props_path or "",
                os.path.abspath(output_path),
                "--force",
                f"--fps={comp.fps}",
                "--width=1080",
                "--height=1920",
                "--frames", f"0-{ctx.frames-1}"
            ]

            print(f"[render-engine] Executing Remotion: {' '.join(cmd)}")
            result = subprocess.run(
                cmd,
                cwd=ctx.remotion_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=(sys.platform == "win32"),
                encoding="utf-8"
            )

            if result.returncode != 0:
                print(f"[render-engine] Remotion failed:\n{result.stderr}")
                return None

            return output_path

    def render_streaming(self, comp: RenderComposition, out_filename: str) -> Generator[dict, None, None]:
        output_path = os.path.join(self.output_dir, out_filename)

        with StagedRenderContext(comp, out_filename, self.output_dir) as ctx:
            cmd = [
                "npx", "remotion", "render",
                "src/index.ts", "YonruClip",
                "--props", ctx.props_path or "",
                os.path.abspath(output_path),
                "--force",
                f"--fps={comp.fps}",
                "--width=1080",
                "--height=1920",
                "--frames", f"0-{ctx.frames-1}"
            ]

            print(f"[render-engine-stream] Executing Remotion: {' '.join(cmd)}")
            parser = RemotionProgressParser(ctx.frames)
            yield parser.starting_event()

            env = os.environ.copy()
            env["FORCE_COLOR"] = "0"
            env["NO_COLOR"] = "1"

            try:
                process = subprocess.Popen(
                    cmd,
                    cwd=ctx.remotion_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=0,
                    env=env,
                    shell=(sys.platform == "win32"),
                    encoding="utf-8"
                )

                if process.stdout is None:
                    raise RuntimeError("Failed to capture stdout from subprocess")

                while True:
                    line = process.stdout.readline()
                    if not line and process.poll() is not None:
                        break
                    if not line:
                        continue

                    event = parser.parse_line(line)
                    if event:
                        yield event

                process.wait()

                if process.returncode != 0:
                    print(f"[render-engine-stream] Remotion failed with code {process.returncode}")
                    yield parser.error_event(f"Remotion exited with code {process.returncode}")
                    return

                # Graceful transition: Emit encoding stage for seamless UX completion gratification
                yield {
                    "stage": "encoding",
                    "percent": 98,
                    "frame": ctx.frames,
                    "totalFrames": ctx.frames,
                    "etaSeconds": 0
                }
                time.sleep(1.0)

                yield parser.complete_event(output_path, f"/static/output/{out_filename}")

            except Exception as e:
                print(f"[render-engine-stream] Error: {str(e)}")
                yield parser.error_event(str(e))


# Backward-compatible alias
RemotionRenderEngine = RenderPipelineCoordinator


class FakeRenderEngine(RenderEngine):
    def __init__(self, output_dir: str = "static/output", should_fail: bool = False):
        self.output_dir = output_dir
        self.should_fail = should_fail

    def _render_comp(self, comp: RenderComposition, out_filename: str) -> Optional[str]:
        if self.should_fail:
            return None
        return f"{self.output_dir}/{out_filename}"

    def render_streaming(self, comp: RenderComposition, out_filename: str) -> Generator[dict, None, None]:
        if self.should_fail:
            yield {"stage": "error", "message": "Simulated Render Failure"}
            return

        frames = max(1, int((comp.clip_duration or 10.0) * comp.fps))
        yield {"stage": "starting", "percent": 0, "frame": 0, "totalFrames": frames}
        yield {"stage": "bundling", "percent": 10, "frame": 0, "totalFrames": frames, "etaSeconds": 0}
        yield {"stage": "rendering", "percent": 50, "frame": frames // 2, "totalFrames": frames, "etaSeconds": 0}
        yield {"stage": "encoding", "percent": 96, "frame": frames, "totalFrames": frames, "etaSeconds": 0}
        yield {
            "stage": "done",
            "percent": 100,
            "frame": frames,
            "totalFrames": frames,
            "outputPath": f"{self.output_dir}/{out_filename}",
            "outputUrl": f"/static/output/{out_filename}"
        }
