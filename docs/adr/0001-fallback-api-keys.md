# 1. Fallback API Keys and Storage

We decided to support multiple fallback Gemini API keys by storing them within the existing `GEMINI_API_KEY` configuration. To support metadata such as key titles and explicit ordering while maintaining backward compatibility, the configuration format is auto-detecting:
- **Structured JSON Array**: If the value starts with `[`, it is parsed as a JSON array of objects (e.g. `[{"title": "Primary", "value": "AIzaSy..."}, ...]`). This preserves custom titles and the exact ordering chosen by the user.
- **Legacy String**: If the value is a plain string, it is treated as a comma-separated fallback list (or a single key) with default titles.

When a key is exhausted or invalid, the backend rolls over to the next key in sequence, tracking degraded keys in-memory with a cool-down window. Reordering is performed dynamically using a premium hybrid interaction scheme: drag-and-drop handles powered by native HTML5 drag-and-drop APIs, with up/down arrow buttons kept as accessible fallback controls.

## Placeholder Key Exclusion & Health Validation
Template placeholder keys (such as `your_gemini_api_key_here`, `your_api_key_here`, patterns like `your_*_here`, or empty strings) are strictly excluded from the active key list:
- The system health diagnostic (`/api/system-health`) only marks `gemini_api` as `Configured` (`has_key = True`) if at least one valid, non-placeholder key is present.
- The Settings UI (`/settings`) deserializes placeholder values as an empty key list, rendering the empty state prompt (`Add API Key`) instead of pre-populating dummy keys.
- The backend `GenAIClient` and workflow pipeline ignore placeholder keys, avoiding unauthorized 400 API calls against dummy credentials.

