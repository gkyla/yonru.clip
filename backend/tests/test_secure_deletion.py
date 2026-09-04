import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Dynamic path resolution to root of backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.asset_repository import AssetRepository

class TestSecureDeletion(unittest.TestCase):
    def test_invalid_folder_names(self):
        repo = AssetRepository(output_dir="temp_assets")
        
        # Test directory traversal characters
        with self.assertRaises(ValueError):
            repo.delete_cached_video("../../some_folder")
            
        with self.assertRaises(ValueError):
            repo.delete_cached_video("some_folder/../other")

        # Test invalid characters
        with self.assertRaises(ValueError):
            repo.delete_cached_video("invalid@folder")
            
        with self.assertRaises(ValueError):
            repo.delete_cached_video("")

    @patch('shutil.rmtree')
    @patch('os.path.exists')
    @patch('os.path.isdir')
    def test_valid_deletion(self, mock_isdir, mock_exists, mock_rmtree):
        mock_exists.return_value = True
        mock_isdir.return_value = True
        
        repo = AssetRepository(output_dir="temp_assets")
        
        # Clean alphanumeric and underscore name should succeed
        count = repo.delete_cached_video("Valid_Title_abc123-456")
        self.assertEqual(count, 2)
        
        # Folder names containing spaces and non-breaking spaces should also succeed
        count_with_spaces = repo.delete_cached_video("Valid Title\u00a0abc123-456")
        self.assertEqual(count_with_spaces, 2)

        # Folder names containing brackets [Channel] should also succeed
        count_with_brackets = repo.delete_cached_video("[Raditya Dika] Valid_Title_abc123-456")
        self.assertEqual(count_with_brackets, 2)
        
        self.assertEqual(mock_rmtree.call_count, 6)
        
        print("\n[OK] delete_cached_video securely validated name (including spaces) and cleared folders successfully!")

if __name__ == '__main__':
    unittest.main()

