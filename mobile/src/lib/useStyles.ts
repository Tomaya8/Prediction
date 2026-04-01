/**
 * Dynamic styles hook — rebuilds StyleSheet when theme changes.
 *
 * Usage:
 *   const styles = useStyles(() => StyleSheet.create({
 *     container: { backgroundColor: Colors.background },
 *   }));
 *
 * The factory function re-runs whenever the theme changes,
 * picking up the latest Colors values.
 */

import { useMemo } from 'react';
import { useTheme } from '../app/_layout';

export function useStyles<T>(factory: () => T): T {
  const { themeKey } = useTheme();
  return useMemo(factory, [themeKey]);
}
