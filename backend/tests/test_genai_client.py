import unittest
from unittest.mock import MagicMock, patch
import os
import sys

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.genai_client import MockGenAIClient, GeminiGenAIClient

class TestGenAIClient(unittest.TestCase):
    def test_mock_genai_client_response(self):
        client = MockGenAIClient("mock-json-response")
        response = client.generate_json("Test Prompt", "test-model")
        
        self.assertEqual(response, "mock-json-response")
        self.assertEqual(client.last_prompt, "Test Prompt")

    @patch('core.genai_client.genai.Client')
    def test_gemini_client_delegation(self, mock_sdk_client):
        mock_instance = MagicMock()
        mock_sdk_client.return_value = mock_instance
        
        mock_response = MagicMock()
        mock_response.text = '{"status": "ok"}'
        mock_instance.models.generate_content.return_value = mock_response
        
        client = GeminiGenAIClient(api_key="fake-key")
        res = client.generate_json("Prompt Content", "gemini-model")
        
        self.assertEqual(res, '{"status": "ok"}')
        self.assertTrue(mock_instance.models.generate_content.called)

if __name__ == '__main__':
    unittest.main()
