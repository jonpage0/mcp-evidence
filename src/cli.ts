#!/usr/bin/env node
/**
 * Evidence.dev MCP Server - CLI Entry Point
 */
import { Command } from 'commander';
import { Config } from './config.js';
import { startServer } from './server.js';

/**
 * Main entry point for the CLI
 */
export async function main() {
  const program = new Command();
  
  program
    .name('mcp-evidence')
    .description('Evidence.dev MCP Server - TypeScript Implementation')
    .version('0.1.0')
    .requiredOption('--project-path <path>', 'Path to the Evidence.dev project')
    .option('--data-path <path>', 'Optional override for the data directory path')
    .option('--default-result-limit <number>', 'Default maximum number of results to return from queries (default: 10)', (value) => Number.parseInt(value, 10))
    .option('--debug', 'Enable debug logging')
    .parse(process.argv);
  
  const options = program.opts();
  
  try {
    // Set up logging level
    if (options.debug) {
      console.debug('Debug logging enabled');
    }
    
    // Create config from command line arguments
    const config = new Config({
      projectPath: options.projectPath,
      dataPath: options.dataPath,
      debug: options.debug || false,
      defaultResultLimit: options.defaultResultLimit
    });
    
    // Start the server
    await startServer(config);
  } catch (e) {
    const error = e as Error;
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Call the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});