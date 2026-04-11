import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Soft OLED-style glow behind content */
export function ScreenGlow() {
  return <View style={styles.glow} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: '60%',
    height: '35%',
    backgroundColor: colors.accent,
    opacity: 0.045,
    borderRadius: 999,
    transform: [{ translateY: -40 }],
  },
});
