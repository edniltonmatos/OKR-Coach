import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { KeyResult } from '../types';

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function KrProgressBar({ kr }: { kr: KeyResult }) {
  const span = kr.targetValue - kr.initialValue;
  const pct =
    span === 0
      ? 0
      : clamp01((kr.currentValue - kr.initialValue) / span) * 100;
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Text style={styles.krLabel}>
          KR {String(kr.sortOrder).padStart(2, '0')} · {kr.label.toUpperCase()}
        </Text>
        <Text style={styles.pct}>{Math.round(pct)}%</Text>
      </View>
      <Text style={styles.bigValue}>{formatNumber(kr.currentValue)}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.target}>TARGET: {formatNumber(kr.targetValue)}</Text>
    </View>
  );
}

function formatNumber(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toFixed(1).replace(/\.0$/, '');
}

const styles = StyleSheet.create({
  block: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  krLabel: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    letterSpacing: 1,
    color: colors.accent,
  },
  pct: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    color: colors.accent,
  },
  bigValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 40,
    color: colors.white,
  },
  track: {
    height: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: 2,
    backgroundColor: colors.accent,
  },
  target: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 10,
    letterSpacing: 1,
    color: colors.onSurfaceMuted,
    textTransform: 'uppercase',
  },
});
