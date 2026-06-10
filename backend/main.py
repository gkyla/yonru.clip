import os
# Fix for Mac AVFFrameReceiver conflict
os.environ["OPENCV_VIDEOIO_PRIORITY_BACKEND"] = "FFMPEG"

import json
import asyncio
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

from core.youtube_client import YouTubeClient
from core.asset_repository import AssetRepository
from core.hook_generator import HookGenerator
from core.render_engine import RemotionRenderEngine
from core.speech_transcriber import FasterWhisperSpeechTranscriber

app = FastAPI(title="Yonru API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve rendered output files
os.makedirs("static/output", exist_ok=True)
os.makedirs("temp_assets/sources", exist_ok=True)
os.makedirs("temp_assets/clips", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/assets", StaticFiles(directory="temp_assets"), name="assets")

# Thread-safe Job Management Seam
from core.job_store import JSONFileJobStore
jobs = JSONFileJobStore("temp_assets/jobs")

from core.prompt_repository import FilePromptRepository
backend_dir = os.path.dirname(os.path.abspath(__file__))
prompts_dir = os.path.join(backend_dir, "prompts")
prompt_repository = FilePromptRepository(prompts_dir)

from core.config_store import DotEnvConfigStore
config_store = DotEnvConfigStore(os.path.join(backend_dir, ".env"))

cookie_path = os.path.abspath(os.path.join(backend_dir, "cookies.txt"))
youtube_client = YouTubeClient(cookie_path=cookie_path)
asset_repository = AssetRepository(output_dir="temp_assets", youtube_client=youtube_client, config_store=config_store)
render_engine = RemotionRenderEngine(output_dir="static/output", config_store=config_store)
speech_transcriber = FasterWhisperSpeechTranscriber(model_size="base")

from core.workflow_coordinator import ClipWorkflowCoordinator
workflow_coordinator = ClipWorkflowCoordinator(
    job_store=jobs,
    asset_repository=asset_repository,
    youtube_client=youtube_client,
    speech_transcriber=speech_transcriber,
    prompt_repository=prompt_repository,
    config_store=config_store
)



def save_jobs():
    try:
        jobs.save()
    except:
        pass


# --- Request Models ---

class AnalyzeRequest(BaseModel):
    url: str
    language: str = "id"
    prompt_file: Optional[str] = "prompt.json"
    num_hooks: Optional[int] = 10
    auto_hooks: Optional[bool] = False

class ExtractRequest(BaseModel):
    job_id: str
    start_time: float
    end_time: float
    theme: Optional[str] = None
    whisper_model: Optional[str] = "base"

class RenderRequest(BaseModel):
    job_id: str
    hook_index: int = 0
    subtitle_position: str = "bottom"
    subtitle_offset: int = 50
    font: str = "Arial"
    font_size: int = 24
    face_tracking: bool = False
    crop_percent_x: float = 50.0  # 0=left, 50=center, 100=right
    subtitle_sync_offset: float = 0.0  # Timing adjustment in MS
    subtitle_mode: str = "word"
    timeline_tracks: Optional[list] = None
    # Subtitle Style
    subtitle_animation: str = "pop"
    subtitle_highlight_mode: str = "color"
    subtitle_highlight_color: str = "#CFFF50"
    subtitle_text_color: str = "#FFFFFF"
    subtitle_stroke_color: str = "#000000"
    subtitle_stroke_width: float = 4.0
    subtitle_font_weight: int = 900
    subtitle_text_transform: str = "uppercase"
    subtitle_background: str = "none"
    subtitle_background_opacity: float = 0.7
    subtitle_word_spacing: int = 0
    # Render Controls
    volume: float = 0.5
    fps: float = 30.0
    transcript: Optional[list] = None
    output_name: Optional[str] = None
    # Thumbnail
    thumbnail_enabled: bool = False
    thumbnail_duration: float = 1.0
    thumbnail_text_overlays: Optional[list] = None
    thumbnail_x_offset: float = 50.0
    
class LoadReadyClipRequest(BaseModel):
    folder_name: str
    clip_id: str
    volume: float = 0.5
    fps: float = 30.0
    transcript: Optional[list] = None
    # Thumbnail
    thumbnail_enabled: bool = False
    thumbnail_duration: float = 1.0
    thumbnail_text_overlays: Optional[list] = None
    thumbnail_x_offset: float = 50.0

    # Output
    output_name: Optional[str] = None

class TranscriptEditRequest(BaseModel):
    folder_name: str
    clip_id: str
    transcript: list  # List of {start, duration, text}

class TimelineSaveRequest(BaseModel):
    folder_name: str
    clip_id: str
    timeline_tracks: list

class HookUpdateRequest(BaseModel):
    folder_name: str
    hooks: list

class StyleSettingsRequest(BaseModel):
    folder_name: str
    clip_id: str
    settings: dict

class TimelineHistoryRequest(BaseModel):
    folder_name: str
    clip_id: str
    undo_stack: list
    redo_stack: list

class DefaultStyleSettingsRequest(BaseModel):
    settings: dict

class DefaultThumbnailStyleRequest(BaseModel):
    style: dict

class SystemSettingsRequest(BaseModel):
    GEMINI_API_KEY: Optional[str] = None
    FFMPEG_PATH: Optional[str] = None
    NODE_PATH: Optional[str] = None

class ValidateKeyRequest(BaseModel):
    api_key: str

class UploadCookiesRequest(BaseModel):
    cookies_text: str

class AddPromptRequest(BaseModel):
    promptName: str
    suitableFor: list[str]
    prompt: str
    numHooks: Optional[int] = 10
    autoHooks: Optional[bool] = False

class EditPromptRequest(BaseModel):
    id: str
    promptName: str
    suitableFor: list[str]
    prompt: str
    numHooks: Optional[int] = 10
    autoHooks: Optional[bool] = False

class ThumbnailScreenshotRequest(BaseModel):
    job_id: str
    timestamp: Optional[float] = None  # None = random

class ThumbnailConfigRequest(BaseModel):
    folder_name: str
    clip_id: str
    config: dict  # { enabled, duration, screenshotTime, textOverlays }

class BatchDeleteClipsRequest(BaseModel):
    clips: list[dict] # list of {folder_name, clip_id}

# --- Helpers ---


# --- Endpoints ---

@app.get("/")
def index():
    return {"status": "ok", "service": "Yonru API v2"}

@app.get("/api/prompts")
def list_prompts():
    """List all available prompt JSON files in prompts folder"""
    prompts = prompt_repository.list_prompts()
    return {"prompts": [p.to_dict() for p in prompts]}

@app.post("/api/prompts/add")
async def add_prompt(req: AddPromptRequest):
    """Append a new prompt template to prompt.json"""
    prompt_repository.add_prompt(
        name=req.promptName,
        suitable_for=req.suitableFor,
        prompt=req.prompt,
        num_hooks=req.numHooks or 10,
        auto_hooks=req.autoHooks or False
    )
    return {"status": "ok"}

@app.put("/api/prompts/edit")
async def edit_prompt(req: EditPromptRequest):
    """Edit an existing prompt template"""
    try:
        prompt_repository.edit_prompt(
            id=req.id,
            name=req.promptName,
            suitable_for=req.suitableFor,
            prompt=req.prompt,
            num_hooks=req.numHooks or 10,
            auto_hooks=req.autoHooks or False
        )
        return {"status": "ok"}
    except (ValueError, FileNotFoundError, IndexError) as e:
        raise HTTPException(status_code=400 if isinstance(e, ValueError) else 404, detail=str(e))


@app.delete("/api/prompts/{id}")
async def delete_prompt(id: str):
    """Delete an existing prompt template by its unique ID"""
    try:
        prompt_repository.delete_prompt(id)
        return {"status": "ok"}
    except (ValueError, FileNotFoundError, IndexError, KeyError) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze-url")
async def analyze_url(req: AnalyzeRequest, background_tasks: BackgroundTasks, force: bool = False):
    """Phase 1: Download full 1080p → extract audio → generate hooks"""
    import uuid
    job_id = str(uuid.uuid4())[:8]
    
    jobs[job_id] = {
        "status": "queued",
        "url": req.url,
        "video_info": None,
        "full_video_path": None,
        "audio_path": None,
        "clip_path": None,
        "clip_duration": None,
        "hooks": None,
        "error": None
    }
    
    background_tasks.add_task(workflow_coordinator.run_full_analysis, job_id, req.url, req.language, force, req.prompt_file or "prompt.json", req.num_hooks or 10, req.auto_hooks or False)
    save_jobs()
    return {"job_id": job_id, "status": "queued"}

@app.post("/api/extract-clip")
async def extract_clip(req: ExtractRequest, background_tasks: BackgroundTasks):
    """Phase 2: Cut segment from cached full video (no re-download)"""
    if req.job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # If clip already exists and is ready, return ready immediately
    # We can use the logic from run_local_cut Step 1 to check
    cached_info = jobs[req.job_id].get("video_info")
    if cached_info and cached_info.get("file_path"):
        folder_name = os.path.basename(os.path.dirname(cached_info["file_path"]))
        
        safe_theme = ""
        if req.theme:
            import re
            safe_theme = re.sub(r'[^\w\s-]', '', req.theme).strip().replace(' ', '_')[:50]
        
        clip_id = f"{int(req.start_time)}_{int(req.end_time)}_{safe_theme}" if safe_theme else f"{int(req.start_time)}_{int(req.end_time)}"
        target_dir = os.path.join(asset_repository.clips_dir, folder_name, clip_id)
        transcript_path = os.path.join(target_dir, "transcript.json")
        
        if os.path.exists(os.path.join(target_dir, "video.mp4")) and os.path.exists(transcript_path):
            print(f"[api] Clip {clip_id} already ready, skipping cut task")
            
            # Check for default style settings
            clip_style_path = os.path.join(target_dir, "style_settings.json")
            default_style_path = os.path.join("temp_assets", "default_style_settings.json")
            if not os.path.exists(clip_style_path) and os.path.exists(default_style_path):
                import shutil
                shutil.copy(default_style_path, clip_style_path)
                print(f"[api] Populated default style settings to {clip_style_path}")

            # Check for default thumbnail config
            clip_thumb_path = os.path.join(target_dir, "thumbnail_config.json")
            default_thumb_style_path = os.path.join("temp_assets", "default_thumbnail_style.json")
            if not os.path.exists(clip_thumb_path) and os.path.exists(default_thumb_style_path):
                try:
                    with open(default_thumb_style_path, "r", encoding="utf-8") as f:
                        default_style = json.load(f)
                    duration = default_style.get("thumbnailDuration", 1.0)
                    initial_config = {
                        "enabled": False,
                        "duration": duration,
                        "screenshotTime": 0,
                        "textOverlays": [],
                        "xOffset": 50
                    }
                    os.makedirs(target_dir, exist_ok=True)
                    with open(clip_thumb_path, "w", encoding="utf-8") as f:
                        json.dump(initial_config, f, ensure_ascii=False, indent=2)
                    print(f"[api] Populated default thumbnail config to {clip_thumb_path}")
                except Exception as e:
                    print(f"[api] Failed to populate default thumbnail config: {e}")

            # Ensure job object is updated for polling atomically
            job = jobs[req.job_id]
            job["status"] = "ready"
            job["clip_path"] = os.path.join(target_dir, "video.mp4")
            job["clip_duration"] = req.end_time - req.start_time
            job["clip_start"] = req.start_time
            job["clip"] = {
                "asset_url": f"/assets/clips/{folder_name}/{clip_id}/video.mp4",
                "duration": req.end_time - req.start_time,
                "start": req.start_time,
                "end": req.end_time,
                "theme": req.theme
            }
            jobs[req.job_id] = job
            save_jobs()
            return {"job_id": req.job_id, "status": "ready"}

    # Clear previous clip state to prevent UI race conditions atomically
    job = jobs[req.job_id]
    job["clip"] = None
    job["clip_path"] = None
    job["clip_duration"] = None
    job["clip_start"] = None
    job["clip_end"] = None
    job["clip_theme"] = None
    job["status"] = "cutting"
    jobs[req.job_id] = job

    background_tasks.add_task(workflow_coordinator.run_local_cut, req.job_id, req.start_time, req.end_time, req.theme, req.whisper_model or "base")
    save_jobs()
    return {"job_id": req.job_id, "status": "cutting"}

@app.get("/api/job/{job_id}")
async def get_job(job_id: str):
    """Poll job status"""
    if job_id not in jobs:
        print(f"[api] Job {job_id} not found — frontend will self-heal if clip context exists")
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[job_id]
    response = {
        "job_id": job_id,
        "status": job["status"],
        "error": job.get("error"),
    }
    
    if job.get("video_info"):
        _heatmap = job["video_info"].get("heatmap") or []
        folder_name = os.path.basename(os.path.dirname(job["video_info"].get("file_path", ""))) if job["video_info"].get("file_path") else None
        print(f"[debug] get_job {job_id} -> folder_name: {folder_name}")
        response["video"] = {
            "title": job["video_info"].get("title"),
            "duration": job["video_info"].get("duration"),
            "has_heatmap": len(_heatmap) > 0,
            "heatmap_segments": len(_heatmap),
            "asset_url": job["video_info"].get("asset_url"),
            "folder_name": folder_name
        }
        response["folder_name"] = folder_name
    elif job.get("clip_path"):
        # clip_path is clips/<folder>/<clip>/video.mp4
        folder_name = os.path.basename(os.path.dirname(os.path.dirname(job["clip_path"])))
        response["folder_name"] = folder_name
    
    # If a clip has been cut, expose it
    if job.get("clip"):
        clip_data = {
            "asset_url": job["clip"].get("asset_url"),
            "duration": job["clip"].get("duration"),
            "start": job["clip"].get("start"),
            "end": job["clip"].get("end"),
            "theme": job["clip"].get("theme"),
            "transcript_quote": job["clip"].get("transcript_quote", "")
        }
        
        # Load clip-specific transcript if it exists
        clip_path = job.get("clip_path")
        if clip_path:
            transcript_path = os.path.join(os.path.dirname(clip_path), "transcript.json")
            if os.path.exists(transcript_path):
                try:
                    with open(transcript_path, "r", encoding="utf-8") as f:
                        clip_data["transcript"] = json.load(f)
                except:
                    pass
            
            # Load clip-specific history if it exists
            history_path = os.path.join(os.path.dirname(clip_path), "history.json")
            if os.path.exists(history_path):
                try:
                    with open(history_path, "r", encoding="utf-8") as f:
                        response["history"] = json.load(f)
                    print(f"[api] Loaded persisted history for job {job_id} from {history_path}")
                except Exception as e:
                    print(f"[api] Failed to read history for job {job_id}: {e}")
        
        response["clip"] = clip_data
    
    if job.get("hooks"):
        response["hooks"] = job["hooks"]
    
    return response

@app.post("/api/generate-hooks")
async def generate_hooks():
    return {"status": "deprecated, now handled internally during analyze-url"}

@app.post("/api/render")
async def render_clip(req: RenderRequest):
    """Render final 9:16 clip from cut segment with manual or AI crop"""
    if req.job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[req.job_id]
    out_filename = f"{req.job_id}_clip_{req.hook_index}.mp4"
    
    output = render_engine.compile_and_render(job, req, asset_repository, out_filename)
    
    if output:
        return {"status": "done", "output_url": f"/static/output/{out_filename}"}
    else:
        raise HTTPException(status_code=500, detail="Render failed")

@app.post("/api/render-stream")
async def render_clip_stream(req: RenderRequest):
    """Render clip with real-time progress streaming via SSE."""
    if req.job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[req.job_id]
    
    import re
    if req.output_name:
        safe_name = re.sub(r'[^\w\s-]', '', req.output_name).strip().replace(' ', '_')
        base_filename = f"{safe_name}.mp4"
        
        # Check for existing file and add suffix
        out_dir = os.path.join("static", "output")
        os.makedirs(out_dir, exist_ok=True)
        
        if os.path.exists(os.path.join(out_dir, base_filename)):
            counter = 2
            while os.path.exists(os.path.join(out_dir, f"{safe_name}_v{counter}.mp4")):
                counter += 1
            out_filename = f"{safe_name}_v{counter}.mp4"
        else:
            out_filename = base_filename
    else:
        out_filename = f"{req.job_id}_clip_{req.hook_index}.mp4"

    def sse_generator():
        for progress in render_engine.compile_and_render_streaming(job, req, asset_repository, out_filename):
            yield f"data: {json.dumps(progress)}\n\n"
    
    return StreamingResponse(sse_generator(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    })

# --- Cache Management ---

@app.get("/api/cached")
async def list_cached():
    """List all cached full videos in temp_assets with resolution and size."""
    videos = asset_repository.list_cached_videos()
    return {"videos": videos}

@app.get("/api/ready-clips")
async def list_ready_clips():
    """List all segments that have been cut and transcribed."""
    clips = asset_repository.list_all_clips()
    return {"clips": clips}

@app.delete("/api/ready-clips/{folder_name}/{clip_id}")
async def delete_ready_clip(folder_name: str, clip_id: str):
    """Delete a specific clip folder."""
    success = asset_repository.delete_clip(folder_name, clip_id)
    if not success:
        raise HTTPException(status_code=404, detail="Clip not found")
    # Clean up corresponding job session
    import hashlib
    hash_input = f"{folder_name}_{clip_id}"
    job_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()[:8]
    jobs.delete_job(job_id)
    return {"status": "deleted", "clip_id": clip_id}

@app.post("/api/ready-clips/delete-batch")
async def delete_ready_clips_batch(req: BatchDeleteClipsRequest):
    """Delete multiple clips in one go."""
    results = []
    for item in req.clips:
        folder_name = item.get("folder_name")
        clip_id = item.get("clip_id")
        if folder_name and clip_id:
            try:
                success = asset_repository.delete_clip(folder_name, clip_id)
                if success:
                    import hashlib
                    hash_input = f"{folder_name}_{clip_id}"
                    job_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()[:8]
                    jobs.delete_job(job_id)
                results.append({"clip_id": clip_id, "success": success})
            except ValueError as e:
                print(f"[delete-batch] Validation failed for {folder_name}/{clip_id}: {e}")
                results.append({"clip_id": clip_id, "success": False, "error": str(e)})
    return {"status": "ok", "results": results}

@app.delete("/api/cached/{folder_name}")
async def delete_cached(folder_name: str):
    """Delete titled folders in sources and clips with graceful job cancellation and strict security checks."""
    try:
        # 1. Terminate or cancel active background jobs for this folder
        target_video_id = None
        if len(folder_name) >= 12 and folder_name[-12] == "_":
            target_video_id = folder_name[-11:]
            
        for j_id, j_info in list(jobs.items()):
            is_match = False
            # Check direct folder match
            if j_info.get("video_info") and j_info["video_info"].get("folder_name") == folder_name:
                is_match = True
            # Check video_id fallback match
            elif target_video_id and j_info.get("url") and target_video_id in j_info["url"]:
                is_match = True
                
            if is_match:
                current_status = j_info.get("status")
                if current_status in ["queued", "downloading", "processing", "checking_transcript", "extracting_audio", "generating_hooks"]:
                    print(f"[delete] Cancelling active background job {j_id} for deleted source {folder_name}")
                    job = jobs[j_id]
                    job["status"] = "cancelled"
                    job["error"] = "Source video deleted by user."
                    jobs[j_id] = job
        
        save_jobs()
        
        # 2. Perform deletion on disk
        count = asset_repository.delete_cached_video(folder_name)
        if count == 0:
            raise HTTPException(status_code=404, detail="Folder not found or already deleted")
            
        return {"deleted": count, "folder": folder_name}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AnalyzeCachedRequest(BaseModel):
    prompt_file: Optional[str] = "prompt.json"
    num_hooks: Optional[int] = 10
    auto_hooks: Optional[bool] = False

@app.post("/api/analyze-cached/{video_id}")
async def analyze_cached(video_id: str, background_tasks: BackgroundTasks, force: bool = False, req: AnalyzeCachedRequest = AnalyzeCachedRequest()):
    """Re-analyze a cached video using the new folder lookup. Supports forcing a re-analysis bypassing hooks.json."""
    import uuid
    cached = asset_repository.get_cached_video(f"https://youtube.com/watch?v={video_id}")
    
    if not cached:
        raise HTTPException(status_code=404, detail=f"Cached video for ID {video_id} not found in titled folders")
    
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        "status": "queued",
        "url": f"https://youtube.com/watch?v={video_id}",
        "video_info": cached,
        "full_video_path": cached["file_path"],
        "audio_path": None,
        "clip_path": None,
        "clip_duration": None,
        "hooks": None,
        "fps": cached.get("fps", 30.0),
        "error": None
    }
    
    background_tasks.add_task(workflow_coordinator.run_full_analysis, job_id, f"https://youtube.com/watch?v={video_id}", "id", force, req.prompt_file or "prompt.json", req.num_hooks or 10, req.auto_hooks or False)
    save_jobs()
    return {"job_id": job_id, "status": "queued", "cached": True}

class SaveHookRequest(BaseModel):
    folder_name: str
    hook: dict

@app.get("/api/cached/{folder_name}/saved_hooks")
def get_saved_hooks(folder_name: str):
    hooks = asset_repository.get_saved_hooks(folder_name)
    return {"saved_hooks": hooks}

@app.post("/api/cached/saved_hooks")
def add_saved_hook(req: SaveHookRequest):
    hooks = asset_repository.add_saved_hook(req.folder_name, req.hook)
    return {"saved_hooks": hooks}

@app.delete("/api/cached/{folder_name}/saved_hooks/{hook_id}")
def remove_saved_hook(folder_name: str, hook_id: str):
    hooks = asset_repository.delete_saved_hook(folder_name, hook_id)
    return {"saved_hooks": hooks}

@app.put("/api/transcript")
async def update_transcript(req: TranscriptEditRequest):
    """Manually update the transcript for a specific clip."""
    clip_transcript_path = os.path.join("temp_assets", "clips", req.folder_name, req.clip_id, "transcript.json")
    
    try:
        os.makedirs(os.path.dirname(clip_transcript_path), exist_ok=True)
        word_count = len(req.transcript)
        with open(clip_transcript_path, "w", encoding="utf-8") as f:
            json.dump(req.transcript, f, ensure_ascii=False, indent=2)
        print(f"[edit] Updated isolated clip transcript at {clip_transcript_path} ({word_count} words)")
        return {"status": "ok"}
    except Exception as e:
        print(f"[edit] Clip save failed for {req.folder_name}/{req.clip_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.put("/api/hooks")
async def update_hooks(req: HookUpdateRequest):
    """Update themes/names in the source hooks.json"""
    hooks_path = os.path.join("temp_assets", "sources", req.folder_name, "hooks.json")
    if os.path.exists(hooks_path):
        try:
            with open(hooks_path, "w", encoding="utf-8") as f:
                json.dump(req.hooks, f, ensure_ascii=False, indent=2)
            # Also update in-memory jobs if active
            for job in jobs.values():
                if job.get("video_info") and os.path.dirname(job["video_info"].get("file_path", "")) == os.path.dirname(hooks_path):
                    job["hooks"] = req.hooks
            return {"status": "ok"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=404, detail="hooks.json not found")

@app.put("/api/style-settings")
async def update_style_settings(req: StyleSettingsRequest):
    """Persist style settings for a specific clip."""
    style_path = os.path.join("temp_assets", "clips", req.folder_name, req.clip_id, "style_settings.json")
    try:
        os.makedirs(os.path.dirname(style_path), exist_ok=True)
        with open(style_path, "w", encoding="utf-8") as f:
            json.dump(req.settings, f, ensure_ascii=False, indent=2)
        print(f"[edit] Updated style settings at {style_path}")
        return {"status": "ok"}
    except Exception as e:
        print(f"[edit] Style save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/timeline")
async def update_timeline(req: TimelineSaveRequest):
    """Persist timeline tracks for a specific clip."""
    timeline_path = os.path.join("temp_assets", "clips", req.folder_name, req.clip_id, "timeline.json")
    try:
        os.makedirs(os.path.dirname(timeline_path), exist_ok=True)
        with open(timeline_path, "w", encoding="utf-8") as f:
            json.dump(req.timeline_tracks, f, ensure_ascii=False, indent=2)
        print(f"[edit] Updated timeline tracks at {timeline_path}")
        return {"status": "ok"}
    except Exception as e:
        print(f"[edit] Timeline save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/timeline-history")
async def update_timeline_history(req: TimelineHistoryRequest):
    """Persist undo/redo history stacks for a specific clip."""
    base = os.path.realpath(os.path.join("temp_assets", "clips"))
    history_path = os.path.realpath(os.path.join("temp_assets", "clips", req.folder_name, req.clip_id, "history.json"))
    if os.path.commonpath([base, history_path]) != base:
        raise HTTPException(status_code=400, detail="Invalid path")
    try:
        os.makedirs(os.path.dirname(history_path), exist_ok=True)
        with open(history_path, "w", encoding="utf-8") as f:
            json.dump({"undo_stack": req.undo_stack, "redo_stack": req.redo_stack}, f, ensure_ascii=False)
        print(f"[edit] Saved timeline history at {history_path}")
        return {"status": "ok"}
    except Exception as e:
        print(f"[edit] Timeline history save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/default-style-settings")
async def update_default_style_settings(req: DefaultStyleSettingsRequest):
    """Persist default style settings for all future clips."""
    default_style_path = os.path.join("temp_assets", "default_style_settings.json")
    try:
        with open(default_style_path, "w", encoding="utf-8") as f:
            json.dump(req.settings, f, ensure_ascii=False, indent=2)
        print(f"[edit] Updated default style settings at {default_style_path}")
        return {"status": "ok"}
    except Exception as e:
        print(f"[edit] Default style save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/default-thumbnail-style")
async def get_default_thumbnail_style():
    """Retrieve default thumbnail style settings."""
    default_style_path = os.path.join("temp_assets", "default_thumbnail_style.json")
    if os.path.exists(default_style_path):
        try:
            with open(default_style_path, "r", encoding="utf-8") as f:
                style = json.load(f)
            return {"style": style}
        except Exception as e:
            print(f"[api] Error reading default thumbnail style: {e}")
    return {"style": None}

@app.put("/api/default-thumbnail-style")
async def update_default_thumbnail_style(req: DefaultThumbnailStyleRequest):
    """Persist default thumbnail style settings for all future clips."""
    default_style_path = os.path.join("temp_assets", "default_thumbnail_style.json")
    try:
        with open(default_style_path, "w", encoding="utf-8") as f:
            json.dump(req.style, f, ensure_ascii=False, indent=2)
        print(f"[edit] Updated default thumbnail style at {default_style_path}")
        return {"status": "ok"}
    except Exception as e:
        print(f"[edit] Default thumbnail style save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/system-settings")
async def get_system_settings():
    """Retrieve system settings from config store."""
    return {"settings": {
        "GEMINI_API_KEY": config_store.get("GEMINI_API_KEY", ""),
        "FFMPEG_PATH": config_store.get("FFMPEG_PATH", ""),
        "NODE_PATH": config_store.get("NODE_PATH", "")
    }}

@app.put("/api/system-settings")
async def update_system_settings(req: SystemSettingsRequest):
    """Update system settings in config store."""
    try:
        if req.GEMINI_API_KEY is not None:
            config_store.set("GEMINI_API_KEY", req.GEMINI_API_KEY)
        if req.FFMPEG_PATH is not None:
            config_store.set("FFMPEG_PATH", req.FFMPEG_PATH)
        if req.NODE_PATH is not None:
            config_store.set("NODE_PATH", req.NODE_PATH)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {e}")


@app.post("/api/validate-gemini-key")
async def validate_gemini_key(req: ValidateKeyRequest):
    """Validate if the given Gemini API keys are active and functional."""
    from google import genai
    from core.genai_client import GeminiGenAIClient
    
    # Instantiate client to reuse its auto-detecting parser
    temp_client = GeminiGenAIClient(api_key=req.api_key)
    keys = temp_client.api_keys
    
    if not keys:
        return {"status": "invalid", "error": "No API keys provided.", "results": []}
        
    results = []
    all_valid = True
    
    for key in keys:
        try:
            client = genai.Client(api_key=key)
            # Call a tiny content generation request to verify the key
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents="Say 'OK'",
            )
            if response.text:
                GeminiGenAIClient.clear_degradation(key)
                results.append({"key": key, "status": "valid", "error": None})
            else:
                all_valid = False
                results.append({"key": key, "status": "invalid", "error": "Empty response from Gemini."})
        except Exception as e:
            all_valid = False
            error_msg = str(e)
            # Clean up standard error messages to be plain and simple (MANDATORY RULE 5)
            if "API_KEY_INVALID" in error_msg or "400" in error_msg:
                error_msg = "The API key is invalid. Please check your spelling and try again."
            elif "quota" in error_msg.lower() or "429" in error_msg:
                error_msg = "Gemini API Quota exceeded. Please check your Google AI Studio billing/plan."
            results.append({"key": key, "status": "invalid", "error": error_msg})
            
    return {
        "status": "valid" if all_valid else "invalid",
        "results": results
    }

COOKIES_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "cookies.txt"))

@app.get("/api/cookies-status")
async def get_cookies_status():
    """Check if cookies.txt exists and return metadata."""
    exists = os.path.exists(COOKIES_PATH)
    size_bytes = 0
    last_modified = None
    if exists:
        try:
            size_bytes = os.path.getsize(COOKIES_PATH)
            mtime = os.path.getmtime(COOKIES_PATH)
            import datetime
            last_modified = datetime.datetime.fromtimestamp(mtime).isoformat()
        except Exception:
            pass
            
    return {
        "exists": exists,
        "size_bytes": size_bytes,
        "last_modified": last_modified,
        "path": COOKIES_PATH
    }

@app.post("/api/upload-cookies")
async def upload_cookies(req: UploadCookiesRequest):
    """Validate and write cookies.txt locally."""
    content = req.cookies_text.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Cookie content cannot be empty.")
        
    # Netscape HTTP Cookie File format validation (Option A)
    # Check if first 150 chars contains "# Netscape" (typical header: "# Netscape HTTP Cookie File")
    first_chunk = content[:150]
    if "# Netscape" not in first_chunk:
        raise HTTPException(
            status_code=400,
            detail="Invalid cookie format. Please ensure you upload/paste a Netscape format cookies.txt file."
        )
        
    try:
        with open(COOKIES_PATH, "w", encoding="utf-8", newline="\n") as f:
            f.write(content + "\n")
        print(f"[system] Saved cookies.txt at {COOKIES_PATH} (size: {len(content)} bytes)")
        return {"status": "ok", "message": "Cookies saved successfully."}
    except Exception as e:
        print(f"[system] Failed to save cookies.txt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to write cookie file: {e}")

@app.delete("/api/delete-cookies")
async def delete_cookies():
    """Safely delete cookies.txt locally."""
    if os.path.exists(COOKIES_PATH):
        try:
            os.remove(COOKIES_PATH)
            print(f"[system] Deleted cookies.txt at {COOKIES_PATH}")
            return {"status": "ok", "message": "Cookies deleted successfully."}
        except Exception as e:
            print(f"[system] Failed to delete cookies.txt: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to delete cookie file: {e}")
    return {"status": "ok", "message": "No cookies file to delete."}

@app.get("/api/system-health")
async def system_health():
    """Perform a diagnostic check on system dependencies."""
    import shutil
    
    # 1. FFmpeg
    # Check if a custom path is specified in the config store or if it exists in the standard PATH
    custom_ffmpeg = config_store.get("FFMPEG_PATH", "")
    ffmpeg_ok = False
    ffmpeg_bin = ""
    
    if custom_ffmpeg:
        # Check standard binary names in the custom folder path
        for name in ["ffmpeg", "ffmpeg.exe"]:
            test_path = os.path.join(custom_ffmpeg, name)
            if os.path.exists(test_path) and os.path.isfile(test_path):
                ffmpeg_ok = True
                ffmpeg_bin = test_path
                break
                
    if not ffmpeg_ok:
        found = shutil.which("ffmpeg")
        if found:
            ffmpeg_ok = True
            ffmpeg_bin = found
            
    # 2. Node.js
    custom_node = config_store.get("NODE_PATH", "")
    node_ok = False
    node_bin = ""
    
    if custom_node:
        for name in ["node", "node.exe"]:
            test_path = os.path.join(custom_node, name)
            if os.path.exists(test_path) and os.path.isfile(test_path):
                node_ok = True
                node_bin = test_path
                break
                
    if not node_ok:
        found = shutil.which("node")
        if found:
            node_ok = True
            node_bin = found
            
    # 3. Virtualenv check
    venv_ok = True
    try:
        import fastapi
        import uvicorn
        import google.genai
    except ImportError:
        venv_ok = False
        
    # 4. Check GEMINI_API_KEY
    gemini_key = config_store.get("GEMINI_API_KEY") or ""
    has_key = len(gemini_key.strip()) > 0
    
    # 5. Check cookies.txt
    cookies_configured = os.path.exists(COOKIES_PATH)

    
    return {
        "ffmpeg": {
            "status": "OK" if ffmpeg_ok else "Missing",
            "path": ffmpeg_bin or "Not Found"
        },
        "node": {
            "status": "OK" if node_ok else "Missing",
            "path": node_bin or "Not Found"
        },
        "python_env": {
            "status": "OK" if venv_ok else "Degraded",
            "active": True
        },
        "gemini_api": {
            "status": "Configured" if has_key else "Not Configured",
            "has_key": has_key
        },
        "cookies": {
            "status": "Configured" if cookies_configured else "Not Configured",
            "exists": cookies_configured
        }
    }

# --- Thumbnail Endpoints ---

@app.post("/api/thumbnail/screenshot")
async def thumbnail_screenshot(req: ThumbnailScreenshotRequest):
    """Extract a single frame from the clip video as thumbnail."""
    import subprocess, random
    
    if req.job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[req.job_id]
    clip_path = job.get("clip_path")
    if not clip_path or not os.path.exists(clip_path):
        raise HTTPException(status_code=400, detail="No clip available. Extract a clip first.")
    
    clip_dir = os.path.dirname(clip_path)
    clip_duration = job.get("clip_duration", 10.0)
    
    # Determine timestamp
    if req.timestamp is not None:
        ts = max(0.0, min(req.timestamp, clip_duration - 0.1))
    else:
        # Random frame from first 80% of clip
        ts = random.uniform(0.5, clip_duration * 0.8)
    
    thumb_path = os.path.join(clip_dir, "thumbnail.jpg")
    
    cmd = [
        "ffmpeg", "-y",
        "-i", clip_path,
        "-ss", f"{ts:.3f}",
        "-frames:v", "1",
        "-q:v", "2",
        thumb_path
    ]
    
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
    if result.returncode != 0:
        print(f"[thumbnail] FFmpeg failed: {result.stderr}")
        raise HTTPException(status_code=500, detail="Failed to extract thumbnail frame")
    
    # Build asset URL from clip path structure
    # clip_path = temp_assets/clips/<folder>/<clip_id>/video.mp4
    parts = clip_path.replace("\\", "/").split("/")
    # Find clips index
    try:
        clips_idx = parts.index("clips")
        relative = "/".join(parts[clips_idx:])
        asset_url = f"/assets/{relative.rsplit('/', 1)[0]}/thumbnail.jpg"
    except:
        asset_url = f"/assets/clips/thumbnail.jpg"
    
    print(f"[thumbnail] Captured frame at {ts:.3f}s → {thumb_path}")
    return {"status": "ok", "timestamp": round(ts, 3), "thumbnail_url": asset_url}

@app.put("/api/thumbnail/config")
async def save_thumbnail_config(req: ThumbnailConfigRequest):
    """Save thumbnail configuration for a clip."""
    config_path = os.path.join("temp_assets", "clips", req.folder_name, req.clip_id, "thumbnail_config.json")
    try:
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(req.config, f, ensure_ascii=False, indent=2)
        print(f"[thumbnail] Saved config to {config_path}")
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/thumbnail/config/{folder_name}/{clip_id}")
async def get_thumbnail_config(folder_name: str, clip_id: str):
    """Load thumbnail configuration for a clip."""
    config_path = os.path.join("temp_assets", "clips", folder_name, clip_id, "thumbnail_config.json")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        return {"config": config}
    
    # Pre-populate with default thumbnail config if default_thumbnail_style exists
    default_style_path = os.path.join("temp_assets", "default_thumbnail_style.json")
    if os.path.exists(default_style_path):
        try:
            with open(default_style_path, "r", encoding="utf-8") as f:
                default_style = json.load(f)
            duration = default_style.get("thumbnailDuration", 1.0)
            initial_config = {
                "enabled": False,
                "duration": duration,
                "screenshotTime": 0,
                "textOverlays": [],
                "xOffset": 50
            }
            os.makedirs(os.path.dirname(config_path), exist_ok=True)
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(initial_config, f, ensure_ascii=False, indent=2)
            print(f"[thumbnail] Pre-populated default thumbnail config to {config_path}")
            return {"config": initial_config}
        except Exception as e:
            print(f"[thumbnail] Failed to pre-populate default config: {e}")
            
    return {"config": None}

@app.delete("/api/thumbnail/{folder_name}/{clip_id}")
async def delete_thumbnail(folder_name: str, clip_id: str):
    """Delete thumbnail image and config for a clip."""
    clip_dir = os.path.join("temp_assets", "clips", folder_name, clip_id)
    thumb_path = os.path.join(clip_dir, "thumbnail.jpg")
    config_path = os.path.join(clip_dir, "thumbnail_config.json")
    
    deleted_files = []
    try:
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
            deleted_files.append("thumbnail.jpg")
        if os.path.exists(config_path):
            os.remove(config_path)
            deleted_files.append("thumbnail_config.json")
        return {"status": "ok", "deleted": deleted_files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/load-ready-clip")
async def load_ready_clip(req: LoadReadyClipRequest):
    """Initialize a job state from an existing ready clip."""
    import uuid
    
    # 1. Verify clip exists
    clip_dir = os.path.join("temp_assets", "clips", req.folder_name, req.clip_id)
    clip_path = os.path.join(clip_dir, "video.mp4")
    transcript_path = os.path.join(clip_dir, "transcript.json")
    
    if not os.path.exists(clip_path) or not os.path.exists(transcript_path):
        raise HTTPException(status_code=404, detail="Ready clip assets not found")
        
    # 2. Get source video info
    video_info = asset_repository.get_cached_video_by_folder(req.folder_name)
    if not video_info:
        raise HTTPException(status_code=404, detail="Source video folder not found")
        
    # 3. Parse clip metadata from ID
    start_time = 0.0
    end_time = 0.0
    theme = ""
    parts = req.clip_id.split("_")
    if len(parts) >= 2:
        try:
            start_time = float(parts[0])
            end_time = float(parts[1])
            if len(parts) >= 3:
                theme = " ".join(parts[2:]).replace("_", " ")
        except:
            pass

    # 4. Create a job marked as ready (deterministically derived from folder name and clip ID)
    import hashlib
    hash_input = f"{req.folder_name}_{req.clip_id}"
    job_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()[:8]
    duration = asset_repository.get_video_duration(clip_path)
    
    # 5. Load generated hooks from sources folder
    ready_hooks = []
    source_hooks_path = os.path.join("temp_assets", "sources", req.folder_name, "hooks.json")
    if os.path.exists(source_hooks_path):
        try:
            with open(source_hooks_path, "r", encoding="utf-8") as f:
                ready_hooks = json.load(f)
                print(f"[debug] Loaded {len(ready_hooks)} hooks from sources/{req.folder_name}/hooks.json")
        except Exception as e:
            print(f"[debug] Failed to read source hooks: {e}")

    # 6. Extract transcript quote for the CURRENT active clip so the editor is populated
    active_quote = "No transcript preview available."
    active_transcript_path = os.path.join(os.path.dirname(clip_path), "transcript.json")
    if os.path.exists(active_transcript_path):
        try:
            with open(active_transcript_path, "r", encoding="utf-8") as f:
                t_data = json.load(f)
                if isinstance(t_data, list) and len(t_data) > 0:
                    active_quote = " ".join([s.get("text", "") for s in t_data]).strip()
                    if len(active_quote) > 1000: active_quote = active_quote[:997] + "..."
        except Exception as e:
            print(f"[debug] Failed to read active transcript: {e}")
    
    # Sort hooks so the current one is likely found correctly by index
    ready_hooks.sort(key=lambda x: x["start"])

    # 7. Snap the active clip's start/end to the closest hook in the list 
    # to ensure the frontend highlight logic (matching by timestamp) works perfectly.
    snapped_start, snapped_end = start_time, end_time
    for h in ready_hooks:
        if abs(h.get("start", 0) - start_time) < 0.5 and abs(h.get("end", 0) - end_time) < 0.5:
            snapped_start = h.get("start", 0)
            snapped_end = h.get("end", 0)
            print(f"[debug] Snapped active clip to matching hook: {snapped_start} - {snapped_end}")
            break

    jobs[job_id] = {
        "status": "ready",
        "url": f"https://youtube.com/watch?v={video_info['video_id']}",
        "video_info": video_info,
        "full_video_path": video_info["file_path"],
        "clip_path": clip_path,
        "clip_duration": duration,
        "clip": {
            "asset_url": f"/assets/clips/{req.folder_name}/{req.clip_id}/video.mp4",
            "duration": duration,
            "file_path": clip_path,
            "start": snapped_start,
            "end": snapped_end,
            "theme": theme,
            "transcript_quote": active_quote
        },
        "hooks": ready_hooks,
        "fps": video_info.get("fps", 30.0),
        "error": None
    }
    
    save_jobs()
    print(f"[api] Loaded ready clip {req.clip_id} into job {job_id}")
    # Load persisted history if it exists
    history_data = None
    history_path = os.path.join(clip_dir, "history.json")
    if os.path.exists(history_path):
        try:
            with open(history_path, "r", encoding="utf-8") as f:
                history_data = json.load(f)
            print(f"[api] Loaded persisted history from {history_path}")
        except Exception as e:
            print(f"[api] Failed to read history: {e}")

    return {
        "job_id": job_id, 
        "status": "ready",
        "clip": jobs[job_id]["clip"],
        "hooks": jobs[job_id]["hooks"],
        "fps": jobs[job_id]["fps"],
        "history": history_data
    }
