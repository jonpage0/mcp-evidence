"""
Tests for the Evidence.dev MCP integration.
"""
import json
import os
import sys
import unittest
from pathlib import Path

# Add the parent directory to the system path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import directly from the modules we're testing
from src.mcp_server_duckdb.config import Config
from src.mcp_server_duckdb.server import EvidenceDataDiscovery, DuckDBDatabase


class TestEvidenceIntegration(unittest.TestCase):
    """Integration tests for the Evidence.dev data with sample files."""

    def setUp(self):
        """Set up test fixtures with actual sample data."""
        # Use the actual project path for testing
        self.project_path = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))).resolve()
        
        # Create a real Config object
        self.config = Config(project_path=self.project_path)
        
        # Create real instances with sample data
        self.discovery = EvidenceDataDiscovery(self.config)
        self.db = DuckDBDatabase(self.discovery)
    
    def test_source_discovery_with_sample_data(self):
        """Test source discovery with actual sample data."""
        sources = self.discovery.get_sources()
        
        # We should have sources in our sample data
        self.assertGreater(len(sources), 0, "No sources found in sample data")
        
        # Print the discovered sources for debugging
        source_names = [source["name"] for source in sources]
        print(f"Discovered sources: {source_names}")
        
        # Check if we have any of the expected sources
        expected_sources = ["maniac_neon", "maniac_neon_2024", "maniac_neon_prod"]
        found_expected = any(source in source_names for source in expected_sources)
        self.assertTrue(found_expected, f"None of the expected sources {expected_sources} found")

    def test_table_discovery_with_sample_data(self):
        """Test table discovery with actual sample data."""
        # Get the first available source
        sources = self.discovery.get_sources()
        self.assertGreater(len(sources), 0, "No sources found in sample data")
        
        # Use the first source for testing
        first_source = sources[0]["name"]
        tables = self.discovery.get_source_tables(first_source)
        
        # We should have tables in this source
        self.assertGreater(len(tables), 0, f"No tables found in source {first_source}")
        print(f"Tables in {first_source}: {tables}")

    def test_schema_discovery_with_sample_data(self):
        """Test schema discovery with actual sample data."""
        # Get the first available source and table
        sources = self.discovery.get_sources()
        self.assertGreater(len(sources), 0, "No sources found in sample data")
        
        first_source = sources[0]["name"]
        tables = self.discovery.get_source_tables(first_source)
        self.assertGreater(len(tables), 0, f"No tables found in source {first_source}")
        
        # Use the first table for testing
        first_table = tables[0]
        schema = self.discovery.get_table_schema(first_source, first_table)
        
        # We should have fields in the schema
        self.assertGreater(len(schema), 0, f"No schema found for {first_source}.{first_table}")
        print(f"Schema for {first_source}.{first_table}: {schema[:3]}...")  # Print first few fields
        
        # Each field should have a name
        for field in schema:
            self.assertIn("name", field, "Field missing 'name' attribute")

    def test_evidence_directory_structure(self):
        """Test that the Evidence.dev directory structure exists as expected."""
        # The .evidence directory should exist
        evidence_dir = self.project_path / ".evidence"
        self.assertTrue(evidence_dir.exists(), ".evidence directory not found")
        
        # The static/data directory should exist
        data_dir = evidence_dir / "template" / "static" / "data"
        self.assertTrue(data_dir.exists(), "data directory not found")
        
        # There should be subdirectories for data sources
        subdirs = [d for d in data_dir.iterdir() if d.is_dir()]
        self.assertGreater(len(subdirs), 0, "No data source directories found")
        print(f"Found data source directories: {[d.name for d in subdirs]}")
    
    def test_query_execution_with_sample_data(self):
        """Test SQL query execution with sample data."""
        try:
            # Get the available sources
            sources = self.discovery.get_sources()
            self.assertGreater(len(sources), 0, "No sources found in sample data")
            
            # Use the first source that has tables
            source_name = None
            table_name = None
            
            for src in sources:
                src_name = src["name"]
                tables = self.discovery.get_source_tables(src_name)
                if tables:
                    source_name = src_name
                    table_name = tables[0]
                    break
            
            # Skip test if we couldn't find a suitable source/table
            if not source_name or not table_name:
                self.skipTest("No suitable source/table found for query testing")
            
            # Construct a safe query for this table
            # Limit to 2 rows to avoid excessive output
            query = f"SELECT * FROM \"{source_name}_{table_name}\" LIMIT 2"
            
            # Execute the query
            results = self.db.query_table(query)
            
            # We should get results back
            self.assertIsNotNone(results, "Query returned None")
            self.assertGreater(len(results), 0, "Query returned empty result set")
            
            # Print the results for debugging
            print(f"Query result for {source_name}.{table_name} (first 2 rows):")
            for row in results[:2]:
                print(row)
                
        except Exception as e:
            self.fail(f"Query execution failed: {e}")


if __name__ == '__main__':
    unittest.main()