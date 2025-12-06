/**
 * Composio Integration Types
 *
 * Type definitions for Composio OAuth management and MCP configuration
 */

export interface ComposioConfig {
  apiKey: string;
  baseUrl?: string;
  userId?: string;
}

export interface ComposioConnectedAccount {
  id: string;
  toolkitName: string;
  status: 'active' | 'needs_auth' | 'expired' | 'failed';
  createdAt: string;
  lastUsedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ComposioToolkit {
  name: string;
  displayName: string;
  description: string;
  category: string;
  logoUrl?: string;
  authScheme: 'oauth2' | 'api_key' | 'basic';
  tools: string[];
}

export interface ComposioMcpConfigCreateParams {
  name: string;
  toolkits: Array<{
    toolkit: string;
    authConfig?: string;
  }>;
  allowedTools?: string[];
}

export interface ComposioMcpConfigResponse {
  id: string;
  name: string;
  toolkits: string[];
  allowedTools: string[];
  createdAt: string;
}

export interface ComposioAuthFlow {
  type: 'oauth' | 'api_key';
  authUrl?: string;
  authStatus: 'pending' | 'completed' | 'failed';
  connectionId?: string;
}

export type ConnectionSource = 'manual' | 'composio';
export type AuthStatus = 'active' | 'needs_auth' | 'expired' | 'failed';
