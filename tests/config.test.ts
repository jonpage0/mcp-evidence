import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { Config } from '../src/config.js';

describe('Config', () => {
  it('should create a new Config instance', () => {
    // Use the real current working directory
    const projectPath = process.cwd();

    const config = new Config({
      projectPath,
    });

    expect(config).toBeInstanceOf(Config);
    expect(config.projectPath).toBe(projectPath);
    expect(config.readonly).toBe(true);
    expect(config.debug).toBe(false);
  });

  it('should throw if project path does not exist', () => {
    // Use a path that doesn't exist
    const nonExistentPath = path.join(process.cwd(), 'does_not_exist');

    expect(() => new Config({
      projectPath: nonExistentPath,
    })).toThrow('Project directory not found');
  });

  describe('getDataPath', () => {
    it('should return data_path if provided and exists', () => {
      // Use real sources directory
      const projectPath = process.cwd();
      const dataPath = path.join(projectPath, 'sources');

      const config = new Config({
        projectPath,
        dataPath,
      });

      expect(config.getDataPath()).toBe(dataPath);
    });

    it('should throw if data_path is provided but does not exist', () => {
      // Use a valid project path but non-existent data path
      const projectPath = process.cwd();
      const nonExistentDataPath = path.join(projectPath, 'does_not_exist_data');

      const config = new Config({
        projectPath,
        dataPath: nonExistentDataPath,
      });

      expect(() => config.getDataPath()).toThrow('Data directory not found');
    });

    // Test with real data paths from the project
    it('should find a valid data directory', () => {
      // Use the real project path
      const projectPath = process.cwd();

      const config = new Config({
        projectPath,
      });

      // This should find either .evidence/template/static/data or sources directory
      const dataPath = config.getDataPath();

      // Check that we got a valid path (either .evidence or sources)
      const isValidPath = 
        dataPath.includes('.evidence/template/static/data') || 
        dataPath.includes('sources');
        
      expect(isValidPath).toBe(true);
      expect(typeof dataPath).toBe('string');
      expect(dataPath.length).toBeGreaterThan(0);

      console.log('Data path found:', dataPath);
    });
  });
});