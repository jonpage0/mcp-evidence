# MCP-Evidence Public Release Plan

This document outlines the necessary steps to prepare the MCP-Evidence TypeScript server for public release, focusing on sanitization, documentation, security, and ease of installation across multiple platforms including Cursor, Roo-Cline / Cline, and Claude Desktop.

## Current Project Overview

The MCP-Evidence project is a TypeScript implementation of a Model Context Protocol (MCP) server for Evidence.dev, enabling LLMs to:

- Discover Evidence.dev data sources
- List tables in data sources
- Get schema information for tables
- Execute SQL queries on data sources

The implementation uses DuckDB to query data sources (primarily Parquet files and SQL files), with functionality to properly handle column names, BigInt values, and other data type considerations.

## Release Preparation Tasks

### 1. Credential & Sensitive Data Sanitization

#### Issues Identified
- Connection files in `/sources/` contain sensitive information:
  - Database hostnames, usernames, and base64-encoded passwords
  - Connection details that may be specific to internal systems
  - Potential PII in SQL views/queries

#### Remediation Steps
- [ ] Sanitize all connection YAML files:
  - Replace all connection files with templated examples
  - Create a `.gitignore` pattern to exclude real connection files
  - Add documentation on how to create/format connection files
- [ ] Scan codebase for hardcoded credentials with tool like TruffleHog
- [ ] Implement environment variable support for credentials
- [ ] Create a `.env.example` file with placeholder values 
- [ ] Ensure SQL files do not contain sensitive information or PII

### 2. Security Enhancements

#### DuckDB-Specific Controls
- [ ] Implement recommended DuckDB security settings:
  ```sql
  SET disabled_filesystems = 'LocalFileSystem';  -- Block local file access
  SET memory_limit = '4GB';  -- Prevent memory exhaustion attacks
  ```
- [ ] Add configuration options for enabling/disabling DuckDB security features
- [ ] Document security implications of different settings

#### MCP Server Security
- [ ] Add input validation using Zod for all parameters
- [ ] Implement proper error handling that doesn't leak system information
- [ ] Create a SECURITY.md file with vulnerability reporting guidelines
- [ ] Add options for read-only mode to prevent data modification

### 3. Documentation Improvements

#### Core Documentation Files
- [ ] Update README.md with:
  - Clear project description and purpose
  - Complete installation instructions
  - Usage examples
  - Security considerations
  - License information
  - Badges (build status, license, etc.)
- [ ] Create CONTRIBUTING.md with contribution guidelines
- [ ] Add CODE_OF_CONDUCT.md
- [ ] Add CHANGELOG.md for tracking version changes

#### Integration Guides
- [ ] Create detailed setup guides for:
  - Cursor
  - Roo-Cline / Cline
  - Claude Desktop
  - Other MCP-capable clients
- [ ] Include screenshots and configuration examples for each platform

#### Example Usage
- [ ] Add example queries and use cases
- [ ] Provide sample data files that demonstrate functionality

### 4. Package & Distribution Improvements

#### NPM Package Configuration
- [ ] Update package.json with appropriate metadata:
  - Author information
  - Repository links
  - Keywords for discoverability
  - Proper version numbering
- [ ] Ensure correct files are included/excluded in the package

#### Configuration Simplification
- [ ] Create command-line options for common settings
- [ ] Implement auto-discovery of Evidence.dev projects
- [ ] Add interactive setup wizard (optional)

### 5. Platform-Specific Integration

#### Cursor Integration
- [ ] Document Cursor MCP settings location:
  ```
  ~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json
  ```
- [ ] Create Cursor-specific configuration templates
- [ ] Add troubleshooting section for common Cursor issues

#### Roo-Cline / Cline Integration
- [ ] Document Cline configuration paths for each OS:
  - macOS: `~/.config/cline/config.json`
  - Windows: `%APPDATA%\cline\config.json`
- [ ] Provide complete MCP server configuration examples
- [ ] Add Roo-Cline specific considerations

#### Claude Desktop Integration
- [ ] Document Claude Desktop settings location:
  ```
  ~/Library/Application Support/Claude/claude_desktop_config.json
  ```
- [ ] Address Claude-specific security considerations
- [ ] Provide sample queries specific to Claude's capabilities

### 6. License & Legal Compliance

- [ ] Select and add appropriate OSI-approved license (recommend MIT)
- [ ] Ensure all dependencies have compatible licenses
- [ ] Add copyright notices to source files
- [ ] Verify third-party code attribution

### 7. CI/CD & Quality Assurance

- [ ] Set up GitHub Actions for:
  - Automated testing
  - Linting
  - Security scanning
  - Package publishing
- [ ] Add test coverage reporting
- [ ] Implement release tagging automation

## Security Considerations

### DuckDB Security
DuckDB in MCP servers presents specific security considerations:

1. **Filesystem Access**: By default, DuckDB can read arbitrary files on the system. Always use:
   ```sql
   SET disabled_filesystems = 'LocalFileSystem';
   ```

2. **Resource Controls**: Implement memory and thread limits to prevent DOS attacks:
   ```sql
   SET memory_limit = '4GB';
   SET threads = 4;
   ```

3. **Configuration Locking**: Once security settings are applied, lock them:
   ```sql
   SET lock_configuration = true;
   ```

4. **SQL Injection**: Validate all user-provided SQL queries to prevent injection attacks

### MCP Authentication
- Document proper token/credential storage for MCP server configuration
- Recommend using system keychain rather than config files where possible
- Suggest running the server with minimal privileges

## Installation Guide Outline

The installation guide should include the following sections:

1. **Prerequisites**
   - Node.js 18+
   - Evidence.dev project (optional)
   - Permission requirements

2. **Installation Methods**
   - Global installation: `npm install -g mcp-evidence`
   - Local installation: `npm install --save mcp-evidence`
   - Docker installation (if applicable)

3. **Basic Configuration**
   - Command-line options
   - Environment variables
   - Configuration files

4. **Client Integration**
   - Step-by-step setup for each supported client
   - Example configurations
   - Testing the connection

5. **Troubleshooting**
   - Common issues and solutions
   - Diagnostic tools
   - Support channels

## Next Steps & Timeline

1. **Immediate (1-2 days)**
   - Sanitize all credentials
   - Update README with basic information
   - Add license file

2. **Short-term (1 week)**
   - Implement security enhancements
   - Create basic installation guides 
   - Package configuration updates

3. **Medium-term (2-3 weeks)**
   - Complete platform-specific documentation
   - Implement CI/CD pipeline
   - Add comprehensive examples

4. **Long-term (1+ months)**
   - Community engagement
   - Feature additions based on feedback
   - Version 1.0 release preparation