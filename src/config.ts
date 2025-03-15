/**
 * Configuration for the Evidence.dev MCP server.
 */
import fs from 'fs';
import path from 'path';

/**
 * Configuration options for the Evidence.dev MCP server.
 */
export interface ConfigOptions {
  /** Path to the Evidence.dev project root directory. */
  projectPath: string;
  /** Optional override for the data directory path. */
  dataPath?: string;
  /** Enable debug logging. */
  debug?: boolean;
  /** Run server in read-only mode. Always true for Evidence.dev MCP server. */
  readonly?: boolean;
}

/**
 * Configuration for the Evidence.dev MCP server.
 */
export class Config {
  /** Path to the Evidence.dev project root directory. */
  readonly projectPath: string;
  
  /** Optional override for the data path. */
  readonly dataPath?: string;
  
  /** Run server in read-only mode. Always true for Evidence.dev MCP server. */
  readonly readonly: boolean = true;
  
  /** Enable debug logging. */
  readonly debug: boolean = false;

  /**
   * Create a new configuration.
   * 
   * @param options Configuration options
   */
  constructor(options: ConfigOptions) {
    this.projectPath = options.projectPath;
    this.dataPath = options.dataPath;
    this.readonly = options.readonly !== undefined ? options.readonly : true;
    this.debug = options.debug || false;

    // Validate project path
    if (!fs.existsSync(this.projectPath)) {
      throw new Error(`Project directory not found: ${this.projectPath}`);
    }
  }

  /**
   * Get the path to the data directory.
   * 
   * @returns Path to the data directory.
   * @throws Error if the data directory doesn't exist.
   */
  getDataPath(): string {
    // If a data_path is explicitly set, use that
    if (this.dataPath) {
      if (fs.existsSync(this.dataPath)) {
        return this.dataPath;
      }
      throw new Error(`Data directory not found: ${this.dataPath}. Please provide a valid data directory.`);
    }
    
    // Try the standard Evidence.dev path
    const evidenceDataDir = path.join(this.projectPath, ".evidence", "template", "static", "data");
    if (fs.existsSync(evidenceDataDir)) {
      return evidenceDataDir;
    }
    
    // If we're in the mcp-evidence project, look for the sources directory
    const sourcesDir = path.join(this.projectPath, "sources");
    if (fs.existsSync(sourcesDir)) {
      return sourcesDir;
    }
    
    // No data directory found
    throw new Error(`Evidence.dev data directory not found: ${evidenceDataDir}. Please run 'pnpm run sources' in your Evidence.dev project first, or explicitly provide a data directory with --data-path.`);
  }
}