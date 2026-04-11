import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

export function PrimaryButton({ label, onPress, disabled, loading, icon = 'arrow-right' }: Props) {
  const busy = loading || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.btn,
        busy && styles.btnDisabled,
        pressed && !busy && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <View style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <MaterialCommunityIcons name={icon} size={22} color={colors.onAccent} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  btnPressed: { backgroundColor: colors.accentPressed },
  btnDisabled: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 16,
    letterSpacing: 2,
    color: colors.onAccent,
    textTransform: 'uppercase',
  },
});
