/**
 * Type definitions and interfaces for Alfred CLI
 * These contracts ensure all agents can work in parallel without conflicts
 */

import { Skill } from '@prisma/client';

// ============================================
// DATABASE LAYER (Agent 1)
// ============================================

export interface DatabaseClient {
  listSkills(options?: ListSkillsOptions): Promise<Skill[]>;
  getSkill(id: string): Promise<Skill | null>;
  createSkill(data: SkillCreateInput): Promise<Skill>;
  updateSkill(id: string, data: SkillUpdateInput): Promise<Skill>;
  deleteSkill(id: string): Promise<void>;
}

export interface ListSkillsOptions {
  active?: boolean;
}

export interface SkillCreateInput {
  name: string;
  description: string;
  triggerType: 'classifier' | 'orchestrator' | 'default';
  steps: StepInput[];
  connectionNames?: string[];
  isActive: boolean;
}

export interface SkillUpdateInput {
  name?: string;
  description?: string;
  triggerType?: 'classifier' | 'orchestrator' | 'default';
  steps?: StepInput[];
  connectionNames?: string[];
  isActive?: boolean;
}

export interface StepInput {
  id: number;
  prompt: string;
  guidance?: string;
  allowedTools?: string[];
  connectionNames?: string[];
}

// ============================================
// API CLIENT (Agent 2)
// ============================================

export interface AlfredApiClient {
  health(): Promise<HealthResponse>;
  run(request: RunRequest): Promise<RunResponse>;
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  uptime: string;
  timestamp: string;
  database: string;
  metrics?: {
    totalRequests: number;
    avgResponseTime: number;
    successRate: number;
  };
}

export interface RunRequest {
  prompt: string;
  mode?: 'classifier' | 'orchestrator' | 'default';
  async?: boolean;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface RunResponse {
  response: string;
  url: string[];
  requestId: string;
  metadata?: {
    workflowId?: string;
    workflowName?: string;
    executionTime?: number;
    totalCost?: number;
  };
}

// ============================================
// FORMATTERS (Agent 3)
// ============================================

export interface Formatters {
  formatSkillTable(skills: Skill[]): string;
  formatSkillDetail(skill: Skill): string;
  formatHealthStatus(health: HealthResponse): string;
  formatRunResponse(response: RunResponse, async: boolean): string;
  formatError(error: Error): string;
}

// ============================================
// VALIDATORS (Agent 3)
// ============================================

export interface Validators {
  validateModel(model: string): { valid: boolean; error?: string };
  validateSkillName(name: string): { valid: boolean; error?: string };
  validateJson(json: string): { valid: boolean; error?: string };
  validatePrompt(prompt: string): { valid: boolean; error?: string };
}

// ============================================
// TUI COMPONENTS (Agent 7, 8)
// ============================================

export interface SkillBuilderProps {
  onSave: (skill: SkillCreateInput) => Promise<void>;
  onCancel: () => void;
}

export interface SkillEditorProps {
  skillId: string;
  onSave: (skill: SkillUpdateInput) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// COMMAND OPTIONS (for Commander.js)
// ============================================

export interface RunCommandOptions {
  mode?: 'classifier' | 'orchestrator' | 'default';
  async?: boolean;
  requestId?: string;
  metadata?: string; // JSON string
  json?: boolean;
}

export interface ListCommandOptions {
  active?: boolean;
  inactive?: boolean;
  json?: boolean;
}

export interface ViewCommandOptions {
  json?: boolean;
}

export interface DeleteCommandOptions {
  yes?: boolean;
}

// ============================================
// CUSTOM ERRORS
// ============================================

export class ApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ApiError';
  }
}
