"""
Tests for the Evidence.dev MCP server configuration.
"""
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

# Add the parent directory to the system path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.mcp_server_duckdb.config import Config


def test_config_required_project_path():
    """Test that project_path is required when using from_arguments."""
    with patch.object(sys, "argv", ["prog"]):
        with pytest.raises(SystemExit):
            Config.from_arguments()


def test_config_from_arguments(tmp_path):
    """Test Config initialization from command line arguments."""
    # Simulate command line arguments with a project path
    test_args = [
        "--project-path",
        str(tmp_path),
    ]
    with patch.object(sys, "argv", ["prog"] + test_args):
        config = Config.from_arguments()
        assert config.project_path == tmp_path
        # readonly should be True by default for Evidence.dev MCP server
        assert config.readonly is True


def test_config_data_path_property(tmp_path):
    """Test that the data_path property correctly points to the Evidence.dev data directory."""
    # Create a basic Evidence.dev project structure
    evidence_data_dir = tmp_path / ".evidence" / "template" / "static" / "data"
    evidence_data_dir.mkdir(parents=True, exist_ok=True)
    
    # Create a config object with the project path
    config = Config(project_path=tmp_path)
    
    # The data_path property should point to the evidence data directory
    assert config.data_path == evidence_data_dir


def test_config_data_path_missing_directory(tmp_path):
    """Test that ValueError is raised when data directory doesn't exist."""
    # Create a config object with a project path that doesn't have an .evidence directory
    config = Config(project_path=tmp_path)
    
    # The data_path property should raise a ValueError
    with pytest.raises(ValueError, match="Evidence.dev data directory not found"):
        _ = config.data_path


def test_config_readonly_default():
    """Test that readonly is True by default."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        config = Config(project_path=tmp_path)
        assert config.readonly is True, "readonly should be True by default for Evidence.dev MCP server"
