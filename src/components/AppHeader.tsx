import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

type Props = {
  title: string;
  onPressMenu?: () => void;
  onPressProfile?: () => void;
};

export function AppHeader({ title, onPressMenu, onPressProfile }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        onPress={onPressMenu}
        style={({ pressed }) => [styles.side, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="view-grid-outline" size={24} color={colors.accent} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPressProfile}
        style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
      >
        <MaterialCommunityIcons name="account-outline" size={20} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  side: { padding: 4 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    letterSpacing: -0.5,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});
