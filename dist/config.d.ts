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
    /** Default maximum number of results to return from queries. */
    defaultResultLimit?: number;
}
/**
 * Configuration for the Evidence.dev MCP server.
 */
export declare class Config {
    /** Path to the Evidence.dev project root directory. */
    readonly projectPath: string;
    /** Optional override for the data path. */
    readonly dataPath?: string;
    /** Run server in read-only mode. Always true for Evidence.dev MCP server. */
    readonly readonly: boolean;
    /** Enable debug logging. */
    readonly debug: boolean;
    /** Default maximum number of results to return from queries. */
    readonly defaultResultLimit: number;
    /**
     * Create a new configuration.
     *
     * @param options Configuration options
     */
    constructor(options: ConfigOptions);
    /**
     * Get the path to the data directory.
     *
     * @returns Path to the data directory.
     * @throws Error if the data directory doesn't exist.
     */
    getDataPath(): string;
}
