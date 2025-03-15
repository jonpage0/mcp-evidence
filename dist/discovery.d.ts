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
export declare class EvidenceDataDiscovery {
    /** Server configuration */
    private config;
    /** Discovered sources */
    private sources;
    /**
     * Initialize EvidenceDataDiscovery.
     *
     * @param config Server configuration
     */
    constructor(config: Config);
    /**
     * Discover all Evidence.dev data sources.
     *
     * This method looks for Evidence.dev data sources in the data directory
     * by first checking for a manifest.json file, and falling back to
     * directory scanning if the manifest is not found.
     */
    private _discoverSources;
    /**
     * Parse the manifest.json file to discover sources and tables.
     *
     * @param manifestData The parsed manifest JSON data.
     * @param dataPath The base data path.
     * @returns A dictionary of source information.
     */
    private _parseManifest;
    /**
     * Discover sources by scanning directories.
     *
     * @param dataPath The base data path.
     */
    private _discoverSourcesFromDirectories;
    /**
     * Find files that match a filter in a directory.
     *
     * @param dir Directory to search
     * @param filter Filter function
     * @returns Array of matching file paths
     */
    private _findFiles;
    /**
     * Get a list of all available data sources.
     *
     * @returns A list of source information dictionaries.
     */
    getSources(): SourceSummary[];
    /**
     * Get a list of all tables in a data source.
     *
     * @param source The name of the data source.
     * @returns A list of table names.
     * @throws Error if the source is not found.
     */
    getSourceTables(source: string): string[];
    /**
     * Get the schema information for a table.
     *
     * @param source The name of the data source.
     * @param table The name of the table.
     * @returns A list of schema field dictionaries.
     * @throws Error if the source or table is not found.
     */
    getTableSchema(source: string, table: string): SchemaData;
    /**
     * Get the path to a parquet file.
     *
     * @param source The name of the data source.
     * @param table The name of the table.
     * @returns The path to the parquet file.
     * @throws Error if the source or table is not found.
     */
    getParquetPath(source: string, table: string): string;
}
