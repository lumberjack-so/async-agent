/**
 * TUI Command - Launch Interactive Terminal UI
 */

import React from 'react';
import { render } from 'ink';
import { AlfredTUI } from '../tui/AlfredTUI.js';

export async function tuiCommand() {
  const { waitUntilExit } = render(<AlfredTUI />);
  await waitUntilExit();
}
