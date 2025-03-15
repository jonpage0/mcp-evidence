# TypeScript Port Plan: MCP-Evidence Server

This document outlines the plan for porting the Python-based MCP-Evidence server to TypeScript using the official MCP TypeScript SDK.

## Project Overview

The current Python project is an MCP (Model Context Protocol) server that exposes Evidence.dev data sources to LLMs through the MCP protocol. It allows LLMs to discover, query, and interact with Evidence.dev data sources (primarily Parquet files) via SQL.

## Migration Goals

1. Port all functionality to TypeScript
2. Use the official MCP TypeScript SDK
3. Maintain feature parity with the Python implementation
4. Improve code structure and maintainability where possible
5. Create thorough documentation

## Current Project Structure

The Python implementation (located in `/python-version`) consists of:

1. **Config Class**: Handles configuration and command line arguments
2. **EvidenceDataDiscovery**: Discovers Evidence.dev data sources and parquet files
3. **DuckDBDatabase**: Interface to DuckDB for querying parquet files
4. **MCP Protocol Handlers**: Implements various MCP protocol requests

## TypeScript Port Structure

The TypeScript port will be structured as follows:

```
/
├── src/
│   ├── config.ts               # Configuration handling
│   ├── discovery.ts            # Evidence.dev data discovery
│   ├── database.ts             # DuckDB database interface
│   ├── server.ts               # MCP server implementation
│   └── index.ts                # Main entry point
├── types/
├── /sources/                   # Existing - Do not modify (real production data)
├── /.evidence/                 # Existing - Do not modify (real production data)
├── /python-version/            # Original Python implementation - for reference
│   └── index.d.ts              # TypeScript type definitions
├── tests/                      # Test files
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── README.md                   # Documentation
```

## Dependencies

The TypeScript port will require the following dependencies:

1. **Core Dependencies**:
   - `@modelcontextprotocol/sdk`: Official MCP TypeScript SDK
   - `duckdb`: Node.js bindings for DuckDB
   - `node-parquet`: For working with Parquet files
   - `zod`: For schema validation (used by MCP SDK)
   - `commander`: For command-line argument parsing

2. **Development Dependencies**:
   - `typescript`: TypeScript compiler
   - `ts-node`: TypeScript execution environment
   - `vitest`: Testing framework
   - `@types/*`: TypeScript type definitions for dependencies

## Implementation Plan (TypeScript - Node.js)

### Phase 1: Project Setup

1. Initialize TypeScript project
2. Add dependencies
3. Configure TypeScript
4. Set up testing environment

### Phase 2: Core Components

1. **Config Module**:
   - Port the Config class to TypeScript
   - Implement command-line argument parsing
   - Handle project and data paths

2. **Discovery Module**:
   - Port EvidenceDataDiscovery to TypeScript
   - Implement manifest parsing
   - Implement directory scanning
   - Handle Parquet file discovery

3. **Database Module**:
   - Port DuckDBDatabase to TypeScript
   - Implement DuckDB connection handling
   - Implement query execution
   - Register views for discovered Parquet files

### Phase 3: MCP Server Implementation

1. **Server Module**:
   - Create a new McpServer instance
   - Implement resources handlers
   - Implement tools handlers
   - Set up error handling

2. **Main Entry Point**:
   - Implement the main function
   - Handle command-line arguments
   - Initialize and start the server

### Phase 4: Testing and Documentation

1. **Testing**:
   - Write unit tests for config, discovery, and database modules
   - Write integration tests for the server
   - Create test fixtures

2. **Documentation**:
   - Document APIs
   - Create usage examples
   - Add installation and usage instructions

## Technical Challenges and Solutions

### 1. DuckDB Integration

**Challenge**: The Python implementation uses Python's DuckDB library, but we need to use Node.js bindings.

**Solution**: Use the `duckdb` npm package and adapt the API calls accordingly. We'll need to handle connection management and query execution differently.

### 2. File System Operations

**Challenge**: File system operations in Node.js are different from Python.

**Solution**: Use Node.js `fs` and `path` modules to handle file system operations. Replace Python's `pathlib` with equivalent Node.js code.

### 3. Async Operations

**Challenge**: Node.js is inherently asynchronous, while the Python code uses a mix of sync and async operations.

**Solution**: Convert appropriate operations to use async/await to maintain proper flow control and prevent blocking the event loop.

### 4. Error Handling

**Challenge**: Error handling patterns differ between Python and TypeScript.

**Solution**: Implement appropriate TypeScript error handling patterns, using the MCP SDK's error types where applicable.

### 5. Testing with Real Data

**Challenge**: Using the existing `/sources` and `/.evidence` folders for testing without modifying them.

**Solution**: Create test cases that use these directories for input data but write any outputs to temporary directories. Use vitest for testing instead of Jest.

## Migration Steps

1. Set up the project structure and dependencies
2. Port the Config module
3. Port the Discovery module
4. Port the Database module
5. Implement the MCP server using the TypeScript SDK
6. Create tests
7. Document the new implementation
8. Create release build and package for distribution

## Timeline

1. **Phase 1**: Project Setup - 1 day
2. **Phase 2**: Core Components - 3 days
3. **Phase 3**: MCP Server Implementation - 2 days
4. **Phase 4**: Testing and Documentation - 2 days

Total estimated time: 8 days

## Success Criteria

The TypeScript port will be considered successful when:

1. All functionality from the Python implementation is available in TypeScript
2. All tests pass
3. Documentation is complete
4. The server can be built and packaged for distribution
5. The server works correctly with Evidence.dev data sources