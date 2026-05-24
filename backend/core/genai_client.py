from abc import ABC, abstractmethod
from google import genai
from google.genai import types

class GenAIClient(ABC):
    @abstractmethod
    def generate_json(self, prompt: str, model_name: str) -> str:
        """Sends the prompt to GenAI provider and returns the raw JSON text response."""
        pass


class GeminiGenAIClient(GenAIClient):
    def __init__(self, api_key: str = None):
        self.client = genai.Client(api_key=api_key)

    def generate_json(self, prompt: str, model_name: str) -> str:
        response = self.client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        return response.text


class MockGenAIClient(GenAIClient):
    def __init__(self, mock_response: str = "[]"):
        self.mock_response = mock_response
        self.last_prompt = None

    def generate_json(self, prompt: str, model_name: str) -> str:
        self.last_prompt = prompt
        return self.mock_response
