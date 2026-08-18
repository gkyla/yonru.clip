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
from core.system_repository import SystemRepository
system_repository = SystemRepository(config_store=config_store, cookies_path=cookie_path)

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
    language: str = "auto"
    prompt_file: Optional[str] = "prompt.json"
    num_hooks: Optional[int] = 10
    auto_hooks: Optional[bool] = False
    extraction_mode: Optional[str] = "preset"
    preset_id: Optional[str] = "auto"
    focus_topic: Optional[str] = None
    min_duration: Optional[int] = 30
    max_duration: Optional[int] = 180

class ExtractRequest(BaseModel):
    job_id: str
    start_time: float
    end_time: float
    theme: Optional[str] = None
    whisper_model: Optional[str] = "base"

class RenderRequest(BaseModel):
    job_id: str
    hook_index: int = 0
    video_layout: Optional[str] = "vertical"
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
    whisper_model: Optional[str] = "base"
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
    try:
        prompt_repository.add_prompt(
            name=req.promptName,
            suitable_for=req.suitableFor,
            prompt=req.prompt,
            num_hooks=req.numHooks or 10,
            auto_hooks=req.autoHooks or False
        )
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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
    
    background_tasks.add_task(
        workflow_coordinator.run_full_analysis,
        job_id,
        req.url,
        req.language,
        force,
        req.prompt_file or "prompt.json",
        req.num_hooks or 10,
        req.auto_hooks or False,
        req.extraction_mode or "preset",
        req.preset_id or "auto",
        req.focus_topic,
        req.min_duration or 30,
        req.max_duration or 180
    )
    save_jobs()
    return {"job_id": job_id, "status": "queued"}

@app.post("/api/extract-clip")
async def extract_clip(req: ExtractRequest, background_tasks: BackgroundTasks):
    """Phase 2: Cut segment from cached full video (no re-download)"""
    if req.job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return workflow_coordinator.provision_clip(
        job_id=req.job_id,
        start_time=req.start_time,
        end_time=req.end_time,
        theme=req.theme,
        whisper_model=req.whisper_model or "base",
        background_tasks=background_tasks
    )


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
        "download_percent": job.get("download_percent", 0.0),
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
            "folder_name": folder_name,
            "hd_ready": job["video_info"].get("hd_ready", False),
            "has_preview": job["video_info"].get("has_preview", False)
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
    
    result = render_engine.render(jobs[req.job_id], req, asset_repository, output_name=req.output_name)
    if result:
        return {"status": "done", "output_url": result["output_url"]}
    else:
        raise HTTPException(status_code=500, detail="Render failed")

@app.post("/api/render-stream")
async def render_clip_stream(req: RenderRequest):
    """Render clip with real-time progress streaming via SSE."""
    if req.job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    def sse_generator():
        for progress in render_engine.render_stream(jobs[req.job_id], req, asset_repository, output_name=req.output_name):
            yield f"data: {json.dumps(progress)}\n\n"
    
    return StreamingResponse(sse_generator(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    })


# --- Cache Management ---

@app.get("/api/cached")
async def list_cached(
    page: int = 1,
    limit: int = 6,
    search: Optional[str] = None,
    sort_by: str = "date",
    order: str = "desc"
):
    """List, search, sort and paginate cached full videos in temp_assets."""
    return asset_repository.list_cached_videos(
        page=page,
        limit=limit,
        search=search,
        sort_by=sort_by,
        order=order
    )

@app.get("/api/ready-clips")
async def list_ready_clips():
    """List all segments that have been cut and transcribed."""
    active_clip_ids = set()
    try:
        for job_id, job in jobs.items():
            if job.get("status") in ["cutting", "transcribing", "queued"]:
                c_id = job.get("clip_id") or (job.get("clip") or {}).get("clip_id")
                if c_id:
                    active_clip_ids.add(c_id)
    except Exception as e:
        print(f"[api] Error reading active jobs for ready-clips: {e}")
        
    filtered_clips = asset_repository.list_ready_clips(active_clip_ids=active_clip_ids)
    return {"clips": filtered_clips}

@app.delete("/api/ready-clips/{folder_name}/{clip_id}")
async def delete_ready_clip(folder_name: str, clip_id: str):
    """Delete a specific clip folder."""
    try:
        success = asset_repository.delete_clip_with_job(folder_name, clip_id, job_store=jobs)
        if not success:
            raise HTTPException(status_code=404, detail="Clip not found")
        return {"status": "deleted", "clip_id": clip_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/ready-clips/delete-batch")
async def delete_ready_clips_batch(req: BatchDeleteClipsRequest):
    """Delete multiple clips in one go."""
    results = []
    for item in req.clips:
        folder_name = item.get("folder_name")
        clip_id = item.get("clip_id")
        if folder_name and clip_id:
            try:
                success = asset_repository.delete_clip_with_job(folder_name, clip_id, job_store=jobs)
                results.append({"clip_id": clip_id, "success": success})
            except ValueError as e:
                print(f"[delete-batch] Validation failed for {folder_name}/{clip_id}: {e}")
                results.append({"clip_id": clip_id, "success": False, "error": str(e)})
    return {"status": "ok", "results": results}

@app.delete("/api/cached/{folder_name}")
async def delete_cached(folder_name: str):
    """Delete titled folders in sources and clips with graceful job cancellation and strict security checks."""
    try:
        count = asset_repository.delete_cached_video_with_jobs(folder_name, job_store=jobs)
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
    extraction_mode: Optional[str] = "preset"
    preset_id: Optional[str] = "auto"
    focus_topic: Optional[str] = None
    min_duration: Optional[int] = 30
    max_duration: Optional[int] = 180

@app.post("/api/analyze-cached/{video_id}")
async def analyze_cached(video_id: str, background_tasks: BackgroundTasks, force: bool = False, req: AnalyzeCachedRequest = AnalyzeCachedRequest()):
    """Re-analyze a cached video using the new folder lookup. Supports forcing a re-analysis bypassing hooks.json."""
    import uuid
    cached = asset_repository.get_cached_video(f"https://youtube.com/watch?v={video_id}")
    
    if not cached:
        raise HTTPException(status_code=404, detail=f"Cached video for ID {video_id} not found in titled folders")
    
    # If force is False, and hooks.json exists, load it immediately and return status ready
    if not force and cached.get("file_path"):
        import os
        import json
        folder_name = os.path.basename(os.path.dirname(cached["file_path"]))
        hooks_cache_path = os.path.join(os.path.dirname(cached["file_path"]), "hooks.json")
        if os.path.exists(hooks_cache_path):
            try:
                with open(hooks_cache_path, "r", encoding="utf-8") as f:
                    hooks_json = f.read()
                raw_hooks = json.loads(hooks_json)
                filtered = asset_repository.sanitize_and_prepare_hooks(raw_hooks, cached)
                job_id = str(uuid.uuid4())[:8]
                is_hd_ready = cached.get("hd_ready", False)
                job_status = "ready" if is_hd_ready else "hooks_ready"
                download_percent = 100.0 if is_hd_ready else 0.0
                
                jobs[job_id] = {
                    "status": job_status,
                    "url": f"https://youtube.com/watch?v={video_id}",
                    "video_info": cached,
                    "full_video_path": cached["file_path"],
                    "audio_path": None,
                    "clip_path": None,
                    "clip_duration": None,
                    "hooks": filtered,
                    "fps": cached.get("fps", 30.0),
                    "download_percent": download_percent,
                    "error": None
                }
                save_jobs()
                
                if not is_hd_ready:
                    import threading
                    t = threading.Thread(
                        target=workflow_coordinator.run_source_download,
                        args=(job_id, f"https://youtube.com/watch?v={video_id}")
                    )
                    t.daemon = True
                    t.start()
                    print(f"[cache] Triggered background prefetch of HD source for {video_id}")
                else:
                    print(f"[cache] Video and hooks loaded instantly from cache for {video_id}")
                    
                _heatmap = cached.get("heatmap") or []
                return {
                    "job_id": job_id,
                    "status": job_status,
                    "hooks": filtered,
                    "folder_name": folder_name,
                    "video": {
                        "title": cached.get("title"),
                        "duration": cached.get("duration"),
                        "has_heatmap": len(_heatmap) > 0,
                        "heatmap_segments": len(_heatmap),
                        "asset_url": cached.get("asset_url"),
                        "folder_name": folder_name,
                        "fps": cached.get("fps", 30.0),
                        "hd_ready": is_hd_ready,
                        "has_preview": cached.get("has_preview", False)
                    },
                    "cached": True
                }
            except Exception as e:
                print(f"[cache] Failed to load cached hooks for {video_id}: {e}")

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
    
    background_tasks.add_task(
        workflow_coordinator.run_full_analysis,
        job_id,
        f"https://youtube.com/watch?v={video_id}",
        "id",
        force,
        req.prompt_file or "prompt.json",
        req.num_hooks or 10,
        req.auto_hooks or False,
        req.extraction_mode or "preset",
        req.preset_id or "auto",
        req.focus_topic,
        req.min_duration or 30,
        req.max_duration or 180
    )
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
    try:
        asset_repository.save_clip_transcript(req.folder_name, req.clip_id, req.transcript)
        print(f"[edit] Updated isolated clip transcript for {req.folder_name}/{req.clip_id} ({len(req.transcript)} words)")
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[edit] Clip save failed for {req.folder_name}/{req.clip_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/hooks")
async def update_hooks(req: HookUpdateRequest):
    """Update themes/names in the source hooks.json"""
    try:
        updated = asset_repository.update_source_hooks(req.folder_name, req.hooks)
        if not updated:
            raise HTTPException(status_code=404, detail="hooks.json not found")
        # Also update in-memory jobs if active
        for job in jobs.values():
            if job.get("video_info") and job["video_info"].get("folder_name") == req.folder_name:
                job["hooks"] = req.hooks
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/style-settings")
async def update_style_settings(req: StyleSettingsRequest):
    """Persist style settings for a specific clip."""
    try:
        asset_repository.save_clip_style_settings(req.folder_name, req.clip_id, req.settings)
        print(f"[edit] Updated style settings for {req.folder_name}/{req.clip_id}")
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[edit] Style save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/timeline")
async def update_timeline(req: TimelineSaveRequest):
    """Persist timeline tracks for a specific clip."""
    try:
        asset_repository.save_clip_timeline(req.folder_name, req.clip_id, req.timeline_tracks)
        print(f"[edit] Updated timeline tracks for {req.folder_name}/{req.clip_id}")
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[edit] Timeline save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/timeline-history")
async def update_timeline_history(req: TimelineHistoryRequest):
    """Persist undo/redo history stacks for a specific clip."""
    try:
        asset_repository.save_clip_history(req.folder_name, req.clip_id, req.undo_stack, req.redo_stack)
        print(f"[edit] Saved timeline history for {req.folder_name}/{req.clip_id}")
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[edit] Timeline history save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/default-style-settings")
async def update_default_style_settings(req: DefaultStyleSettingsRequest):
    """Persist default style settings for all future clips."""
    try:
        asset_repository.save_default_style_settings(req.settings)
        print(f"[edit] Updated default style settings")
        return {"status": "ok"}
    except Exception as e:
        print(f"[edit] Default style save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/default-thumbnail-style")
async def get_default_thumbnail_style():
    """Retrieve default thumbnail style settings."""
    style = asset_repository.get_default_thumbnail_style()
    return {"style": style}

@app.put("/api/default-thumbnail-style")
async def update_default_thumbnail_style(req: DefaultThumbnailStyleRequest):
    """Persist default thumbnail style settings for all future clips."""
    try:
        asset_repository.save_default_thumbnail_style(req.style)
        print(f"[edit] Updated default thumbnail style")
        return {"status": "ok"}
    except Exception as e:
        print(f"[edit] Default thumbnail style save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/system-settings")
async def get_system_settings():
    """Retrieve system settings from system repository."""
    return {"settings": system_repository.get_settings()}

@app.put("/api/system-settings")
async def update_system_settings(req: SystemSettingsRequest):
    """Update system settings in system repository."""
    try:
        system_repository.update_settings(
            gemini_api_key=req.GEMINI_API_KEY,
            ffmpeg_path=req.FFMPEG_PATH,
            node_path=req.NODE_PATH,
        )
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {e}")


@app.post("/api/validate-gemini-key")
async def validate_gemini_key(req: ValidateKeyRequest):
    """Validate if the given Gemini API keys are active and functional."""
    return system_repository.validate_gemini_keys(req.api_key)


@app.get("/api/cookies-status")
async def get_cookies_status():
    """Check if cookies.txt exists and return metadata."""
    return system_repository.get_cookies_status()

@app.post("/api/upload-cookies")
async def upload_cookies(req: UploadCookiesRequest):
    """Validate and write cookies.txt locally."""
    try:
        system_repository.save_cookies(req.cookies_text)
        return {"status": "ok", "message": "Cookies saved successfully."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write cookie file: {e}")

@app.delete("/api/delete-cookies")
async def delete_cookies():
    """Safely delete cookies.txt locally."""
    try:
        deleted = system_repository.delete_cookies()
        if deleted:
            return {"status": "ok", "message": "Cookies deleted successfully."}
        return {"status": "ok", "message": "No cookies file to delete."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete cookie file: {e}")

@app.get("/api/system-health")
async def system_health():
    """Perform a diagnostic check on system dependencies."""
    return system_repository.check_system_health()

# --- Thumbnail Endpoints ---

@app.post("/api/thumbnail/screenshot")
async def thumbnail_screenshot(req: ThumbnailScreenshotRequest):
    """Extract a single frame from the clip video as thumbnail."""
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
        import random
        ts = random.uniform(0.5, clip_duration * 0.8)
    
    thumb_path = os.path.join(clip_dir, "thumbnail.jpg")
    success = asset_repository.extract_clip_screenshot(clip_path, ts, thumb_path)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to extract thumbnail frame")
    
    parts = clip_path.replace("\\", "/").split("/")
    try:
        clips_idx = parts.index("clips")
        relative = "/".join(parts[clips_idx:])
        asset_url = f"/assets/{relative.rsplit('/', 1)[0]}/thumbnail.jpg"
    except Exception:
        asset_url = "/assets/clips/thumbnail.jpg"
    
    print(f"[thumbnail] Captured frame at {ts:.3f}s → {thumb_path}")
    return {"status": "ok", "timestamp": round(ts, 3), "thumbnail_url": asset_url}

@app.put("/api/thumbnail/config")
async def save_thumbnail_config(req: ThumbnailConfigRequest):
    """Save thumbnail configuration for a clip."""
    try:
        asset_repository.save_thumbnail_config(req.folder_name, req.clip_id, req.config)
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/thumbnail/config/{folder_name}/{clip_id}")
async def get_thumbnail_config(folder_name: str, clip_id: str):
    """Load thumbnail configuration for a clip."""
    try:
        config = asset_repository.get_thumbnail_config(folder_name, clip_id)
        if config is not None:
            return {"config": config}
        
        default_style = asset_repository.get_default_thumbnail_style()
        if default_style:
            duration = default_style.get("thumbnailDuration", 1.0)
            initial_config = {
                "enabled": False,
                "duration": duration,
                "screenshotTime": 0,
                "textOverlays": [],
                "xOffset": 50
            }
            asset_repository.save_thumbnail_config(folder_name, clip_id, initial_config)
            return {"config": initial_config}
        return {"config": None}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/thumbnail/{folder_name}/{clip_id}")
async def delete_thumbnail(folder_name: str, clip_id: str):
    """Delete thumbnail image and config for a clip."""
    try:
        asset_repository.delete_thumbnail(folder_name, clip_id)
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/load-ready-clip")
async def load_ready_clip(req: LoadReadyClipRequest, background_tasks: BackgroundTasks):
    """Initialize a job state from an existing ready clip."""
    try:
        res = workflow_coordinator.load_ready_clip(
            folder_name=req.folder_name,
            clip_id=req.clip_id,
            whisper_model=req.whisper_model or "base",
            background_tasks=background_tasks
        )
        return {
            "job_id": res["job_id"], 
            "status": res["status"],
            "clip": res["job"]["clip"],
            "hooks": res["job"]["hooks"],
            "fps": res["job"]["fps"],
            "history": res.get("history")
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/clips/{folder_name}/{clip_id}/track-face")
async def track_face_for_clip(folder_name: str, clip_id: str):
    """Generates, saves, and returns Auto-Reframe crop_map.json for a clip."""
    clip_dir = os.path.join(asset_repository.clips_dir, folder_name, clip_id)
    video_path = os.path.join(clip_dir, "video.mp4")
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Clip video not found")
    
    crop_map_points = system_repository.get_or_create_crop_map(clip_dir, video_path)
    return {"status": "ready", "crop_map": crop_map_points}

