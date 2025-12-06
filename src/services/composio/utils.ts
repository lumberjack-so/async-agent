/**
 * Composio Utility Functions
 *
 * Reusable utilities for Composio integration
 */

import type { ComposioToolkit } from '../../types/composio.js';

/**
 * Extract toolkit names from tool names
 * Example: ["GITHUB_CREATE_ISSUE", "SLACK_SEND_MESSAGE"] → ["github", "slack"]
 */
export function extractToolkits(tools: string[]): string[] {
  const toolkits = new Set<string>();

  for (const tool of tools) {
    const parts = tool.split('_');
    if (parts.length > 0) {
      const toolkit = parts[0].toLowerCase();
      toolkits.add(toolkit);
    }
  }

  return Array.from(toolkits);
}

/**
 * Format connection status for display
 */
export function formatAuthStatus(status: string): string {
  const statusMap: Record<string, string> = {
    active: '● Active',
    needs_auth: '○ Needs Auth',
    expired: '● Expired',
    failed: '● Failed',
  };

  return statusMap[status] || status;
}

/**
 * Get status indicator color
 */
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    active: 'green',
    needs_auth: 'yellow',
    expired: 'gray',
    failed: 'red',
  };

  return colorMap[status] || 'white';
}

/**
 * Group toolkits by category
 */
export function groupToolkitsByCategory(
  toolkits: ComposioToolkit[]
): Record<string, ComposioToolkit[]> {
  return toolkits.reduce((acc, toolkit) => {
    const category = toolkit.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(toolkit);
    return acc;
  }, {} as Record<string, ComposioToolkit[]>);
}

/**
 * Validate Composio tool name format
 */
export function isValidComposioTool(toolName: string): boolean {
  // Format: TOOLKIT_ACTION (all uppercase with underscores)
  return /^[A-Z]+(_[A-Z]+)+$/.test(toolName);
}

/**
 * Get toolkit from tool name
 * Example: "GITHUB_CREATE_ISSUE" → "github"
 */
export function getToolkitFromTool(toolName: string): string | null {
  if (!isValidComposioTool(toolName)) {
    return null;
  }
  return toolName.split('_')[0].toLowerCase();
}
