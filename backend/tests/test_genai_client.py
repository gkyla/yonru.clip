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

    @patch('core.genai_client.genai.Client')
    def test_gemini_client_fallback_success(self, mock_sdk_client):
        # Reset degradation cache before test
        GeminiGenAIClient._degradation_cache.clear()
        
        mock_client_1 = MagicMock()
        mock_client_1.models.generate_content.side_effect = Exception("429 Quota Exceeded")
        
        mock_client_2 = MagicMock()
        mock_response = MagicMock()
        mock_response.text = '{"status": "fallback_ok"}'
        mock_client_2.models.generate_content.return_value = mock_response
        
        # Side effect for client instantiation based on API key passed
        def client_side_effect(api_key=None):
            if api_key == "key1":
                return mock_client_1
            elif api_key == "key2":
                return mock_client_2
            raise Exception("Unexpected key")
            
        mock_sdk_client.side_effect = client_side_effect
        
        client = GeminiGenAIClient(api_key="key1, key2")
        res = client.generate_json("Prompt Content", "gemini-model")
        
        # Verify it fallback successfully to key2
        self.assertEqual(res, '{"status": "fallback_ok"}')
        self.assertIn("key1", GeminiGenAIClient._degradation_cache)
        self.assertFalse(GeminiGenAIClient._degradation_cache["key1"]["permanent"])
        
        # Verify key1 is skipped on next run without instantiating mock_client_1
        mock_client_1.models.generate_content.reset_mock()
        res_second = client.generate_json("Second Prompt", "gemini-model")
        self.assertEqual(res_second, '{"status": "fallback_ok"}')
        mock_client_1.models.generate_content.assert_not_called()

    @patch('core.genai_client.genai.Client')
    def test_gemini_client_permanent_degradation(self, mock_sdk_client):
        # Reset degradation cache before test
        GeminiGenAIClient._degradation_cache.clear()
        
        mock_client_1 = MagicMock()
        mock_client_1.models.generate_content.side_effect = Exception("400 API_KEY_INVALID")
        
        mock_client_2 = MagicMock()
        mock_response = MagicMock()
        mock_response.text = '{"status": "fallback_ok"}'
        mock_client_2.models.generate_content.return_value = mock_response
        
        def client_side_effect(api_key=None):
            if api_key == "key1":
                return mock_client_1
            elif api_key == "key2":
                return mock_client_2
            raise Exception("Unexpected key")
            
        mock_sdk_client.side_effect = client_side_effect
        
        client = GeminiGenAIClient(api_key="key1, key2")
        res = client.generate_json("Prompt Content", "gemini-model")
        
        self.assertEqual(res, '{"status": "fallback_ok"}')
        self.assertTrue(GeminiGenAIClient._degradation_cache["key1"]["permanent"])
        
        # Clear degradation manually
        GeminiGenAIClient.clear_degradation("key1")
        self.assertNotIn("key1", GeminiGenAIClient._degradation_cache)

if __name__ == '__main__':
    unittest.main()
