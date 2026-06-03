# 1. Fallback API Keys and Storage

We decided to support multiple fallback Gemini API keys by storing them as a comma-separated list within the existing `GEMINI_API_KEY` configuration. When a key is exhausted or invalid, the backend automatically falls back to the next available key in sequence, tracking degraded keys in-memory with a cool-down window. We chose a comma-separated string to preserve backward compatibility with existing single-key setups and minimize configuration schema mutations.
