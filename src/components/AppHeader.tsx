import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

type Props = {
  title: string;
  onPressMenu?: () => void;
  onPressProfile?: () => void;
};

const avatarSource = require('../../assets/profile-avatar.jpg');

function HeaderAvatar() {
  return <Image source={avatarSource} style={styles.avatarImg} resizeMode="cover" />;
}

export function AppHeader({ title, onPressMenu, onPressProfile }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: 16 + insets.top }]}>
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
      {onPressProfile ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPressProfile}
          style={({ pressed }) => [styles.avatarWrap, pressed && styles.pressed]}
        >
          <HeaderAvatar />
        </Pressable>
      ) : (
        <View style={styles.avatarWrap}>
          <HeaderAvatar />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
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
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainerHigh,
  },
  avatarImg: { width: '100%', height: '100%' },
  pressed: { opacity: 0.75 },
});
