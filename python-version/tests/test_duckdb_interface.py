"""
Tests for the DuckDB interface with Evidence.dev parquet files.
This test uses real data from the project.
"""
import os
import sys
import unittest
from pathlib import Path

# Add the parent directory to the system path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

try:
    import duckdb
    DEPENDENCIES_AVAILABLE = True
except ImportError:
    DEPENDENCIES_AVAILABLE = False

from src.mcp_server_duckdb.server import DuckDBDatabase, EvidenceDataDiscovery
from src.mcp_server_duckdb.config import Config


@unittest.skipIf(not DEPENDENCIES_AVAILABLE, "DuckDB not available")
class TestEvidenceDuckDBInterface(unittest.TestCase):
    """Test the DuckDB interface for Evidence.dev parquet files using real project data."""

    def setUp(self):
        """Set up test fixtures with real project data."""
        # Use the real project path
        self.project_path = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))).resolve()
        
        # Create a real Config object
        self.config = Config(project_path=self.project_path)
        
        # Create real instances
        self.discovery = EvidenceDataDiscovery(self.config)
        self.db = DuckDBDatabase(self.discovery)
        
        # Get all sources from the real project
        self.sources = self.discovery.get_sources()
        self.source_names = [source["name"] for source in self.sources]
        
        # Ensure we have sources to test with
        if not self.sources:
            self.skipTest("No sources found in the project")
            
        # Select a source for testing
        self.test_source = self.sources[0]["name"]
        
        # Get tables for the test source
        self.tables = self.discovery.get_source_tables(self.test_source)
        
        # Ensure we have tables to test with
        if not self.tables:
            self.skipTest(f"No tables found in source {self.test_source}")
            
        # Select a table for testing
        self.test_table = self.tables[0]
        
        print(f"\nTesting with real source: {self.test_source}")
        print(f"Testing with real table: {self.test_table}")

    def test_list_tables(self):
        """Test listing all tables across sources from real project data."""
        tables = self.db.list_tables()
        
        # Verify we have tables
        self.assertGreater(len(tables), 0, "Expected at least 1 table in the list")
        
        # Verify the response structure
        self.assertIn('source', tables[0], "Expected 'source' field in table info")
        self.assertIn('table', tables[0], "Expected 'table' field in table info")
        
        # Verify our test table is in the results
        found_test_table = False
        for table in tables:
            if table['source'] == self.test_source and table['table'] == self.test_table:
                found_test_table = True
                break
        self.assertTrue(found_test_table, f"Expected to find {self.test_source}.{self.test_table}")
        
        # Print some tables for verification
        print(f"\nFound {len(tables)} tables across all sources")
        print(f"Sample tables: {tables[:3]} ...")

    def test_describe_table(self):
        """Test getting schema information for a real table."""
        schema = self.db.describe_table(self.test_source, self.test_table)
        
        # Verify schema has content
        self.assertGreater(len(schema), 0, f"Expected at least 1 column in the schema for {self.test_source}.{self.test_table}")
        
        # Verify schema structure
        self.assertIn('name', schema[0], "Expected 'name' field in schema")
        
        # Print schema for verification
        print(f"\nSchema for {self.test_source}.{self.test_table}:")
        print(f"First few columns: {[col.get('name') for col in schema[:5]]} ...")
        
        # Test that we can query this table
        try:
            query = f'SELECT * FROM "{self.test_source}_{self.test_table}" LIMIT 1'
            results = self.db.query_table(query)
            self.assertIsNotNone(results, "Query returned None")
            self.assertGreater(len(results), 0, "Query returned empty result")
            print(f"\nSuccessfully queried {self.test_source}.{self.test_table}")
            if results:
                print(f"First row: {results[0]}")
        except Exception as e:
            self.fail(f"Failed to query table: {e}")


if __name__ == '__main__':
    unittest.main()