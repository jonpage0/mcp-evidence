/**
 * Utility functions for the MCP-Evidence server
 */
/**
 * Custom replacer function for JSON.stringify to handle BigInt values
 * This solves the "Do not know how to serialize a BigInt" error
 *
 * @param key The current key being processed
 * @param value The value to convert
 * @returns The processed value safe for JSON serialization
 */
export declare function bigIntReplacer(key: string, value: unknown): unknown;
/**
 * Safe JSON stringify that handles BigInt values
 *
 * @param value The value to stringify
 * @param space Number of spaces for indentation
 * @returns A JSON string with BigInt values properly handled
 */
export declare function safeJsonStringify(value: unknown, space?: number): string;
