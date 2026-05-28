import os
import requests
import json
from abc import ABC, abstractmethod

# Default Configuration
DEFAULT_MANIFEST_PATH = "shared/fonts_manifest.json"
DEFAULT_FONT_DIR = "frontend/app/assets/fonts"
DEFAULT_FRONTEND_CSS = "frontend/app/assets/css/fonts.css"
DEFAULT_REMOTION_CSS = "remotion_engine/src/fonts.css"
API_BASE = "https://gwfh.mranftl.com/api/fonts"


class FontDownloaderClient(ABC):
    """
    Abstract port/seam defining Font Downloader I/O operations.
    Allows clean, in-process mocked substitutions during test runs.
    """
    @abstractmethod
    def fetch_json(self, url: str) -> dict:
        pass

    @abstractmethod
    def download_file(self, url: str, dest_path: str) -> None:
        pass


class ProdFontDownloaderClient(FontDownloaderClient):
    """
    Production adapter implementing true network and disk I/O operations.
    """
    def fetch_json(self, url: str) -> dict:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()

    def download_file(self, url: str, dest_path: str) -> None:
        print(f"Downloading {url} to {dest_path}...")
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        # Absolute path validation to block directory traversals
        dest_abs = os.path.abspath(dest_path)
        base_abs = os.path.abspath(os.path.dirname(dest_path))
        if not dest_abs.startswith(base_abs):
            raise ValueError(f"Path traversal detected: {dest_path}")

        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)


class FontManager:
    """
    A deep module that encapsulates the synchronization lifecycle of Google fonts.
    Reads from a single source manifest and generates synchronized stylesheets for
    both the Nuxt frontend and Remotion Engine.
    """
    def __init__(self, 
                 manifest_path: str = DEFAULT_MANIFEST_PATH,
                 font_dir: str = DEFAULT_FONT_DIR,
                 frontend_css: str = DEFAULT_FRONTEND_CSS,
                 remotion_css: str = DEFAULT_REMOTION_CSS,
                 downloader: FontDownloaderClient = None):
        self.manifest_path = manifest_path
        self.font_dir = font_dir
        self.frontend_css = frontend_css
        self.remotion_css = remotion_css
        self.downloader = downloader or ProdFontDownloaderClient()

    def _compile_font_face(self, font_name: str, style: str, weight: str, rel_path: str) -> str:
        """Helper to build a clean standard @font-face CSS declaration block."""
        return f"""@font-face {{
  font-family: '{font_name}';
  font-style: {style};
  font-weight: {weight};
  font-display: swap;
  src: url('{rel_path}') format('woff2');
}}"""

    def sync(self) -> bool:
        """
        Executes the atomic self-healing synchronization sequence.
        Returns True if successful, False otherwise.
        """
        if not os.path.exists(self.manifest_path):
            print(f"Manifest file missing: {self.manifest_path}")
            return False

        try:
            with open(self.manifest_path, 'r', encoding='utf-8') as f:
                manifest_data = json.load(f)
        except Exception as e:
            print(f"Failed to parse manifest: {e}")
            return False

        fonts_list = manifest_data.get("fonts", [])
        frontend_css_content = []
        remotion_css_content = []

        for font in fonts_list:
            font_id = font.get("id")
            font_name = font.get("name")
            if not font_id or not font_name:
                continue

            print(f"\nProcessing {font_name} ({font_id})...")
            url = f"{API_BASE}/{font_id}?subsets=latin"

            try:
                data = self.downloader.fetch_json(url)
                variants = data.get('variants', [])
                
                for variant in variants:
                    weight = variant.get('fontWeight')
                    style = variant.get('fontStyle')
                    woff2_url = variant.get('woff2')
                    
                    if not woff2_url:
                        print(f"No woff2 for {font_id} {weight} {style}")
                        continue
                    
                    filename = f"{font_id}-{weight}-{style}.woff2"
                    
                    # Local path resolution (for physical downloads)
                    dest_path = os.path.join(self.font_dir, font_id, filename)
                    
                    # Check if file exists to skip redundant downloads
                    if not os.path.exists(dest_path):
                        self.downloader.download_file(woff2_url, dest_path)
                    
                    # Compiles relative stylesheet paths tailored to each deployment target
                    frontend_rel_path = f"../fonts/{font_id}/{filename}"
                    remotion_rel_path = f"./assets/fonts/{font_id}/{filename}"

                    frontend_css_content.append(
                        self._compile_font_face(font_name, style, weight, frontend_rel_path)
                    )
                    remotion_css_content.append(
                        self._compile_font_face(font_name, style, weight, remotion_rel_path)
                    )
                    
            except Exception as e:
                print(f"Error processing {font_id}: {e}")

        # Ensure parent paths exist before writing compiled stylesheets
        try:
            if frontend_css_content:
                os.makedirs(os.path.dirname(self.frontend_css), exist_ok=True)
                with open(self.frontend_css, 'w', encoding='utf-8') as f:
                    f.write("\n".join(frontend_css_content))
                print(f"Generated Frontend CSS at {self.frontend_css}")

            if remotion_css_content:
                os.makedirs(os.path.dirname(self.remotion_css), exist_ok=True)
                with open(self.remotion_css, 'w', encoding='utf-8') as f:
                    f.write("\n".join(remotion_css_content))
                print(f"Generated Remotion CSS at {self.remotion_css}")
                
            return True
        except Exception as e:
            print(f"Failed to write CSS outputs: {e}")
            return False


def main():
    manager = FontManager()
    success = manager.sync()
    if success:
        print("\nDone! Fonts sync completed successfully.")
    else:
        print("\nFailed! Fonts sync encountered issues.")


if __name__ == "__main__":
    main()
