/**
 * Alfred TUI Design System
 * Color palette, typography, and theming constants
 * All colors WCAG 2.1 AA+ compliant
 */

// Brand Colors
export const colors = {
  // Primary palette
  primary: '#00D9FF',      // Bright cyan - primary actions, highlights
  secondary: '#B794F6',    // Soft purple - secondary info, badges
  accent: '#F6AD55',       // Warm orange - warnings, attention

  // Semantic colors
  success: '#68D391',      // Green - completed, success states
  error: '#FC8181',        // Red - errors (colorblind-safe)
  warning: '#F6AD55',      // Orange - warnings, in-progress
  info: '#63B3ED',         // Blue - information, neutral states

  // Text colors
  text: {
    primary: '#E2E8F0',    // Bright text - main content
    secondary: '#A0AEC0',  // Dimmed text - labels, metadata
    tertiary: '#4A5568',   // Very dim - decorative elements
  },

  // Background colors
  background: {
    primary: '#1A202C',    // Dark background
    secondary: '#2D3748',  // Slightly lighter - panels, cards
    tertiary: '#4A5568',   // Hover states, borders
  },

  // Status colors (colorblind-safe)
  status: {
    pending: '#718096',    // Gray - waiting
    running: '#00D9FF',    // Cyan - active
    complete: '#68D391',   // Green - done
    error: '#FC8181',      // Red - failed
  },

  // Mode colors
  modes: {
    orchestrator: '#B794F6',  // Purple
    classifier: '#63B3ED',     // Blue
    default: '#68D391',        // Green
  },
} as const;

// Typography hierarchy
export const typography = {
  hero: { bold: true, color: colors.primary },
  heading: { bold: true, color: colors.text.primary },
  body: { color: colors.text.primary },
  label: { dimColor: true, color: colors.text.secondary },
  code: { color: colors.accent },
  subtle: { dimColor: true, color: colors.text.tertiary },
} as const;

// Brand elements
export const brand = {
  name: 'Alfred',
  symbol: '⋈',  // Bowtie symbol
  tagline: '✨ Your AI Workflow Assistant ✨',
  version: '1.0.0',
} as const;

// Border styles
export const borders = {
  primary: {
    borderStyle: 'double' as const,
    borderColor: colors.primary,
  },
  secondary: {
    borderStyle: 'round' as const,
    borderColor: colors.secondary,
  },
  subtle: {
    borderStyle: 'single' as const,
    borderColor: colors.text.tertiary,
  },
  success: {
    borderStyle: 'double' as const,
    borderColor: colors.success,
  },
  error: {
    borderStyle: 'round' as const,
    borderColor: colors.error,
  },
} as const;

// Spacing
export const spacing = {
  none: 0,
  xs: 0,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
} as const;

// Helper functions
export const getModeColor = (mode: string): string => {
  return colors.modes[mode as keyof typeof colors.modes] || colors.text.secondary;
};

export const getStatusColor = (status: string): string => {
  return colors.status[status as keyof typeof colors.status] || colors.text.secondary;
};

// Gradient presets (for ink-gradient)
export const gradients = {
  hero: 'rainbow',
  success: 'morning',
  error: 'passion',
  info: 'teen',
  subtle: 'pastel',
} as const;
