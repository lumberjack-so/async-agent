/**
 * Unit tests for Composio utility functions
 */

import { describe, it, expect } from '@jest/globals';
import {
  extractToolkits,
  isValidComposioTool,
  getToolkitFromTool,
  formatAuthStatus,
  getStatusColor,
} from '../../src/services/composio/utils.js';

describe('Composio Utils', () => {
  describe('extractToolkits', () => {
    it('should extract toolkits from tool names', () => {
      const tools = ['GITHUB_CREATE_ISSUE', 'SLACK_SEND_MESSAGE', 'GITHUB_CREATE_PR'];
      const result = extractToolkits(tools);
      expect(result).toEqual(['github', 'slack']);
    });

    it('should return empty array for empty input', () => {
      expect(extractToolkits([])).toEqual([]);
    });

    it('should handle single-word tool names', () => {
      const tools = ['INVALID'];
      const result = extractToolkits(tools);
      expect(result).toEqual(['invalid']);
    });

    it('should deduplicate toolkit names', () => {
      const tools = ['GITHUB_CREATE_ISSUE', 'GITHUB_UPDATE_ISSUE', 'GITHUB_DELETE_ISSUE'];
      const result = extractToolkits(tools);
      expect(result).toEqual(['github']);
    });
  });

  describe('isValidComposioTool', () => {
    it('should validate correct tool names', () => {
      expect(isValidComposioTool('GITHUB_CREATE_ISSUE')).toBe(true);
      expect(isValidComposioTool('SLACK_SEND_MESSAGE')).toBe(true);
      expect(isValidComposioTool('GMAIL_SEND_EMAIL')).toBe(true);
    });

    it('should reject invalid tool names', () => {
      expect(isValidComposioTool('github_create_issue')).toBe(false);
      expect(isValidComposioTool('GITHUB')).toBe(false);
      expect(isValidComposioTool('github-create-issue')).toBe(false);
      expect(isValidComposioTool('Github_Create_Issue')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isValidComposioTool('')).toBe(false);
    });
  });

  describe('getToolkitFromTool', () => {
    it('should extract toolkit from tool name', () => {
      expect(getToolkitFromTool('GITHUB_CREATE_ISSUE')).toBe('github');
      expect(getToolkitFromTool('SLACK_SEND_MESSAGE')).toBe('slack');
      expect(getToolkitFromTool('GMAIL_SEND_EMAIL')).toBe('gmail');
    });

    it('should return null for invalid tool names', () => {
      expect(getToolkitFromTool('invalid')).toBe(null);
      expect(getToolkitFromTool('GitHub_Create_Issue')).toBe(null);
      expect(getToolkitFromTool('')).toBe(null);
    });
  });

  describe('formatAuthStatus', () => {
    it('should format active status', () => {
      expect(formatAuthStatus('active')).toBe('● Active');
    });

    it('should format needs_auth status', () => {
      expect(formatAuthStatus('needs_auth')).toBe('○ Needs Auth');
    });

    it('should format expired status', () => {
      expect(formatAuthStatus('expired')).toBe('● Expired');
    });

    it('should format failed status', () => {
      expect(formatAuthStatus('failed')).toBe('● Failed');
    });

    it('should return unknown statuses as-is', () => {
      expect(formatAuthStatus('unknown')).toBe('unknown');
    });
  });

  describe('getStatusColor', () => {
    it('should return green for active', () => {
      expect(getStatusColor('active')).toBe('green');
    });

    it('should return yellow for needs_auth', () => {
      expect(getStatusColor('needs_auth')).toBe('yellow');
    });

    it('should return gray for expired', () => {
      expect(getStatusColor('expired')).toBe('gray');
    });

    it('should return red for failed', () => {
      expect(getStatusColor('failed')).toBe('red');
    });

    it('should return white for unknown statuses', () => {
      expect(getStatusColor('unknown')).toBe('white');
    });
  });
});
