/**
 * Discovers Evidence.dev data sources and parquet files.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Config } from './config.js';

/**
 * Schema data for a table
 */
export type SchemaData = Array<Record<string, unknown>>;

/**
 * Information about a table
 */
export interface TableInfo {
  /** Path to the parquet file */
  parquetFile: string;
  /** Path to the schema file, if available */
  schemaFile: string | null;
  /** Schema data, if available */
  schemaData: SchemaData;
}

/**
 * Information about a data source
 */
export interface SourceInfo {
  /** Name of the source */
  name: string;
  /** Path to the source directory */
  path: string;
  /** Tables in this source, keyed by table name */
  tables: Record<string, TableInfo>;
}

/**
 * Simplified source information for API responses
 */
export interface SourceSummary {
  /** Name of the source */
  name: string;
  /** Tables in this source */
  tables: string[];
  /** Path to the source directory */
  path: string;
}

/**
 * Discovers Evidence.dev data sources and parquet files.
 */
export class EvidenceDataDiscovery {
  /** Server configuration */
  private config: Config;
  /** Discovered sources */
  private sources: Record<string, SourceInfo> = {};

  /**
   * Initialize EvidenceDataDiscovery.
   * 
   * @param config Server configuration
   */
  constructor(config: Config) {
    this.config = config;
    this._discoverSources();
  }

  /**
   * Discover all Evidence.dev data sources.
   * 
   * This method looks for Evidence.dev data sources in the data directory
   * by first checking for a manifest.json file, and falling back to
   * directory scanning if the manifest is not found.
   */
  private _discoverSources(): void {
    try {
      const dataPath = this.config.getDataPath();
      
      // Try to discover sources from manifest.json
      const manifestPath = path.join(dataPath, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        try {
          const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          
          const sources = this._parseManifest(manifestData, dataPath);
          if (Object.keys(sources).length > 0) {
            this.sources = sources;
            console.info(`Discovered ${Object.keys(sources).length} sources from manifest`);
            return;
          }
        } catch (e) {
          const error = e as Error;
          console.warn(`Error reading manifest.json: ${error.message}`);
        }
      }
      
      // Fall back to directory scanning
      this._discoverSourcesFromDirectories(dataPath);
    } catch (e) {
      const error = e as Error;
      console.error(`Error discovering sources: ${error.message}`);
      console.error(error.stack);
    }
  }

  /**
   * Parse the manifest.json file to discover sources and tables.
   * 
   * @param manifestData The parsed manifest JSON data.
   * @param dataPath The base data path.
   * @returns A dictionary of source information.
   */
  private _parseManifest(manifestData: Record<string, unknown>, dataPath: string): Record<string, SourceInfo> {
    const sources: Record<string, SourceInfo> = {};
    
    // Check if it's a renderedFiles format
    if (manifestData.renderedFiles && typeof manifestData.renderedFiles === 'object') {
      // Process renderedFiles format
      const renderedFiles = manifestData.renderedFiles as Record<string, string[]>;
      
      for (const [sourceName, filePaths] of Object.entries(renderedFiles)) {
        const tables: Record<string, TableInfo> = {};
        
        for (const filePath of filePaths) {
          // Extract table name from file path
          // Expected format: static/data/source_name/table_name/table_name.parquet
          const parts = filePath.split('/');
          if (parts.length >= 4) {
            const tableName = parts[parts.length - 2];
            
            // Get paths for parquet and schema files
            const tableDir = path.join(dataPath, sourceName, tableName);
            const parquetFile = path.join(tableDir, `${tableName}.parquet`);
            const schemaFile = path.join(tableDir, `${tableName}.schema.json`);
            
            // Load schema data if available
            let schemaData: SchemaData = [];
            if (fs.existsSync(schemaFile)) {
              try {
                schemaData = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
              } catch (e) {
                const error = e as Error;
                console.warn(`Error reading schema file ${schemaFile}: ${error.message}`);
              }
            }
            
            // Add table to the source
            tables[tableName] = {
              parquetFile,
              schemaFile: fs.existsSync(schemaFile) ? schemaFile : null,
              schemaData
            };
          }
        }
        
        // Add source to the sources dictionary
        sources[sourceName] = {
          name: sourceName,
          path: path.join(dataPath, sourceName),
          tables
        };
      }
      
      return sources;
    }
    
    // Check for sources format
    if (manifestData.sources && typeof manifestData.sources === 'object') {
      // Process sources format
      const sourcesData = manifestData.sources as Record<string, unknown>;
      
      for (const [sourceName, sourceData] of Object.entries(sourcesData)) {
        const tables: Record<string, TableInfo> = {};
        
        const typedSourceData = sourceData as Record<string, unknown>;
        
        // Get tables for this source
        if (typedSourceData.tables && typeof typedSourceData.tables === 'object') {
          const tablesData = typedSourceData.tables as Record<string, unknown>;
          
          for (const [tableName, tableData] of Object.entries(tablesData)) {
            // Get paths for parquet and schema files
            const parquetFile = path.join(dataPath, sourceName, tableName, `${tableName}.parquet`);
            const schemaFile = path.join(dataPath, sourceName, tableName, `${tableName}.schema.json`);
            
            // Load schema data if available
            let schemaData: SchemaData = [];
            if (fs.existsSync(schemaFile)) {
              try {
                schemaData = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
              } catch (e) {
                const error = e as Error;
                console.warn(`Error reading schema file ${schemaFile}: ${error.message}`);
              }
            }
            
            // Add table to the source
            tables[tableName] = {
              parquetFile,
              schemaFile: fs.existsSync(schemaFile) ? schemaFile : null,
              schemaData
            };
          }
        }
        
        // Add source to the sources dictionary
        sources[sourceName] = {
          name: sourceName,
          path: path.join(dataPath, sourceName),
          tables
        };
      }
    }
    
    return sources;
  }

  /**
   * Discover sources by scanning directories.
   * 
   * @param dataPath The base data path.
   */
  private _discoverSourcesFromDirectories(dataPath: string): void {
    const sources: Record<string, SourceInfo> = {};
    
    try {
      // Check if we're looking at the sources directory directly
      const sqlFiles = this._findFiles(dataPath, (filePath) => filePath.endsWith('.sql'));
      if (sqlFiles.length > 0) {
        // Group SQL files by parent directory (source)
        const sourceDirs: Record<string, string[]> = {};
        for (const sqlFile of sqlFiles) {
          const sourceName = path.basename(path.dirname(sqlFile));
          if (!sourceDirs[sourceName]) {
            sourceDirs[sourceName] = [];
          }
          sourceDirs[sourceName].push(sqlFile);
        }
        
        // Create sources from SQL files
        for (const [sourceName, files] of Object.entries(sourceDirs)) {
          const tables: Record<string, TableInfo> = {};
          
          for (const sqlFile of files) {
            // Use the SQL filename as the table name (without extension)
            const tableName = path.basename(sqlFile, '.sql');
            
            // Create table entry
            tables[tableName] = {
              parquetFile: sqlFile,  // Just use the SQL file as a reference
              schemaFile: null,
              schemaData: []
            };
          }
          
          // Only add sources that have tables
          if (Object.keys(tables).length > 0) {
            sources[sourceName] = {
              name: sourceName,
              path: path.dirname(files[0]),
              tables
            };
          }
        }
        
        this.sources = sources;
        console.info(`Discovered ${Object.keys(sources).length} sources from SQL files`);
        return;
      }
      
      // Standard Evidence.dev directory structure
      for (const sourceDirName of fs.readdirSync(dataPath)) {
        const sourceDir = path.join(dataPath, sourceDirName);
        if (!fs.statSync(sourceDir).isDirectory()) {
          continue;
        }
        
        const sourceName = sourceDirName;
        if (sourceName.startsWith('.')) {  // Skip hidden directories
          continue;
        }
        
        const tables: Record<string, TableInfo> = {};
        
        // Scan for table directories
        for (const tableDirName of fs.readdirSync(sourceDir)) {
          const tableDir = path.join(sourceDir, tableDirName);
          if (!fs.statSync(tableDir).isDirectory()) {
            continue;
          }
          
          const tableName = tableDirName;
          
          // Look for parquet files
          const parquetFiles = this._findFiles(tableDir, (filePath) => filePath.endsWith('.parquet'));
          if (parquetFiles.length === 0) {
            continue;
          }
          
          // Use the first parquet file found
          const parquetFile = parquetFiles[0];
          
          // Look for schema file
          const schemaFiles = this._findFiles(tableDir, (filePath) => filePath.endsWith('.schema.json'));
          const schemaFile = schemaFiles.length > 0 ? schemaFiles[0] : null;
          
          // Load schema data if available
          let schemaData: SchemaData = [];
          if (schemaFile && fs.existsSync(schemaFile)) {
            try {
              schemaData = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
            } catch (e) {
              const error = e as Error;
              console.warn(`Error reading schema file ${schemaFile}: ${error.message}`);
            }
          }
          
          // Add table to the source
          tables[tableName] = {
            parquetFile,
            schemaFile,
            schemaData
          };
        }
        
        // Only add sources that have tables
        if (Object.keys(tables).length > 0) {
          sources[sourceName] = {
            name: sourceName,
            path: sourceDir,
            tables
          };
        }
      }
      
      this.sources = sources;
      console.info(`Discovered ${Object.keys(sources).length} sources from directory scan`);
    } catch (e) {
      const error = e as Error;
      console.error(`Error scanning directories: ${error.message}`);
      console.error(error.stack);
    }
  }

  /**
   * Find files that match a filter in a directory.
   * 
   * @param dir Directory to search
   * @param filter Filter function
   * @returns Array of matching file paths
   */
  private _findFiles(dir: string, filter: (filePath: string) => boolean): string[] {
    const results: string[] = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Include subdirectory files
        results.push(...this._findFiles(itemPath, filter));
      } else if (filter(itemPath)) {
        results.push(itemPath);
      }
    }
    
    return results;
  }

  /**
   * Get a list of all available data sources.
   * 
   * @returns A list of source information dictionaries.
   */
  getSources(): SourceSummary[] {
    return Object.values(this.sources).map(source => ({
      name: source.name,
      tables: Object.keys(source.tables),
      path: source.path
    }));
  }

  /**
   * Get a list of all tables in a data source.
   * 
   * @param source The name of the data source.
   * @returns A list of table names.
   * @throws Error if the source is not found.
   */
  getSourceTables(source: string): string[] {
    if (!(source in this.sources)) {
      throw new Error(`Source not found: ${source}`);
    }
    
    return Object.keys(this.sources[source].tables);
  }

  /**
   * Get the schema information for a table.
   * 
   * @param source The name of the data source.
   * @param table The name of the table.
   * @returns A list of schema field dictionaries.
   * @throws Error if the source or table is not found.
   */
  getTableSchema(source: string, table: string): SchemaData {
    if (!(source in this.sources)) {
      throw new Error(`Source not found: ${source}`);
    }
    
    const sourceTables = this.sources[source].tables;
    if (!(table in sourceTables)) {
      throw new Error(`Table not found: ${table} in source ${source}`);
    }
    
    return sourceTables[table].schemaData;
  }

  /**
   * Get the path to a parquet file.
   * 
   * @param source The name of the data source.
   * @param table The name of the table.
   * @returns The path to the parquet file.
   * @throws Error if the source or table is not found.
   */
  getParquetPath(source: string, table: string): string {
    if (!(source in this.sources)) {
      throw new Error(`Source not found: ${source}`);
    }
    
    const sourceTables = this.sources[source].tables;
    if (!(table in sourceTables)) {
      throw new Error(`Table not found: ${table} in source ${source}`);
    }
    
    return sourceTables[table].parquetFile;
  }
}