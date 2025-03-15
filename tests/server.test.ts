import { describe, it, expect, vi } from 'vitest';
import { Config } from '../src/config.js';
import { startServer } from '../src/server.js';

// Mock MCP SDK to prevent actual server startup
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: vi.fn().mockImplementation(() => {
      return {
        tool: vi.fn().mockReturnThis(),
        resource: vi.fn().mockReturnThis(),
        connect: vi.fn().mockResolvedValue(undefined)
      };
    }),
    ResourceTemplate: vi.fn()
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: vi.fn().mockImplementation(() => {
      return {};
    })
  };
});

// Create a basic test for the server startup
describe('MCP Server', () => {
  it('should initialize and start the server', async () => {
    const config = new Config({
      projectPath: process.cwd()
    });
    
    // Mock console.info to prevent output during tests
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    
    // Start the server
    await startServer(config);
    
    // Check that console.info was called with expected messages
    expect(consoleInfoSpy).toHaveBeenCalledWith('Starting Evidence.dev MCP Server');
    expect(consoleInfoSpy).toHaveBeenCalledWith('Starting MCP server on stdio transport');
    expect(consoleInfoSpy).toHaveBeenCalledWith('MCP server running. Press Ctrl+C to exit.');
    
    // Restore original implementation
    consoleInfoSpy.mockRestore();
  });
});