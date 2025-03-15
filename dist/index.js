/**
 * Evidence.dev MCP Server - TypeScript Implementation
 * Main module exports
 */
// Re-export components
export { Config } from './config.js';
export { EvidenceDataDiscovery } from './discovery.js';
export { DuckDBDatabase } from './database.js';
export { startServer } from './server.js';
// Main entry point is in cli.js but we don't re-export it
// since it's meant to be run directly
//# sourceMappingURL=index.js.map