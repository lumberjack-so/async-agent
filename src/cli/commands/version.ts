/**
 * Version Command
 * Agent 6 implementation: Displays Alfred version and system information
 */

import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function versionCommand() {
  try {
    // Read version from package.json in the project root
    // When running as a CLI tool, process.cwd() will be the project directory
    let packagePath = join(process.cwd(), 'package.json');

    // Fallback to reading from dist location if running as compiled CLI
    try {
      readFileSync(packagePath, 'utf-8');
    } catch {
      // If not found in cwd, try going up from dist/cli directory
      packagePath = join(process.cwd(), '..', '..', 'package.json');
    }

    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

    console.log(`\n${chalk.bold('alfred')} v${packageJson.version}`);
    console.log(`Node: ${process.version}`);
    console.log(`Platform: ${process.platform}-${process.arch}\n`);
  } catch (error) {
    console.error(chalk.red('Error reading version information'));
    process.exit(1);
  }
}
