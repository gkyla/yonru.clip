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
        self.assertEqual(client.last_model_name, "test-model")

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

    def test_gemini_client_json_parsing(self):
        # Verify JSON array format parses keys and titles correctly
        json_config = '[{"title": "Work Key", "value": "key1"}, {"title": "Backup Key", "value": "key2"}]'
        client = GeminiGenAIClient(api_key=json_config)
        
        self.assertEqual(client.api_keys, ["key1", "key2"])
        self.assertEqual(client.key_titles["key1"], "Work Key")
        self.assertEqual(client.key_titles["key2"], "Backup Key")

    def test_gemini_client_json_parsing_fallback(self):
        # Verify that legacy plain text list still parses successfully
        client = GeminiGenAIClient(api_key="key1, key2")
        
        self.assertEqual(client.api_keys, ["key1", "key2"])
        self.assertEqual(client.key_titles["key1"], "Key #1")
        self.assertEqual(client.key_titles["key2"], "Key #2")

    @patch('core.genai_client.genai.Client')
    def test_gemini_client_503_does_not_degrade_or_rotate_keys(self, mock_sdk_client):
        GeminiGenAIClient._degradation_cache.clear()

        mock_client_1 = MagicMock()
        mock_client_1.models.generate_content.side_effect = Exception(
            "503 UNAVAILABLE. This model is currently experiencing high demand."
        )
        mock_client_2 = MagicMock()

        def client_side_effect(api_key=None):
            return mock_client_1 if api_key == "key1" else mock_client_2

        mock_sdk_client.side_effect = client_side_effect

        client = GeminiGenAIClient(api_key="key1, key2")
        with self.assertRaises(Exception):
            client.generate_json("Prompt Content", "gemini-3.5-flash-lite")

        mock_client_2.models.generate_content.assert_not_called()

        # Verify key1 was NOT degraded by confirming the very next call still uses key1 and succeeds.
        mock_response = MagicMock()
        mock_response.text = '{"status": "recovered"}'
        mock_client_1.models.generate_content.side_effect = None
        mock_client_1.models.generate_content.return_value = mock_response

        res = client.generate_json("Second Prompt", "gemini-3.5-flash-lite")
        self.assertEqual(res, '{"status": "recovered"}')
        self.assertEqual(mock_client_1.models.generate_content.call_count, 2)
        mock_client_2.models.generate_content.assert_not_called()

    @patch('core.genai_client.genai.Client')
    def test_gemini_client_network_error_does_not_degrade_or_rotate_keys(self, mock_sdk_client):
        GeminiGenAIClient._degradation_cache.clear()

        mock_client_1 = MagicMock()
        mock_client_1.models.generate_content.side_effect = ConnectionError(
            "Connection timed out after 5000ms"
        )
        mock_client_2 = MagicMock()

        def client_side_effect(api_key=None):
            return mock_client_1 if api_key == "key1" else mock_client_2

        mock_sdk_client.side_effect = client_side_effect

        client = GeminiGenAIClient(api_key="key1, key2")
        with self.assertRaises(ConnectionError):
            client.generate_json("Prompt Content", "gemini-3.5-flash-lite")

        mock_client_2.models.generate_content.assert_not_called()

        mock_response = MagicMock()
        mock_response.text = '{"status": "online"}'
        mock_client_1.models.generate_content.side_effect = None
        mock_client_1.models.generate_content.return_value = mock_response

        res = client.generate_json("Second Prompt", "gemini-3.5-flash-lite")
        self.assertEqual(res, '{"status": "online"}')
        self.assertEqual(mock_client_1.models.generate_content.call_count, 2)
        mock_client_2.models.generate_content.assert_not_called()

if __name__ == '__main__':
    unittest.main()
