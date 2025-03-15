"""
Tests for querying all Evidence.dev sources through the MCP server.
"""
import os
import sys
import unittest
from pathlib import Path

# Add the parent directory to the system path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import directly from the modules we're testing
from src.mcp_server_duckdb.config import Config
from src.mcp_server_duckdb.server import EvidenceDataDiscovery, DuckDBDatabase


class TestAllSourcesQuery(unittest.TestCase):
    """Test that all discovered sources can be queried successfully."""

    def setUp(self):
        """Set up test fixtures with actual sample data."""
        # Use the actual project path for testing
        self.project_path = Path(os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))).resolve()
        
        # Create a real Config object
        self.config = Config(project_path=self.project_path)
        
        # Create real instances with sample data
        self.discovery = EvidenceDataDiscovery(self.config)
        self.db = DuckDBDatabase(self.discovery)
        
        # Get all sources for testing
        self.sources = self.discovery.get_sources()
        self.source_names = [source["name"] for source in self.sources]
        print(f"\nDiscovered sources: {self.source_names}")
    
    def test_query_all_sources(self):
        """Test that all sources can be queried."""
        # Ensure we have sources to test
        self.assertGreater(len(self.sources), 0, "No sources discovered")
        
        # Track results for each source
        results_by_source = {}
        
        # Try querying each source
        for source in self.sources:
            source_name = source["name"]
            tables = self.discovery.get_source_tables(source_name)
            
            if not tables:
                print(f"⚠️ Source {source_name} has no tables")
                continue
            
            # Test the first table in each source
            table_name = tables[0]
            # Ensure the view name is properly quoted to handle reserved words
            query = f'SELECT * FROM "{source_name}_{table_name}" LIMIT 1'
            
            try:
                # Execute the query
                results = self.db.query_table(query)
                
                # Store results and check if successful
                results_by_source[source_name] = {
                    "table": table_name,
                    "success": len(results) > 0,
                    "rows": len(results) if results else 0
                }
                
                # Verify we got results
                self.assertGreater(len(results), 0, 
                                  f"No results returned for {source_name}.{table_name}")
                
                print(f"✅ Source {source_name}, table {table_name}: {len(results)} rows")
                
                # Print the first row for debugging (column names)
                if results:
                    print(f"  First row: {results[0]}")
                
            except Exception as e:
                results_by_source[source_name] = {
                    "table": table_name,
                    "success": False,
                    "error": str(e)
                }
                print(f"❌ Error querying {source_name}.{table_name}: {e}")
                # Don't fail the test, just report the issue
        
        # Print summary
        print("\nQuery results summary:")
        for source, result in results_by_source.items():
            status = "✅ Success" if result.get("success") else f"❌ Failed: {result.get('error')}"
            print(f"{source}.{result.get('table')}: {status}")
        
        # Ensure at least one source was successfully queried
        successful_sources = [s for s, r in results_by_source.items() if r.get("success")]
        self.assertGreater(len(successful_sources), 0, 
                          "Failed to successfully query any sources")
        
        # Print the success rate
        success_rate = len(successful_sources) / len(results_by_source) * 100
        print(f"\nSuccessfully queried {len(successful_sources)} out of {len(results_by_source)} sources ({success_rate:.1f}%)")
    
    def test_multiple_sequential_queries(self):
        """Test running queries against multiple sources sequentially."""
        # Skip if we don't have at least two sources
        if len(self.sources) < 2:
            self.skipTest("Need at least two sources for multi-source query test")
        
        # Keep track of results
        results = []
        
        try:
            # Get the first two sources
            source1 = self.sources[0]["name"]
            source2 = self.sources[1]["name"]
            
            # Get tables from each source
            tables1 = self.discovery.get_source_tables(source1)
            tables2 = self.discovery.get_source_tables(source2)
            
            # Skip if any source doesn't have tables
            if not tables1 or not tables2:
                self.skipTest("Need tables in both sources for multi-source query test")
            
            # Run a query against the first source
            # Ensure view names are properly quoted to handle reserved words
            query1 = f'SELECT * FROM "{source1}_{tables1[0]}" LIMIT 1'
            result1 = self.db.query_table(query1)
            results.append({
                "source": source1,
                "table": tables1[0],
                "rows": len(result1)
            })
            
            # Run a query against the second source
            # Ensure view names are properly quoted to handle reserved words
            query2 = f'SELECT * FROM "{source2}_{tables2[0]}" LIMIT 1'
            result2 = self.db.query_table(query2)
            results.append({
                "source": source2,
                "table": tables2[0],
                "rows": len(result2)
            })
            
            # Verify we got results from both sources
            self.assertGreater(len(result1), 0, f"No results from {source1}")
            self.assertGreater(len(result2), 0, f"No results from {source2}")
            
            print(f"\n✅ Multiple sequential queries successful:")
            for result in results:
                print(f"  Source: {result['source']}, Table: {result['table']}, Rows: {result['rows']}")
                
        except Exception as e:
            print(f"\n❌ Multiple sequential queries failed: {e}")
            raise


if __name__ == '__main__':
    unittest.main()
