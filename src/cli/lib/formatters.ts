/**
 * Formatters - Output Formatting Utilities
 * Agent 3 implementation: Formats skill data, health status, and API responses
 */

import Table from 'cli-table3';
import chalk from 'chalk';
import { Skill } from '@prisma/client';
import { Formatters, HealthResponse, RunResponse } from '../types.js';

export const formatters: Formatters = {
  formatSkillTable(skills: Skill[]): string {
    if (skills.length === 0) {
      return chalk.yellow('No skills found');
    }

    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('Name'),
        chalk.cyan('Type'),
        chalk.cyan('Steps'),
        chalk.cyan('Conns'),
        chalk.cyan('Status'),
      ],
      style: {
        head: [],
        border: ['grey'],
      },
      wordWrap: true,
    });

    for (const skill of skills) {
      const steps = Array.isArray(skill.steps) ? skill.steps.length : 0;
      const conns = skill.connectionNames.length;
      const status = skill.isActive
        ? chalk.green('✓ Active')
        : chalk.red('✗ Inactive');

      table.push([
        skill.id.substring(0, 8),
        skill.name,
        chalk.blue(skill.triggerType),
        steps.toString(),
        conns.toString(),
        status,
      ]);
    }

    const output = table.toString();
    return output + '\n' + chalk.gray("Use 'alfred skills view <id>' for details");
  },

  formatSkillDetail(skill: Skill): string {
    let output = '\n';
    output += chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    output += chalk.bold.cyan('Skill Details\n');
    output += chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');

    output += chalk.bold('ID:') + ' ' + skill.id + '\n';
    output += chalk.bold('Name:') + ' ' + skill.name + '\n';
    output += chalk.bold('Description:') + ' ' + (skill.description || 'N/A') + '\n';
    output += chalk.bold('Trigger Type:') + ' ' + chalk.blue(skill.triggerType) + '\n';
    output +=
      chalk.bold('Status:') +
      ' ' +
      (skill.isActive ? chalk.green('Active') : chalk.red('Inactive')) +
      '\n';
    output += chalk.bold('Run Count:') + ' ' + skill.runCount + '\n';
    output +=
      chalk.bold('Last Run:') +
      ' ' +
      (skill.lastRunAt ? new Date(skill.lastRunAt).toLocaleString() : 'Never') +
      '\n';
    output += chalk.bold('Created:') + ' ' + new Date(skill.createdAt).toLocaleString() + '\n';
    output += chalk.bold('Updated:') + ' ' + new Date(skill.updatedAt).toLocaleString() + '\n';

    output += '\n' + chalk.bold.cyan('Steps\n');
    const stepsArray = Array.isArray(skill.steps) ? (skill.steps as Array<Record<string, unknown>>) : [];
    if (stepsArray.length === 0) {
      output += chalk.gray('No steps defined\n');
    } else {
      for (let i = 0; i < stepsArray.length; i++) {
        const step = stepsArray[i] as Record<string, unknown>;
        output +=
          '\n' +
          chalk.bold(`  Step ${i + 1}:`) +
          '\n' +
          chalk.gray(`    Prompt: ${step.prompt}\n`);
        if (step.guidance) {
          output += chalk.gray(`    Guidance: ${step.guidance}\n`);
        }
        if (step.allowedTools && Array.isArray(step.allowedTools) && step.allowedTools.length > 0) {
          output +=
            chalk.gray(`    Tools: ${step.allowedTools.join(', ')}\n`);
        }
        if (step.connectionNames && Array.isArray(step.connectionNames) && step.connectionNames.length > 0) {
          output +=
            chalk.gray(`    Connections: ${step.connectionNames.join(', ')}\n`);
        }
      }
    }

    if (skill.connectionNames.length > 0) {
      output +=
        '\n' +
        chalk.bold.cyan('Connections\n') +
        chalk.gray(skill.connectionNames.join(', ')) +
        '\n';
    }

    output += '\n' + chalk.bold.cyan('Commands\n');
    output +=
      chalk.gray(`  Edit:   alfred skills edit ${skill.id.substring(0, 8)}\n`);
    output +=
      chalk.gray(`  Delete: alfred skills delete ${skill.id.substring(0, 8)}\n`);
    output += chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return output;
  },

  formatHealthStatus(health: HealthResponse): string {
    const statusIcon = health.status === 'healthy' ? chalk.green('✓') : chalk.red('✗');
    const statusColor = health.status === 'healthy' ? chalk.green : chalk.red;

    let output = '\n';
    output += chalk.bold.cyan('┌─────────────────────────────────────┐\n');
    output += chalk.bold.cyan('│') + '  System Health Status           ' + chalk.bold.cyan('│\n');
    output += chalk.bold.cyan('├─────────────────────────────────────┤\n');
    output +=
      chalk.bold.cyan('│') +
      '  Status:     ' +
      statusIcon +
      '  ' +
      statusColor(health.status.toUpperCase()) +
      chalk.bold.cyan(' '.repeat(15)) +
      '│\n';
    output +=
      chalk.bold.cyan('│') +
      '  Uptime:     ' +
      health.uptime +
      chalk.bold.cyan(' '.repeat(19)) +
      '│\n';
    output +=
      chalk.bold.cyan('│') +
      '  Database:   ' +
      health.database +
      chalk.bold.cyan(' '.repeat(18)) +
      '│\n';
    output +=
      chalk.bold.cyan('│') +
      '  Timestamp:  ' +
      new Date(health.timestamp).toLocaleString() +
      chalk.bold.cyan(' '.repeat(6)) +
      '│\n';

    if (health.metrics) {
      output += chalk.bold.cyan('├─────────────────────────────────────┤\n');
      output += chalk.bold.cyan('│') + '  Metrics:                       ' + chalk.bold.cyan('│\n');
      output +=
        chalk.bold.cyan('│') +
        `  • Requests:  ${health.metrics.totalRequests}` +
        chalk.bold.cyan(' '.repeat(24)) +
        '│\n';
      output +=
        chalk.bold.cyan('│') +
        `  • Avg Time:  ${health.metrics.avgResponseTime}ms` +
        chalk.bold.cyan(' '.repeat(23)) +
        '│\n';
      output +=
        chalk.bold.cyan('│') +
        `  • Success:   ${(health.metrics.successRate * 100).toFixed(1)}%` +
        chalk.bold.cyan(' '.repeat(21)) +
        '│\n';
    }

    output += chalk.bold.cyan('└─────────────────────────────────────┘\n');

    return output;
  },

  formatRunResponse(response: RunResponse, async: boolean): string {
    if (async) {
      return (
        '\n' +
        chalk.green.bold('✓ Task Submitted Successfully\n') +
        chalk.gray('Request ID: ') +
        response.requestId +
        '\n\n'
      );
    }

    let output = '\n';
    output += chalk.bold.cyan('┌─────────────────────────────────────┐\n');
    output += chalk.bold.cyan('│') + '  Execution Result                ' + chalk.bold.cyan('│\n');
    output += chalk.bold.cyan('├─────────────────────────────────────┤\n');
    output +=
      chalk.bold.cyan('│') +
      '  Request ID: ' +
      response.requestId +
      chalk.bold.cyan(' '.repeat(17)) +
      '│\n';

    if (response.metadata?.executionTime !== undefined) {
      output +=
        chalk.bold.cyan('│') +
        `  Time:       ${response.metadata.executionTime}ms` +
        chalk.bold.cyan(' '.repeat(19)) +
        '│\n';
    }

    if (response.metadata?.totalCost !== undefined) {
      output +=
        chalk.bold.cyan('│') +
        `  Cost:       $${response.metadata.totalCost.toFixed(4)}` +
        chalk.bold.cyan(' '.repeat(19)) +
        '│\n';
    }

    if (response.metadata?.workflowName) {
      output +=
        chalk.bold.cyan('│') +
        `  Workflow:   ${response.metadata.workflowName}` +
        chalk.bold.cyan(' '.repeat(18)) +
        '│\n';
    }

    output += chalk.bold.cyan('├─────────────────────────────────────┤\n');
    output += chalk.bold.cyan('│') + '  Response:                      ' + chalk.bold.cyan('│\n');
    output += chalk.bold.cyan('├─────────────────────────────────────┤\n');

    const responseLines = response.response.split('\n');
    for (const line of responseLines.slice(0, 5)) {
      const truncated = line.length > 33 ? line.substring(0, 30) + '...' : line;
      output +=
        chalk.bold.cyan('│') +
        '  ' +
        truncated +
        chalk.bold.cyan(' '.repeat(Math.max(0, 33 - truncated.length))) +
        '│\n';
    }

    if (responseLines.length > 5) {
      output +=
        chalk.bold.cyan('│') +
        chalk.gray('  ... (truncated) ...') +
        chalk.bold.cyan(' '.repeat(13)) +
        '│\n';
    }

    output += chalk.bold.cyan('└─────────────────────────────────────┘\n');

    if (response.url && response.url.length > 0) {
      output += '\n' + chalk.bold('References:\n');
      for (const url of response.url) {
        output += chalk.blue(`  • ${url}\n`);
      }
    }

    output += '\n';

    return output;
  },

  formatError(error: Error): string {
    return '\n' + chalk.red('✗ Error\n') + chalk.gray(error.message) + '\n\n';
  },
};
