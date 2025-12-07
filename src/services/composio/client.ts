/**
 * Composio Client
 *
 * API client for Composio service - handles connected accounts, toolkits, and MCP configs
 */

import axios, { AxiosInstance } from 'axios';
import { config, isComposioEnabled } from '../../config/index.js';
import type {
  ComposioConfig,
  ComposioConnectedAccount,
  ComposioToolkit,
  ComposioMcpConfigCreateParams,
  ComposioMcpConfigResponse,
  ComposioAuthFlow,
  AuthStatus,
} from '../../types/composio.js';

export class ComposioClient {
  private client: AxiosInstance;
  private userId?: string;

  constructor(configOverride?: Partial<ComposioConfig>) {
    const cfg = configOverride || config.composio;

    if (!cfg?.apiKey) {
      throw new Error('Composio API key not configured');
    }

    this.client = axios.create({
      baseURL: cfg.baseUrl || 'https://api.composio.dev',
      headers: {
        'X-API-Key': cfg.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.userId = cfg.userId;
  }

  // ============== Connected Accounts ==============

  async listConnectedAccounts(userId?: string): Promise<ComposioConnectedAccount[]> {
    const uid = userId || this.userId;
    const params = uid ? { user_id: uid } : {};

    const response = await this.client.get('/v3/connected_accounts', { params });
    return response.data.items || [];
  }

  async getConnectedAccount(accountId: string): Promise<ComposioConnectedAccount> {
    const response = await this.client.get(`/v3/connected_accounts/${accountId}`);
    return response.data;
  }

  async initiateConnection(params: {
    toolkitName: string;
    userId?: string;
    redirectUrl?: string;
  }): Promise<ComposioAuthFlow> {
    const userId = params.userId || this.userId;
    const payload: any = {
      toolkit: params.toolkitName,
      auth_config: {
        id: 'default',
      },
      connection: {
        labels: [],
      },
    };

    if (userId) {
      payload.connection.entity_id = userId;
    }

    if (params.redirectUrl) {
      payload.redirect_url = params.redirectUrl;
    }

    const response = await this.client.post('/v3/connected_accounts', payload);

    return {
      type: response.data.auth_scheme === 'oauth2' ? 'oauth' : 'api_key',
      authUrl: response.data.auth_url,
      authStatus: 'pending',
      connectionId: response.data.id,
    };
  }

  async deleteConnectedAccount(accountId: string): Promise<void> {
    await this.client.delete(`/v3/connected_accounts/${accountId}`);
  }

  async checkConnectionStatus(accountId: string): Promise<AuthStatus> {
    const account = await this.getConnectedAccount(accountId);
    return account.status as AuthStatus;
  }

  // ============== Toolkits ==============

  async listToolkits(): Promise<ComposioToolkit[]> {
    const response = await this.client.get('/v3/toolkits');
    const items = response.data.items || [];

    // Transform API response to our format
    return items.map((item: any) => ({
      name: item.slug || item.name,
      displayName: item.name,
      description: item.meta?.description || '',
      category: item.meta?.categories?.[0]?.name || 'Other',
      logoUrl: item.meta?.logo || null,
      authScheme: item.composio_managed_auth_schemes?.[0] || item.auth_schemes?.[0] || 'unknown',
      tools: [], // Will be populated separately if needed
    }));
  }

  async getToolkit(toolkitName: string): Promise<ComposioToolkit> {
    const response = await this.client.get(`/v3/toolkits/${toolkitName}`);
    const item = response.data;

    // Transform API response to our format
    return {
      name: item.slug || item.name,
      displayName: item.name,
      description: item.meta?.description || '',
      category: item.meta?.categories?.[0]?.name || 'Other',
      logoUrl: item.meta?.logo || null,
      authScheme: item.composio_managed_auth_schemes?.[0] || item.auth_schemes?.[0] || 'unknown',
      tools: [], // Will be populated separately if needed
    };
  }

  async getToolkitTools(toolkitName: string): Promise<string[]> {
    const response = await this.client.get(`/v3/toolkits/${toolkitName}/tools`);
    return response.data.items?.map((tool: any) => tool.name) || [];
  }

  // ============== MCP Configs ==============

  async createMcpConfig(params: ComposioMcpConfigCreateParams): Promise<ComposioMcpConfigResponse> {
    const response = await this.client.post('/v3/mcp/configs', params);
    return response.data;
  }

  async getMcpConfig(configId: string): Promise<ComposioMcpConfigResponse> {
    const response = await this.client.get(`/v3/mcp/configs/${configId}`);
    return response.data;
  }

  async deleteMcpConfig(configId: string): Promise<void> {
    await this.client.delete(`/v3/mcp/configs/${configId}`);
  }

  async generateMcpUrl(params: {
    userId: string;
    mcpConfigId: string;
  }): Promise<string> {
    const response = await this.client.post('/v3/mcp/generate', {
      user_id: params.userId,
      config_id: params.mcpConfigId,
    });
    return response.data.url;
  }
}

// SINGLETON PATTERN: Export singleton instance
let composioClientInstance: ComposioClient | null = null;

export function getComposioClient(): ComposioClient {
  if (!isComposioEnabled()) {
    throw new Error('Composio integration is not enabled. Set COMPOSIO_API_KEY in environment.');
  }

  if (!composioClientInstance) {
    composioClientInstance = new ComposioClient();
  }

  return composioClientInstance;
}

export function isComposioAvailable(): boolean {
  return isComposioEnabled();
}
