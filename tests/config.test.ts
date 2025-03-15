import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Config } from '../src/config.js';

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock path
vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

describe('Config', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should create a new Config instance', () => {
    // Mock fs.existsSync to return true for project path
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const config = new Config({
      projectPath: '/test/project',
    });

    expect(config).toBeInstanceOf(Config);
    expect(config.projectPath).toBe('/test/project');
    expect(config.readonly).toBe(true);
    expect(config.debug).toBe(false);
  });

  it('should throw if project path does not exist', () => {
    // Mock fs.existsSync to return false for project path
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => new Config({
      projectPath: '/nonexistent/project',
    })).toThrow('Project directory not found');
  });

  describe('getDataPath', () => {
    it('should return data_path if provided and exists', () => {
      // Mock fs.existsSync to return true
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const config = new Config({
        projectPath: '/test/project',
        dataPath: '/test/data',
      });

      expect(config.getDataPath()).toBe('/test/data');
    });

    it('should throw if data_path is provided but does not exist', () => {
      // Mock fs.existsSync to return true for project path, false for data path
      vi.mocked(fs.existsSync)
        .mockImplementation((path) => path === '/test/project');

      const config = new Config({
        projectPath: '/test/project',
        dataPath: '/nonexistent/data',
      });

      expect(() => config.getDataPath()).toThrow('Data directory not found');
    });

    it('should return evidence data dir if it exists', () => {
      // Mock fs.existsSync to return true for project and evidence data dir
      vi.mocked(fs.existsSync)
        .mockImplementation((path) => 
          path === '/test/project' || 
          path === '/test/project/.evidence/template/static/data');

      const config = new Config({
        projectPath: '/test/project',
      });

      expect(config.getDataPath()).toBe('/test/project/.evidence/template/static/data');
    });

    it('should return sources dir if evidence data dir does not exist but sources does', () => {
      // Mock fs.existsSync - true for project and sources, false for evidence data dir
      vi.mocked(fs.existsSync)
        .mockImplementation((path) => 
          path === '/test/project' || 
          path === '/test/project/sources');

      const config = new Config({
        projectPath: '/test/project',
      });

      expect(config.getDataPath()).toBe('/test/project/sources');
    });

    it('should throw if no data directory is found', () => {
      // Mock fs.existsSync - true for project only
      vi.mocked(fs.existsSync)
        .mockImplementation((path) => path === '/test/project');

      const config = new Config({
        projectPath: '/test/project',
      });

      expect(() => config.getDataPath()).toThrow('Evidence.dev data directory not found');
    });
  });
});