import { describe, it, expect } from 'vitest';
import { EvidenceDataDiscovery } from '../src/discovery.js';
import { Config } from '../src/config.js';
import * as path from 'node:path';

// This test uses the real file system and actual sources directory
describe('EvidenceDataDiscovery with real data', () => {
  const projectPath = process.cwd(); // Current working directory
  const dataPath = path.join(projectPath, 'sources');
  
  it('should discover sources from the real sources directory', () => {
    // Create config pointing to the real sources directory
    const config = new Config({
      projectPath,
      dataPath,
    });
    
    // Create discovery with the config
    const discovery = new EvidenceDataDiscovery(config);
    
    // Get all sources
    const sources = discovery.getSources();
    
    // We should have at least one source
    expect(sources.length).toBeGreaterThan(0);
    
    // Check that we have the expected sources
    const sourceNames = sources.map(source => source.name);
    
    // Look for known sources in the folder
    expect(sourceNames).toContain('maniac_neon');
    expect(sourceNames).toContain('maniac_neon_2024');
    expect(sourceNames).toContain('maniac_neon_prod');
    
    // Check tables for a specific source
    const maniacNeonTables = discovery.getSourceTables('maniac_neon');
    expect(maniacNeonTables.length).toBeGreaterThan(0);
    
    // Check that we have some expected tables
    expect(maniacNeonTables).toContain('orders');
    
    console.log('Found sources:', sourceNames);
    console.log('Tables in maniac_neon:', maniacNeonTables);
  });
  
  it('should be able to get parquet paths', () => {
    // Create config pointing to the real sources directory
    const config = new Config({
      projectPath,
      dataPath,
    });
    
    // Create discovery with the config
    const discovery = new EvidenceDataDiscovery(config);
    
    // Get path to a parquet file (should be SQL file in our case)
    const parquetPath = discovery.getParquetPath('maniac_neon', 'orders');
    
    // Verify the path exists and points to a SQL file
    expect(parquetPath).toContain('maniac_neon');
    expect(parquetPath).toContain('orders.sql');
    
    console.log('Parquet path for maniac_neon/orders:', parquetPath);
  });
});