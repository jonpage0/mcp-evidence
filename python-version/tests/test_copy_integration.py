"""
Integration test for handling 'copy' in view names with actual parquet files.
This test focuses on Evidence.dev's specific file structure and naming conventions.
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

from src.mcp_server_duckdb.config import Config
from src.mcp_server_duckdb.server import DuckDBDatabase, EvidenceDataDiscovery

@unittest.skipIf(not DEPENDENCIES_AVAILABLE, "Required dependencies not available")
class TestCopyIntegration(unittest.TestCase):
    """Integration test for handling 'copy' in table and view names in Evidence.dev projects."""

    def setUp(self):
        """Set up test fixtures using the actual project data."""
        # Use the real project path
        self.project_path = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))).resolve()
        
        # Create config with the real project path
        self.config = Config(project_path=self.project_path)
        
        # Create real instances
        self.discovery = EvidenceDataDiscovery(self.config)
        self.db = DuckDBDatabase(self.discovery)
        
        # List of sources with "copy" in table names for testing
        self.test_sources = {
            "maniac_neon_prod": [
                "referral_codes copy",
                "referral_codes copy 2",
                "linked_cards copy"
            ],
            "maniac_neon": [
                "tickets copy"
            ]
        }
    
    def test_query_view_with_copy_in_name(self):
        """Test that views with 'copy' in the name can be created and queried using real data."""
        # Get all sources
        sources = self.discovery.get_sources()
        source_names = [source["name"] for source in sources]
        
        # Test each source with copy tables
        for source_name, copy_tables in self.test_sources.items():
            # Skip if source doesn't exist
            if source_name not in source_names:
                print(f"Warning: Source {source_name} not found, skipping")
                continue
                
            # Get available tables for this source
            available_tables = self.discovery.get_source_tables(source_name)
            
            # Test each 'copy' table
            for table_name in copy_tables:
                # Skip if table doesn't exist
                if table_name not in available_tables:
                    print(f"Warning: Table {table_name} not found in {source_name}, skipping")
                    continue
                
                # Test querying the table with 'copy' in the name
                view_name = f"{source_name}_{table_name}"
                query = f'SELECT * FROM "{view_name}" LIMIT 1'
                
                try:
                    # Execute query and verify we get results
                    results = self.db.query_table(query)
                    
                    # Test should pass if we can execute the query without errors
                    self.assertIsNotNone(results, 
                        f"Query returned None for {source_name}.{table_name}")
                    
                    # Display successful query
                    print(f"Successfully queried table with reserved word: {view_name}")
                    
                    # Print first row for verification
                    if results:
                        print(f"  First row sample: {results[0]}")
                        
                except Exception as e:
                    self.fail(f"Failed to query {view_name}: {str(e)}")
        
        # Assert that we found at least one table to test
        self.assertTrue(any(source_name in source_names for source_name in self.test_sources),
                       "No test sources found in the project")


if __name__ == '__main__':
    unittest.main()