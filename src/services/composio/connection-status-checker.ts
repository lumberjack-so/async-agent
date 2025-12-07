/**
 * Composio Connection Status Checker
 *
 * Checks the status of all Composio connections and notifies users of issues
 * Runs on Alfred startup
 */

import chalk from 'chalk';
import { getComposioClient, isComposioAvailable } from './client.js';
import { getComposioDatabase } from './database.js';
import type { Connection } from '@prisma/client';
import type { AuthStatus } from '../../types/composio.js';

export interface ConnectionStatusReport {
  total: number;
  active: number;
  needsAuth: number;
  expired: number;
  failed: number;
  connections: Array<{
    id: string;
    name: string;
    toolkit: string;
    oldStatus: AuthStatus;
    newStatus: AuthStatus;
    changed: boolean;
  }>;
}

export class ConnectionStatusChecker {
  /**
   * Check all Composio connections and update their status
   */
  async checkAllConnections(): Promise<ConnectionStatusReport> {
    if (!isComposioAvailable()) {
      return this.emptyReport();
    }

    try {
      const db = getComposioDatabase();
      const client = getComposioClient();

      // Get all Composio connections from database
      const connections = await db.getComposioConnections();

      if (connections.length === 0) {
        return this.emptyReport();
      }

      const report: ConnectionStatusReport = {
        total: connections.length,
        active: 0,
        needsAuth: 0,
        expired: 0,
        failed: 0,
        connections: [],
      };

      // Check each connection status
      for (const connection of connections) {
        if (!connection.composioAccountId) {
          continue;
        }

        try {
          // Get current status from Composio
          const newStatus = await client.checkConnectionStatus(
            connection.composioAccountId
          );
          const oldStatus = connection.authStatus as AuthStatus;
          const changed = oldStatus !== newStatus;

          // Update status in database if changed
          if (changed) {
            await db.updateConnectionAuthStatus(connection.id, newStatus);
          }

          // Add to report
          report.connections.push({
            id: connection.id,
            name: connection.name,
            toolkit: connection.composioToolkit || 'unknown',
            oldStatus,
            newStatus,
            changed,
          });

          // Count by status
          this.incrementStatusCount(report, newStatus);
        } catch (error) {
          // Connection might have been deleted from Composio
          console.error(
            `[Composio] Failed to check status for ${connection.name}:`,
            error instanceof Error ? error.message : 'Unknown error'
          );

          // Mark as failed
          await db.updateConnectionAuthStatus(connection.id, 'failed');

          report.connections.push({
            id: connection.id,
            name: connection.name,
            toolkit: connection.composioToolkit || 'unknown',
            oldStatus: connection.authStatus as AuthStatus,
            newStatus: 'failed',
            changed: connection.authStatus !== 'failed',
          });

          report.failed++;
        }
      }

      return report;
    } catch (error) {
      console.error(
        '[Composio] Failed to check connection statuses:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return this.emptyReport();
    }
  }

  /**
   * Print connection status report to console
   */
  printReport(report: ConnectionStatusReport): void {
    if (report.total === 0) {
      return; // Don't print anything if no connections
    }

    console.log('\n' + chalk.cyan('─'.repeat(60)));
    console.log(chalk.cyan.bold('🔌 Composio Connections Status'));
    console.log(chalk.cyan('─'.repeat(60)));

    console.log(chalk.white(`Total connections: ${report.total}`));
    console.log(chalk.green(`  ✓ Active: ${report.active}`));

    if (report.needsAuth > 0) {
      console.log(chalk.yellow(`  ⚠ Need authentication: ${report.needsAuth}`));
    }

    if (report.expired > 0) {
      console.log(chalk.gray(`  ○ Expired: ${report.expired}`));
    }

    if (report.failed > 0) {
      console.log(chalk.red(`  ✗ Failed: ${report.failed}`));
    }

    // Show connections that need attention
    const needsAttention = report.connections.filter(
      (c) => c.newStatus !== 'active'
    );

    if (needsAttention.length > 0) {
      console.log('\n' + chalk.yellow.bold('Connections needing attention:'));

      for (const conn of needsAttention) {
        const statusColor = this.getStatusColor(conn.newStatus);
        const statusText = this.getStatusText(conn.newStatus);

        console.log(
          `  ${chalk[statusColor](statusText)} ${chalk.white(conn.name)} (${chalk.gray(conn.toolkit)})`
        );
      }

      console.log(
        '\n' +
          chalk.gray('Run ') +
          chalk.cyan('alfred connections') +
          chalk.gray(' to manage connections')
      );
    }

    console.log(chalk.cyan('─'.repeat(60)) + '\n');
  }

  /**
   * Print a simplified notification for connections needing attention
   */
  printNotification(report: ConnectionStatusReport): void {
    const needsAttention = report.connections.filter(
      (c) => c.newStatus !== 'active'
    );

    if (needsAttention.length === 0) {
      return;
    }

    console.log(
      chalk.yellow(
        `\n⚠  ${needsAttention.length} Composio connection${needsAttention.length > 1 ? 's' : ''} need${needsAttention.length === 1 ? 's' : ''} attention`
      )
    );
    console.log(
      chalk.gray('Run ') +
        chalk.cyan('alfred connections') +
        chalk.gray(' to view details\n')
    );
  }

  // Helper methods

  private emptyReport(): ConnectionStatusReport {
    return {
      total: 0,
      active: 0,
      needsAuth: 0,
      expired: 0,
      failed: 0,
      connections: [],
    };
  }

  private incrementStatusCount(
    report: ConnectionStatusReport,
    status: AuthStatus
  ): void {
    switch (status) {
      case 'active':
        report.active++;
        break;
      case 'needs_auth':
        report.needsAuth++;
        break;
      case 'expired':
        report.expired++;
        break;
      case 'failed':
        report.failed++;
        break;
    }
  }

  private getStatusColor(status: AuthStatus): 'green' | 'yellow' | 'gray' | 'red' | 'white' {
    switch (status) {
      case 'active':
        return 'green';
      case 'needs_auth':
        return 'yellow';
      case 'expired':
        return 'gray';
      case 'failed':
        return 'red';
      default:
        return 'white';
    }
  }

  private getStatusText(status: AuthStatus): string {
    switch (status) {
      case 'active':
        return '✓';
      case 'needs_auth':
        return '⚠';
      case 'expired':
        return '○';
      case 'failed':
        return '✗';
      default:
        return '?';
    }
  }
}

// SINGLETON: Export singleton instance
let statusCheckerInstance: ConnectionStatusChecker | null = null;

export function getConnectionStatusChecker(): ConnectionStatusChecker {
  if (!statusCheckerInstance) {
    statusCheckerInstance = new ConnectionStatusChecker();
  }
  return statusCheckerInstance;
}

/**
 * Helper function to check connections and print report (used in startup)
 */
export async function checkConnectionsOnStartup(
  verbose: boolean = false
): Promise<ConnectionStatusReport> {
  if (!isComposioAvailable()) {
    return {
      total: 0,
      active: 0,
      needsAuth: 0,
      expired: 0,
      failed: 0,
      connections: [],
    };
  }

  const checker = getConnectionStatusChecker();
  const report = await checker.checkAllConnections();

  if (verbose) {
    checker.printReport(report);
  } else {
    checker.printNotification(report);
  }

  return report;
}
