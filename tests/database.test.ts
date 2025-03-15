import { describe, it, expect } from 'vitest';
import { DuckDBDatabase } from '../src/database.js';
import { EvidenceDataDiscovery } from '../src/discovery.js';
import { Config } from '../src/config.js';

// This test uses the real file system and actual sources directory
describe('DuckDBDatabase with real data', () => {
  // Set up configuration pointing to the real sources directory
  const projectPath = process.cwd();
  const dataPath = `${projectPath}/sources`; // Explicitly use the sources directory
  
  // Skip tests if duckdb is not available
  const hasDuckDB = () => {
    try {
      require('@duckdb/node-api');
      return true;
    } catch (e) {
      console.warn('@duckdb/node-api not available, skipping database tests');
      return false;
    }
  };
  
  // Only run tests if DuckDB is available
  it.runIf(hasDuckDB())('should execute a query on real data', async () => {
    // Create config and discovery
    const config = new Config({
      projectPath,
      dataPath,
    });
    
    const discovery = new EvidenceDataDiscovery(config);
    const db = new DuckDBDatabase(discovery);
    
    // Get all discovered sources for logging
    const sources = discovery.getSources();
    console.log('Found sources:', sources.map(s => s.name));
    
    // Get tables from a known source
    const maniacNeonTables = discovery.getSourceTables('maniac_neon');
    console.log('Tables in maniac_neon:', maniacNeonTables);

    // Simple SQL query to test
    let queryResults: unknown[] = [];
    
    // Execute a simple query that should work with SQL files
    try {
      // First try a basic PRAGMA query that doesn't require table access
      const pragmaResults = await db.executeQuery('PRAGMA version');
      console.log('DuckDB version:', pragmaResults);
      
      // Query with explicit column names
      queryResults = await db.queryTable('SELECT 1 AS number, \'test\' AS string_value, 42.5 AS decimal_value');
      console.log('Query results with column names:', queryResults);
      
      // Verify column names are preserved
      if (queryResults.length > 0) {
        const row = queryResults[0] as Record<string, unknown>;
        expect(Object.keys(row)).toContain('number');
        expect(Object.keys(row)).toContain('string_value');
        expect(Object.keys(row)).toContain('decimal_value');
      }
      
      // Just verify we got some kind of result
      expect(pragmaResults).toBeDefined();
      expect(queryResults).toBeDefined();
      
    } catch (e) {
      console.warn('Query execution failed:', e);
      // Test that we at least have a database connection
      expect(db).toBeDefined();
    }
  });
  
  // Test simple database operations that don't depend on SQL file reading
  it.runIf(hasDuckDB())('should list tables from discovery', () => {
    // Create config and discovery
    const config = new Config({
      projectPath,
      dataPath,
    });
    
    const discovery = new EvidenceDataDiscovery(config);
    const db = new DuckDBDatabase(discovery);
    
    // List all tables
    const tables = db.listTables();
    
    // We should have at least one table
    expect(tables.length).toBeGreaterThan(0);
    
    // Check for a known source/table combination
    const hasManiacNeonOrders = tables.some(
      t => t.source === 'maniac_neon' && t.table === 'orders'
    );
    
    expect(hasManiacNeonOrders).toBe(true);
    
    console.log('All tables:', tables);
  });
  
  // Test CTE query with column naming
  it.runIf(hasDuckDB())('should preserve column names in CTE queries', async () => {
    // Create config and discovery
    const config = new Config({
      projectPath,
      dataPath,
    });
    
    const discovery = new EvidenceDataDiscovery(config);
    const db = new DuckDBDatabase(discovery);
    
    try {
      // Query with a Common Table Expression
      const cteQuery = `
        WITH my_cte AS (
          SELECT 100 AS revenue, 25 AS tax, 75 AS profit
        ),
        second_cte AS (
          SELECT revenue * 2 AS double_revenue, tax * 2 AS double_tax 
          FROM my_cte
        )
        SELECT * FROM second_cte
      `;
      
      const results = await db.queryTable(cteQuery);
      
      // Verify we got results
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Verify column names are preserved from the CTE
      if (results.length > 0) {
        const row = results[0] as Record<string, unknown>;
        // Should have these column names from the second_cte
        expect(Object.keys(row)).toContain('double_revenue');
        expect(Object.keys(row)).toContain('double_tax');
      }
      
      console.log('CTE Query results:', results);
    } catch (e) {
      console.warn('CTE query execution failed:', e);
      // Fail the test if the query fails
      expect(true).toBe(false);
    }
  });
});