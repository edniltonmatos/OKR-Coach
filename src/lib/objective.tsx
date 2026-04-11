import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

const styles = StyleSheet.create({
  base: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1.4,
    color: colors.white,
  },
  accent: {
    color: colors.accent,
  },
});

/** Renders objective with optional **highlight** segments */
export function ObjectiveTitle({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={styles.base}>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/);
        if (m) {
          return (
            <Text key={i} style={styles.accent}>
              {m[1]}
            </Text>
          );
        }
        return (
          <Text key={i} style={styles.base}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}
