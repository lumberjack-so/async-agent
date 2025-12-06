/**
 * Type declarations for ink-progress-bar
 */
declare module 'ink-progress-bar' {
  import { FC } from 'react';

  interface ProgressBarProps {
    percent: number;
    columns?: number;
    character?: string;
    color?: string;
    left?: string;
    right?: string;
  }

  const ProgressBar: FC<ProgressBarProps>;
  export default ProgressBar;
}
