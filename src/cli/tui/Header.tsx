/**
 * Header Component for Alfred TUI
 * Beautiful, gradient-enhanced header with ASCII art branding
 */

import React from 'react';
import { Box, Text } from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';
import { colors, brand, borders, getModeColor } from './theme.js';

interface HeaderProps {
  mode: string;
  version: string;
}

export const Header: React.FC<HeaderProps> = ({ mode, version }) => {
  const modeColor = getModeColor(mode);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Big beautiful logo with rainbow gradient */}
      <Gradient name="rainbow">
        <BigText text="ALFRED" font="chrome" />
      </Gradient>

      {/* Bowtie symbol prominently displayed */}
      <Box justifyContent="center" marginTop={0}>
        <Text bold color={colors.primary}>
          {brand.symbol}
        </Text>
      </Box>

      {/* Animated tagline */}
      <Box justifyContent="center" marginTop={0}>
        <Text dimColor>{brand.tagline}</Text>
      </Box>

      {/* Status bar with current mode and version */}
      <Box
        borderStyle="double"
        borderColor={modeColor}
        paddingX={2}
        paddingY={0}
        marginTop={1}
      >
        <Box>
          <Text bold color={modeColor}>
            ● {mode.toUpperCase()}
          </Text>
        </Box>

        <Box flexGrow={1} />

        {/* Version number */}
        <Box>
          <Text dimColor>v{version}</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default Header;
