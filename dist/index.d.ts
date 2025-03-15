/**
 * Evidence.dev MCP Server - TypeScript Implementation
 * Main module exports
 */
export { Config, type ConfigOptions } from './config.js';
export { EvidenceDataDiscovery, type SourceInfo, type TableInfo, type SchemaData, type SourceSummary } from './discovery.js';
export { DuckDBDatabase } from './database.js';
export { startServer } from './server.js';
