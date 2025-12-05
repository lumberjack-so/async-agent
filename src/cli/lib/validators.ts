/**
 * Validators - Input Validation Utilities
 * Agent 3 implementation: Pure functions for input validation
 */

import { Validators } from '../types.js';

const VALID_MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20251022', 'claude-opus-4-5-20251101'];

export const validators: Validators = {
  validateModel(model: string): { valid: boolean; error?: string } {
    if (!model || model.trim().length === 0) {
      return { valid: false, error: 'Model is required' };
    }
    if (!VALID_MODELS.includes(model.trim())) {
      return {
        valid: false,
        error: `Invalid model. Valid options: ${VALID_MODELS.join(', ')}`,
      };
    }
    return { valid: true };
  },

  validateSkillName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Skill name is required' };
    }
    if (name.length > 100) {
      return { valid: false, error: 'Skill name must be less than 100 characters' };
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      return {
        valid: false,
        error: 'Skill name can only contain letters, numbers, spaces, hyphens, and underscores',
      };
    }
    return { valid: true };
  },

  validateJson(json: string): { valid: boolean; error?: string } {
    if (!json || json.trim().length === 0) {
      return { valid: false, error: 'JSON string is required' };
    }
    try {
      JSON.parse(json);
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { valid: false, error: `Invalid JSON format: ${message}` };
    }
  },

  validatePrompt(prompt: string): { valid: boolean; error?: string } {
    if (!prompt || prompt.trim().length === 0) {
      return { valid: false, error: 'Prompt is required' };
    }
    if (prompt.length > 10000) {
      return { valid: false, error: 'Prompt is too long (max 10,000 characters)' };
    }
    return { valid: true };
  },
};
