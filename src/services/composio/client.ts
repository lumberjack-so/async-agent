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

    // Get toolkit metadata to determine auth scheme
    const toolkit = await this.getToolkit(params.toolkitName);

    // Get or create auth config for this toolkit
    const authConfigId = await this.getOrCreateAuthConfig(params.toolkitName);

    const payload: any = {
      toolkit: params.toolkitName,
      auth_config: {
        id: authConfigId,
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

    // DEBUG: Log raw Composio response
    console.log('\n🔍 RAW COMPOSIO RESPONSE:', JSON.stringify({
      toolkit_auth_scheme: toolkit.authScheme,
      response_redirect_url: response.data.redirect_url,
      response_id: response.data.id,
    }, null, 2));

    // Use toolkit metadata to determine auth type (more reliable than response)
    const isOAuth = toolkit.authScheme?.toUpperCase() === 'OAUTH2';

    return {
      type: isOAuth ? 'oauth' : 'api_key',
      authUrl: response.data.redirect_url, // FIX: Composio returns redirect_url, not auth_url
      authStatus: 'pending',
      connectionId: response.data.id,
    };
  }

  async getOrCreateAuthConfig(toolkitName: string): Promise<string> {
    // Try to get existing auth config
    const response = await this.client.get('/v3/auth_configs', {
      params: { toolkit: toolkitName },
    });

    const allConfigs = response.data.items || [];

    // DEBUG: Log what we got back
    console.log(`\n🔍 getOrCreateAuthConfig('${toolkitName}'):`);
    console.log(`   Total configs returned: ${allConfigs.length}`);
    if (allConfigs.length > 0) {
      console.log('   Configs:', allConfigs.map((c: any) => ({
        id: c.id,
        toolkit: c.toolkit?.slug || c.toolkit,
        name: c.name,
      })));
    }

    // Filter to only configs for THIS toolkit (in case API ignores filter)
    const existingConfigs = allConfigs.filter((c: any) => {
      const configToolkit = c.toolkit?.slug || c.toolkit;
      return configToolkit === toolkitName;
    });

    console.log(`   Filtered to ${existingConfigs.length} matching configs for ${toolkitName}`);

    if (existingConfigs.length > 0) {
      console.log(`   ✓ Using existing auth config: ${existingConfigs[0].id}`);
      return existingConfigs[0].id;
    }

    // Create new Composio-managed auth config
    console.log(`   Creating new auth config for ${toolkitName}...`);
    const createResponse = await this.client.post('/v3/auth_configs', {
      toolkit: { slug: toolkitName },
      name: toolkitName,
      auth_config: {
        type: 'use_composio_managed_auth',
      },
    });

    console.log(`   ✓ Created auth config: ${createResponse.data.auth_config.id}`);
    return createResponse.data.auth_config.id;
  }

  async deleteConnectedAccount(accountId: string): Promise<void> {
    await this.client.delete(`/v3/connected_accounts/${accountId}`);
  }

  async checkConnectionStatus(accountId: string): Promise<AuthStatus> {
    const account = await this.getConnectedAccount(accountId);

    // DEBUG: Log what Composio returns for connection status
    const accountAny = account as any;
    console.log('\n🔍 CHECK STATUS RESPONSE:', JSON.stringify({
      id: account.id,
      status: accountAny.status,
      normalized: accountAny.status?.toLowerCase(),
    }, null, 2));

    // Normalize status to lowercase (Composio returns UPPERCASE)
    const status = account.status?.toLowerCase() as AuthStatus;
    return status;
  }

  // ============== Toolkits ==============

  async listToolkits(): Promise<ComposioToolkit[]> {
    const response = await this.client.get('/v3/toolkits');
    const items = response.data.items || [];

    // DEBUG: Log first toolkit to see what Composio returns
    if (items.length > 0) {
      console.log('\n🔍 Sample toolkit from Composio API:', JSON.stringify(items[0], null, 2));
    }

    // Transform API response to our format
    return items.map((item: any) => ({
      name: item.slug || item.name,
      displayName: item.name,
      description: item.meta?.description || '',
      category: item.meta?.categories?.[0]?.name || 'Other',
      logoUrl: item.meta?.logo || null,
      authScheme: item.composio_managed_auth_schemes?.[0] || item.auth_schemes?.[0] || 'unknown',
      tools: item.tools || item.actions || [], // Try both 'tools' and 'actions' fields
    }));
  }

  async getToolkit(toolkitName: string): Promise<ComposioToolkit> {
    const response = await this.client.get(`/v3/toolkits/${toolkitName}`);
    const item = response.data;

    // DEBUG: Log what single toolkit endpoint returns
    console.log(`\n🔍 GET /v3/toolkits/${toolkitName} response:`, JSON.stringify(item, null, 2));

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
    try {
      // Use v2 API (v3 /tools endpoint is bugged and ignores toolkit filter)
      // v2 uses uppercase app names: "gmail" -> "GMAIL", "linear" -> "LINEAR"
      // v2 API is on backend.composio.dev, not api.composio.dev
      const appName = toolkitName.toUpperCase();

      const response = await this.client.get('https://backend.composio.dev/api/v2/actions', {
        params: { apps: appName }
      });

      const tools = response.data.items?.map((tool: any) => tool.name) || [];
      console.log(`🔍 Fetched ${tools.length} tools for ${toolkitName}`);
      return tools;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch tools for ${toolkitName}:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  async getToolkitToolsDetailed(toolkitName: string): Promise<Array<{
    name: string;
    displayName: string;
    description: string;
  }>> {
    try {
      const appName = toolkitName.toUpperCase();

      const response = await this.client.get('https://backend.composio.dev/api/v2/actions', {
        params: { apps: appName }
      });

      const tools = response.data.items?.map((tool: any) => ({
        name: tool.name,
        displayName: tool.displayName || tool.display_name || tool.name,
        description: tool.description || 'No description available',
      })) || [];

      return tools;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch tool details for ${toolkitName}:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
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
