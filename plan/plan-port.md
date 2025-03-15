# TypeScript Port Implementation Plan: MCP-Evidence Server

This document outlines the plan for porting the Python-based MCP-Evidence server to TypeScript using the official MCP TypeScript SDK.

## Executive Summary

**Current Status**: The port is functionally complete with one major outstanding issue:

- Data sources & tables discovery ✅ Successfully implemented
- MCP tools & resources ✅ Successfully implemented 
- Database querying ❌ Needs work (DuckDB integration issue)

The server successfully implements the core Evidence.dev discovery functionality but encounters issues with the DuckDB database integration for querying data.

## Project Overview

The current Python project is an MCP (Model Context Protocol) server that exposes Evidence.dev data sources to LLMs through the MCP protocol. It allows LLMs to discover, query, and interact with Evidence.dev data sources (primarily Parquet files) via SQL.

## Migration Goals

1. Port all functionality to TypeScript ✅ (Almost complete - DuckDB integration has issues)
2. Use the official MCP TypeScript SDK ✅ (Completed)
3. Maintain feature parity with the Python implementation ⚠️ (Partial - Source discovery works, querying needs fixing)
4. Improve code structure and maintainability where possible ✅ (Completed)
5. Create thorough documentation ✅ (Completed)

## Completed Implementation

### Phase 1: Project Setup (COMPLETED)

1. ✅ Initialize TypeScript project with appropriate configuration
   - Set up package.json with required dependencies
   - Configure tsconfig.json for the project
   - Set up testing framework (Vitest)
   - Set up linting and formatting
   
2. ✅ Core Development Setup
   - Create source directory structure
   - Set up types and interfaces
   - Create .gitignore with appropriate entries
   - Document the project structure

### Phase 2: Core Module Implementation (COMPLETED)

1. ✅ Port Config module
   - Implement project path validation
   - Implement data path discovery
   - Add command-line parsing with Commander
   
2. ✅ Port Discovery module
   - Implement source discovery
   - Implement table discovery
   - Implement manifest parsing
   - Add support for different file types
   
3. ✅ Port Database module (with issues)
   - Implement DuckDB interface
   - Handle DuckDB connection lifecycle
   - Implement query execution and result formatting
   - **Known Issue**: DuckDB.Database is not a constructor error

### Phase 3: MCP Server Implementation (COMPLETED)

1. ✅ Create MCP Server instance
   - Set up with appropriate metadata
   - Configure resources and tools
   
2. ✅ Implement Resources
   - Source listing resource
   - Table listing resource
   - Table schema resource
   
3. ✅ Implement Tools
   - Source listing tool
   - Table listing tool
   - Table schema tool
   - Query tool (has DuckDB issues)
   
4. ✅ Add error handling
   - Implement proper error response formatting

### Phase 4: Testing (MOSTLY COMPLETED)

1. ✅ Set up Vitest for testing
   - Configure test environment
   - Create test utilities
   
2. ✅ Create unit tests
   - Test Config module
   - Test Discovery module
   - Test Database module (partial due to DuckDB issues)
   
3. ✅ Create integration tests
   - Test end-to-end functionality (partial due to DuckDB issues)

### Phase 5: Finalization (PARTIALLY COMPLETED)

1. ✅ Documentation
   - Add JSDoc comments to all modules
   - Create comprehensive README
   - Add usage examples
   
2. ✅ Package Configuration
   - Set up npm package.json
   - Configure entry points and exports
   - Add CLI configuration
   
3. ✅ Build Process
   - Create build scripts
   - Set up npm package configuration

## Remaining Work

The primary outstanding issue is with the DuckDB integration. The recommended approach to complete this is:

1. **DuckDB Integration Fix**:
   - Replace current 'duckdb' package usage with '@duckdb/node-api'
   - Update the Database module to use the async/await pattern
   - Refactor the connection and query methods to match the newer API

2. **SQL File Support**:
   - Add proper handling for SQL file content
   - Implement execution of SQL queries from files
   - Add result formatting for SQL queries

3. **Testing**:
   - Add targeted tests for the database integration
   - Verify query results against expected outputs

4. **Publishing**:
   - Complete package preparation
   - Publish to npm

## Technical Challenges and Solutions

### 1. DuckDB Integration (Pending Resolution)

**Challenge**: The DuckDB API in Node.js differs from the Python version, causing "duckdb.Database is not a constructor" errors.

**Solution (Pending)**: 
- Move from 'duckdb' package to '@duckdb/node-api'
- Update API calls to follow the async/await model
- Adapt the database interface to match the new API

### 2. File System Operations (Resolved)

**Challenge**: File system operations in Node.js are different from Python.

**Solution**: Successfully implemented Node.js `fs` and `path` modules to handle file system operations, replacing Python's `pathlib`.

### 3. Async Operations (Resolved)

**Challenge**: Node.js is inherently asynchronous, while the Python code uses a mix of sync and async operations.

**Solution**: Implemented appropriate async/await patterns where needed, while maintaining synchronous operations where blocking is acceptable.

### 4. Error Handling (Resolved)

**Challenge**: Error handling patterns differ between Python and TypeScript.

**Solution**: Implemented TypeScript-native error handling with proper typing and propagation.

### 5. Testing with Real Data (Resolved)

**Challenge**: Using the existing `/sources` directory for testing without modifying it.

**Solution**: Successfully created tests that work with the actual data directories.

## Success Criteria

1. ✅ Core functionality ported from Python to TypeScript
2. ⚠️ All tests passing (Partly achieved - non-database tests pass)
3. ✅ Documentation complete
4. ✅ Build process working
5. ⚠️ Server works with Evidence.dev data sources (Partly achieved - discovery works, querying doesn't)

## Next Steps

1. Focus on fixing the DuckDB integration issue
2. Complete the SQL file support
3. Ensure all tests pass
4. Prepare for package publication

## Lessons Learned

1. **Native Module Integration**: Working with native modules like DuckDB requires careful consideration of API differences between Node.js environments.
   
2. **TypeScript Configuration**: ES modules with TypeScript require specific configuration to handle both development and production builds.
   
3. **File-Based Data Sources**: Working with SQL files rather than Parquet files introduces additional complexity in data handling.