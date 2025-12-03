/**
 * Connections Middleware
 *
 * This middleware is responsible for populating req.mcpConnections with
 * the MCP server configurations that the agent should use for this request.
 *
 * PLACEHOLDER IMPLEMENTATION:
 * Currently returns an empty connections object. This should be replaced
 * with your actual connection resolution logic, which might:
 *
 * - Load connections from a database based on user/tenant ID
 * - Fetch connections from an external API
 * - Read from request headers or body
 * - Use a configuration service
 *
 * Example future implementation:
 *
 * ```typescript
 * export async function connectionsMiddleware(req, res, next) {
 *   const tenantId = req.headers['x-tenant-id'];
 *   const connections = await connectionService.getConnections(tenantId);
 *   req.mcpConnections = connections;
 *   next();
 * }
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { McpConnections } from '../types.js';

/**
 * Default connections middleware
 * Populates req.mcpConnections - override this for your use case
 */
export function connectionsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // PLACEHOLDER: Replace with your connection resolution logic
  //
  // This is where you would:
  // 1. Extract tenant/user identification from request
  // 2. Look up their MCP server configurations
  // 3. Populate req.mcpConnections
  //
  // For now, we set an empty object - no MCP servers available
  // The agent will still work but won't have any tools

  req.mcpConnections = {};

  next();
}

/**
 * Create a connections middleware with static configuration
 * Useful for development/testing
 *
 * @param connections - Static MCP connections to use for all requests
 */
export function createStaticConnectionsMiddleware(
  connections: McpConnections
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    req.mcpConnections = { ...connections };
    next();
  };
}

/**
 * Create a connections middleware from environment variable
 * Reads MCP_CONNECTIONS env var as JSON
 */
export function createEnvConnectionsMiddleware(): (
  req: Request,
  res: Response,
  next: NextFunction
) => void {
  let connections: McpConnections = {};

  const envConnections = process.env.MCP_CONNECTIONS;
  if (envConnections) {
    try {
      connections = JSON.parse(envConnections);
      console.log(
        '[Connections] Loaded MCP connections from environment:',
        Object.keys(connections).join(', ')
      );
    } catch (error) {
      console.error(
        '[Connections] Failed to parse MCP_CONNECTIONS env var:',
        error
      );
    }
  } else {
    console.warn(
      '[Connections] MCP_CONNECTIONS env var not set - agent will have no tools'
    );
  }

  return (req: Request, res: Response, next: NextFunction) => {
    req.mcpConnections = { ...connections };
    next();
  };
}

/**
 * Validate that MCP connections are available
 * Can be used as middleware to reject requests without connections
 */
export function requireConnectionsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.mcpConnections || Object.keys(req.mcpConnections).length === 0) {
    res.status(503).json({
      error: 'NoConnections',
      message: 'No MCP connections available for this request',
    });
    return;
  }

  next();
}
