import ffmpeg
import os
import json
import base64
import numpy as np

class SafeEncoder(json.JSONEncoder):
    """JSON encoder that safely handles numpy types from MediaPipe/OpenCV."""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

class VideoRenderer:
    def __init__(self, output_dir="static/output"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        import sys
        import shutil
        
        env_path = os.environ.get("PATH", "")
        extra_paths = []
        
        # Check custom FFMPEG override from environment
        custom_ffmpeg = os.environ.get("FFMPEG_PATH")
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

        # Friendly Alert for missing critical dependencies
        if not shutil.which("ffmpeg"):
            raise RuntimeError("Friendly Alert: FFmpeg was not detected on this machine. Please download/install FFmpeg and map it to your execution variables.")
        
    def format_time(self, seconds):
        h = int(seconds / 3600)
        m = int((seconds % 3600) / 60)
        s = int(seconds % 60)
        cs = int((seconds - int(seconds)) * 100)
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    def process_and_render(self, original_video: str, subtitle_ass: str, crop_center_x, out_filename="final_clip.mp4", timeline_tracks: list = None, words_data: list = None, timeline_text_items: list = None, timeline_audio_items: list = None, position: str = "bottom", clip_duration: float = None, subtitle_style: dict = None, volume: float = 0.5, fps: float = 30.0, thumbnail_config: dict = None, source_width: int = 1920, source_height: int = 1080):
        import subprocess
        import shutil
        
        output_path = os.path.join(self.output_dir, out_filename)
        
        try:
            # 1. Copy video to Remotion public directory
            remotion_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../remotion_engine"))
            public_dir = os.path.join(remotion_dir, "public")
            os.makedirs(public_dir, exist_ok=True)
            
            # Generate a safe temporary filename for Remotion to use
            temp_public_video_name = f"source_{out_filename}"
            public_video_path = os.path.join(public_dir, temp_public_video_name)
            shutil.copy2(original_video, public_video_path)
            
            # Handle thumbnail image
            thumbnail_image_name = None
            thumb_duration = 0
            if thumbnail_config and thumbnail_config.get("enabled"):
                thumb_src = thumbnail_config.get("imagePath")
                if thumb_src and os.path.exists(thumb_src):
                    thumbnail_image_name = f"thumb_{out_filename}.jpg"
                    shutil.copy2(thumb_src, os.path.join(public_dir, thumbnail_image_name))
                    thumb_duration = thumbnail_config.get("duration", 1.0)
                    print(f"[render] Thumbnail enabled: {thumb_duration}s prepend")
            
            video_frames = max(1, int((clip_duration or 10.0) * fps))
            thumbnail_frames = int(thumb_duration * fps)
            frames = video_frames + thumbnail_frames
            
            # 2. Prepare Remotion Props
            props = {
                "videoPath": temp_public_video_name,
                "words": words_data or [],
                "cropX": crop_center_x if isinstance(crop_center_x, (int, float)) else (crop_center_x[0]["x"] if isinstance(crop_center_x, list) and len(crop_center_x) > 0 else 960),
                "cropMap": crop_center_x if isinstance(crop_center_x, list) else [],
                "position": position,
                "subtitleOffset": subtitle_style.get("subtitleOffset", 50) if subtitle_style else 50,
                "durationInFrames": frames,
                "subtitleStyle": subtitle_style or {},
                "timelineTextItems": timeline_text_items or [],
                "timelineAudioItems": timeline_audio_items or [],
                "timelineVideoItems": timeline_tracks[0].get("items", []) if timeline_tracks and len(timeline_tracks) > 0 else [],
                "volume": volume,
                "fps": fps,
                "thumbnailEnabled": thumbnail_image_name is not None,
                "thumbnailDuration": thumb_duration,
                "thumbnailImagePath": thumbnail_image_name,
                "thumbnailTextOverlays": thumbnail_config.get("textOverlays", []) if thumbnail_config else [],
                "sourceWidth": source_width,
                "sourceHeight": source_height,
            }
            
            props_path = os.path.abspath(os.path.join(self.output_dir, f"props_{out_filename}.json"))
            with open(props_path, "w") as f:
                json.dump(props, f, cls=SafeEncoder)
            
            # 3. Run Remotion Render
            cmd = [
                "npx", "remotion", "render", 
                "src/index.ts", "YonruClip", 
                "--props", props_path,
                os.path.abspath(output_path),
                "--force",
                f"--fps={fps}",
                "--width=1080",
                "--height=1920"
            ]
            if clip_duration:
                cmd.extend(["--frames", f"0-{frames-1}"])
            
            print(f"[render] Executing Remotion: {' '.join(cmd)}")
            
            # Run the command
            result = subprocess.run(
                cmd, 
                cwd=remotion_dir,
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                text=True
            )
            
            if result.returncode != 0:
                print(f"[render] Remotion failed:\n{result.stderr}")
                return None
                
            print(f"[render] Successfully rendered to {output_path}")
            
            # Clean up temporary files
            try:
                os.remove(props_path)
                os.remove(public_video_path)
            except:
                pass
                
            return output_path
            
        except Exception as e:
            print(f"[render] Error running Remotion: {str(e)}")
            return None

    def process_and_render_streaming(self, original_video: str, subtitle_ass: str, crop_center_x, out_filename="final_clip.mp4", timeline_tracks: list = None, words_data: list = None, timeline_text_items: list = None, timeline_audio_items: list = None, position: str = "bottom", clip_duration: float = None, subtitle_style: dict = None, volume: float = 0.5, fps: float = 30.0, thumbnail_config: dict = None, source_width: int = 1920, source_height: int = 1080):
        """Generator version of process_and_render that yields progress dicts."""
        import subprocess
        import shutil
        import re
        import time
        
        output_path = os.path.join(self.output_dir, out_filename)
        
        try:
            # 1. Copy video to Remotion public directory
            remotion_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../remotion_engine"))
            public_dir = os.path.join(remotion_dir, "public")
            os.makedirs(public_dir, exist_ok=True)
            
            temp_public_video_name = f"source_{out_filename}"
            public_video_path = os.path.join(public_dir, temp_public_video_name)
            shutil.copy2(original_video, public_video_path)
            
            # Handle thumbnail image
            thumbnail_image_name = None
            thumb_duration = 0
            if thumbnail_config and thumbnail_config.get("enabled"):
                thumb_src = thumbnail_config.get("imagePath")
                if thumb_src and os.path.exists(thumb_src):
                    thumbnail_image_name = f"thumb_{out_filename}.jpg"
                    shutil.copy2(thumb_src, os.path.join(public_dir, thumbnail_image_name))
                    thumb_duration = thumbnail_config.get("duration", 1.0)
            
            video_frames = max(1, int((clip_duration or 10.0) * fps))
            thumbnail_frames = int(thumb_duration * fps)
            frames = video_frames + thumbnail_frames
            
            # 2. Prepare Remotion Props (same as non-streaming)
            props = {
                "videoPath": temp_public_video_name,
                "words": words_data or [],
                "cropX": crop_center_x if isinstance(crop_center_x, (int, float)) else (crop_center_x[0]["x"] if isinstance(crop_center_x, list) and len(crop_center_x) > 0 else 960),
                "cropMap": crop_center_x if isinstance(crop_center_x, list) else [],
                "position": position,
                "subtitleOffset": subtitle_style.get("subtitleOffset", 50) if subtitle_style else 50,
                "durationInFrames": frames,
                "subtitleStyle": subtitle_style or {},
                "timelineTextItems": timeline_text_items or [],
                "timelineAudioItems": timeline_audio_items or [],
                "timelineVideoItems": timeline_tracks[0].get("items", []) if timeline_tracks and len(timeline_tracks) > 0 else [],
                "volume": volume,
                "fps": fps,
                "thumbnailEnabled": thumbnail_image_name is not None,
                "thumbnailDuration": thumb_duration,
                "thumbnailImagePath": thumbnail_image_name,
                "thumbnailTextOverlays": thumbnail_config.get("textOverlays", []) if thumbnail_config else [],
                "sourceWidth": source_width,
                "sourceHeight": source_height,
            }
            
            props_path = os.path.abspath(os.path.join(self.output_dir, f"props_{out_filename}.json"))
            with open(props_path, "w") as f:
                json.dump(props, f, cls=SafeEncoder)
            
            # 3. Run Remotion Render with Popen (streaming)
            cmd = [
                "npx", "remotion", "render", 
                "src/index.ts", "YonruClip", 
                "--props", props_path,
                os.path.abspath(output_path),
                "--force",
                f"--fps={fps}",
                "--width=1080",
                "--height=1920"
            ]
            if clip_duration:
                cmd.extend(["--frames", f"0-{frames-1}"])
            
            print(f"[render-stream] Executing Remotion: {' '.join(cmd)}")
            yield {"stage": "starting", "percent": 0, "frame": 0, "totalFrames": frames}
            
            # Merge stdout+stderr so we capture all Remotion output
            # Use FORCE_COLOR=0 to disable ANSI escape codes
            env = os.environ.copy()
            env["FORCE_COLOR"] = "0"
            env["NO_COLOR"] = "1"
            
            process = subprocess.Popen(
                cmd,
                cwd=remotion_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,  # Merge stderr into stdout
                text=True,
                bufsize=0,  # Unbuffered
                env=env
            )
            
            start_time = time.time()
            render_start_time = None
            last_overall = 0
            current_stage = "bundling"
            
            # Regex for frame progress: "(45/300)" pattern from Remotion
            frame_re = re.compile(r'\((\d+)/(\d+)\)')
            # Regex for percentage: "45%" (used for bundling AND render progress)
            pct_re = re.compile(r'(\d+)%')
            
            # Use readline() loop instead of iterator to avoid read-ahead buffering
            while True:
                line = process.stdout.readline()
                if not line and process.poll() is not None:
                    break
                if not line:
                    continue
                
                # Strip ANSI codes and carriage returns
                line = re.sub(r'\x1b\[[0-9;]*[a-zA-Z]', '', line)
                line = line.strip()
                if not line:
                    continue
                
                line_lower = line.lower()
                print(f"[render-stream] [{current_stage}] {line}")
                
                # --- Stage: Bundling (0-15% of overall) ---
                if "bundling" in line_lower:
                    current_stage = "bundling"
                    m = pct_re.search(line)
                    if m:
                        bpct = int(m.group(1))
                        overall = int(bpct * 0.15)  # 0-15% range
                        if overall > last_overall:
                            last_overall = overall
                            yield {
                                "stage": "bundling",
                                "percent": overall,
                                "frame": 0,
                                "totalFrames": frames,
                                "etaSeconds": 0
                            }
                    continue
                
                # --- Detect render start ---
                if ("rendering" in line_lower or "concurrency" in line_lower) and current_stage != "rendering":
                    current_stage = "rendering"
                    render_start_time = time.time()
                    last_overall = max(last_overall, 15)
                    yield {
                        "stage": "rendering",
                        "percent": 15,
                        "frame": 0,
                        "totalFrames": frames,
                        "etaSeconds": 0
                    }
                
                # --- Stage: Rendering frames (15-95% of overall) ---
                if current_stage == "rendering":
                    # Try "(X/Y)" frame pattern first (most reliable)
                    fm = frame_re.search(line)
                    if fm:
                        frame_num = int(fm.group(1))
                        total = int(fm.group(2))
                        render_pct = (frame_num / max(total, 1)) * 100
                        # Map render 0-100% to overall 15-95%
                        overall = int(15 + (render_pct * 0.80))
                        
                        if overall > last_overall:
                            last_overall = overall
                            elapsed = time.time() - (render_start_time or start_time)
                            if render_pct > 0:
                                eta_sec = max(0, int((elapsed / render_pct) * (100 - render_pct)))
                            else:
                                eta_sec = 0
                            
                            yield {
                                "stage": "rendering",
                                "percent": min(overall, 95),
                                "frame": frame_num,
                                "totalFrames": total,
                                "etaSeconds": eta_sec
                            }
                        continue
                    
                    # Try raw percentage (not from bundling line)
                    pm = pct_re.search(line)
                    if pm and "bundling" not in line_lower:
                        rpct = int(pm.group(1))
                        overall = int(15 + (rpct * 0.80))
                        if overall > last_overall:
                            last_overall = overall
                            elapsed = time.time() - (render_start_time or start_time)
                            eta_sec = max(0, int((elapsed / max(rpct, 1)) * (100 - rpct))) if rpct > 0 else 0
                            yield {
                                "stage": "rendering",
                                "percent": min(overall, 95),
                                "frame": int(frames * rpct / 100),
                                "totalFrames": frames,
                                "etaSeconds": eta_sec
                            }
                        continue
                
                # --- Stage: Encoding/Muxing (95-99%) ---
                if "encoding" in line_lower or "muxing" in line_lower or "stitching" in line_lower:
                    current_stage = "encoding"
                    if last_overall < 96:
                        last_overall = 96
                    yield {"stage": "encoding", "percent": last_overall, "frame": frames, "totalFrames": frames, "etaSeconds": 0}
            
            process.wait()
            
            if process.returncode != 0:
                print(f"[render-stream] Remotion failed with code {process.returncode}")
                yield {"stage": "error", "message": f"Remotion exited with code {process.returncode}"}
                return
            
            print(f"[render-stream] Successfully rendered to {output_path}")
            
            # Clean up
            try:
                os.remove(props_path)
                os.remove(public_video_path)
            except:
                pass
            
            yield {
                "stage": "done",
                "percent": 100,
                "frame": frames,
                "totalFrames": frames,
                "outputPath": output_path,
                "outputUrl": f"/static/output/{out_filename}"
            }
            
        except Exception as e:
            print(f"[render-stream] Error: {str(e)}")
            yield {"stage": "error", "message": str(e)}

    def _internal_audio_mix(self, original_video, output_path, timeline_tracks):
        # Helper logic for audio mixing if still required via FFmpeg
        temp_files = []
        try:
            stream = ffmpeg.input(original_video)
            a_main = stream.audio
            audio_streams = [a_main]
            
            if timeline_tracks:
                audio_track = next((t for t in timeline_tracks if t['id'] == 'audio'), None)
                if audio_track and audio_track.get('items'):
                    for item in audio_track['items']:
                        if item.get('src'):
                            # Handle data URL
                            if item['src'].startswith('data:audio'):
                                header, encoded = item['src'].split(",", 1)
                                ext = header.split("/")[1].split(";")[0]
                                temp_audio = f"temp_assets/audio_{item['id']}.{ext}"
                                with open(temp_audio, "wb") as f:
                                    f.write(base64.b64decode(encoded))
                                temp_files.append(temp_audio)
                                audio_path = temp_audio
                            else:
                                audio_path = item['src']
                            
                            if os.path.exists(audio_path):
                                start_ms = int(item['start'] * 1000)
                                a_extra = ffmpeg.input(audio_path).audio
                                # Delay audio
                                a_extra = a_extra.filter('adelay', f"{start_ms}|{start_ms}")
                                audio_streams.append(a_extra)

            if len(audio_streams) > 1:
                a = ffmpeg.filter(audio_streams, 'amix', inputs=len(audio_streams))
            else:
                a = a_main

            out = ffmpeg.output(v, a, output_path, vcodec='libx264', acodec='aac', strict='experimental')
            ffmpeg.run(out, overwrite_output=True)
            
            return output_path
        except Exception as e:
            print(f"Render failed: {e}")
            return None
        finally:
            for f in temp_files:
                try: os.remove(f)
                except: pass
