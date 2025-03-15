"""
Tests for Evidence.dev data discovery functionality.
"""
import json
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

# Add the src directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock duckdb module to avoid dependency issues during testing
mock_duckdb = mock.MagicMock()
mock_connection = mock.MagicMock()
mock_cursor = mock.MagicMock()
mock_connection.execute.return_value = mock_cursor
mock_cursor.fetchall.return_value = [("col1", "col2"), (1, 2), (3, 4)]
mock_duckdb.connect.return_value = mock_connection
sys.modules['duckdb'] = mock_duckdb

from src.mcp_server_duckdb.config import Config
from src.mcp_server_duckdb.server import EvidenceDataDiscovery


class TestEvidenceDataDiscovery(unittest.TestCase):
    """Test the Evidence.dev data discovery functionality."""

    def setUp(self):
        """Set up test fixtures."""
        # Create a mock config with the project path pointing to our test directory
        self.project_path = Path(os.path.abspath(os.path.dirname(__file__)), '..').resolve()
        self.config = mock.MagicMock(spec=Config)
        self.config.project_path = self.project_path
        self.config.data_path = self.project_path / ".evidence" / "template" / "static" / "data"

    def test_source_discovery_from_manifest(self):
        """Test discovery of sources using the manifest.json file."""
        discovery = EvidenceDataDiscovery(self.config)
        
        # Verify that sources were discovered
        sources = discovery.get_sources()
        self.assertGreater(len(sources), 0, "No sources discovered from manifest")
        
        # Check that expected source names are present
        source_names = [source["name"] for source in sources]
        for expected_source in ["maniac_neon", "maniac_neon_2024", "maniac_neon_prod", "studentescape_neon"]:
            self.assertIn(expected_source, source_names, f"Expected source {expected_source} not found")

    def test_table_discovery(self):
        """Test discovery of tables within sources."""
        discovery = EvidenceDataDiscovery(self.config)
        
        # Test with a specific source that should have tables
        source_name = "maniac_neon"
        tables = discovery.get_source_tables(source_name)
        self.assertGreater(len(tables), 0, f"No tables discovered for source {source_name}")
        
        # Check for known tables
        for expected_table in ["orders", "tickets"]:
            self.assertIn(expected_table, tables, f"Expected table {expected_table} not found in {source_name}")

    def test_schema_discovery(self):
        """Test discovery of schema information for tables."""
        discovery = EvidenceDataDiscovery(self.config)
        
        # Test with a specific source and table that should have a schema
        source_name = "maniac_neon"
        table_name = "orders"
        
        schema = discovery.get_table_schema(source_name, table_name)
        self.assertGreater(len(schema), 0, f"No schema discovered for {source_name}.{table_name}")
        
        # Check for expected schema fields
        field_names = [field["name"] for field in schema]
        for expected_field in ["id", "created", "status", "currency"]:
            self.assertIn(expected_field, field_names, f"Expected field {expected_field} not found in schema")
            
    def test_source_not_found(self):
        """Test behavior when a source is not found."""
        discovery = EvidenceDataDiscovery(self.config)
        
        with self.assertRaises(ValueError):
            discovery.get_source_tables("nonexistent_source")
            
    def test_table_not_found(self):
        """Test behavior when a table is not found."""
        discovery = EvidenceDataDiscovery(self.config)
        
        with self.assertRaises(ValueError):
            discovery.get_table_schema("maniac_neon", "nonexistent_table")


if __name__ == '__main__':
    unittest.main()