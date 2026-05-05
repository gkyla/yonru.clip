import os
import re
import json
import subprocess
import shutil
import glob

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
SOURCE_DIR = os.path.join(BASE_DIR, "temp_assets", "sources")
CLIPS_DIR = os.path.join(BASE_DIR, "temp_assets", "clips")
YT_DLP_BIN = os.path.join(BASE_DIR, "bin", "yt-dlp")

def sanitize(title):
    s = re.sub(r'[^\w\s-]', '_', title).strip()
    return s[:50].replace(' ', '_')

def get_info(video_id):
    print(f"Fetching title for {video_id}...")
    cmd = [YT_DLP_BIN, "--get-title", "--no-playlist", f"https://youtube.com/watch?v={video_id}"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception as e:
        print(f"Error fetching info: {e}")
    return "Unknown"

def migrate():
    if not os.path.exists(SOURCE_DIR):
        print("No source directory found.")
        return

    # Find all *_full.mp4 files
    sources = [f for f in os.listdir(SOURCE_DIR) if f.endswith("_full.mp4")]
    print(f"Found {len(sources)} source videos to migrate.")

    for f in sources:
        video_id = f.replace("_full.mp4", "")
        title = get_info(video_id)
        safe_title = sanitize(title)
        folder_name = f"{safe_title}_{video_id}"
        
        # New paths
        new_source_dir = os.path.join(SOURCE_DIR, folder_name)
        new_clips_dir = os.path.join(CLIPS_DIR, folder_name)
        
        os.makedirs(new_source_dir, exist_ok=True)
        os.makedirs(new_clips_dir, exist_ok=True)
        
        # Move source files
        # Files like: ID_full.mp4, ID_full_audio.m4a, ID_thumb.jpg
        for src_file in os.listdir(SOURCE_DIR):
            if src_file.startswith(video_id) and os.path.isfile(os.path.join(SOURCE_DIR, src_file)):
                old_path = os.path.join(SOURCE_DIR, src_file)
                # Map names to structured ones
                if src_file.endswith("_full.mp4"): target_name = "full.mp4"
                elif src_file.endswith("_audio.m4a"): target_name = "audio.m4a"
                elif src_file.endswith("_thumb.jpg"): target_name = "thumb.jpg"
                else: target_name = src_file # fallback
                
                print(f"Moving source {src_file} -> {folder_name}/{target_name}")
                shutil.move(old_path, os.path.join(new_source_dir, target_name))

        # Move clip files
        # Files like: ID_clip_...mp4
        if os.path.exists(CLIPS_DIR):
            for clip_file in os.listdir(CLIPS_DIR):
                if clip_file.startswith(video_id) and os.path.isfile(os.path.join(CLIPS_DIR, clip_file)):
                    old_path = os.path.join(CLIPS_DIR, clip_file)
                    print(f"Moving clip {clip_file} -> {folder_name}/{clip_file}")
                    shutil.move(old_path, os.path.join(new_clips_dir, clip_file))

    print("Migration complete!")

if __name__ == "__main__":
    migrate()
