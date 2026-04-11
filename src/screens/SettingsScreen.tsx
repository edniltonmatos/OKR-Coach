import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { SECURE_OPENAI_BASE, SECURE_OPENAI_KEY } from '../config/secrets';
import { colors } from '../theme';

export function SettingsScreen() {
  const navigation = useNavigation();
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const k = await SecureStore.getItemAsync(SECURE_OPENAI_KEY);
      const b = await SecureStore.getItemAsync(SECURE_OPENAI_BASE);
      if (k) setApiKey(k);
      if (b) setBaseUrl(b);
    })();
  }, []);

  const save = async () => {
    if (apiKey.trim()) {
      await SecureStore.setItemAsync(SECURE_OPENAI_KEY, apiKey.trim());
    } else {
      await SecureStore.deleteItemAsync(SECURE_OPENAI_KEY);
    }
    if (baseUrl.trim()) {
      await SecureStore.setItemAsync(SECURE_OPENAI_BASE, baseUrl.trim().replace(/\/$/, ''));
    } else {
      await SecureStore.deleteItemAsync(SECURE_OPENAI_BASE);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppHeader title="AJUSTES" onPressMenu={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.warn}>
          Repositório público: nunca commite chaves. Guarde só no cofre do telefone via SecureStore.
        </Text>
        <Text style={styles.label}>OpenAI API key (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="sk-..."
          placeholderTextColor="#555"
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.label}>Base URL (opcional, padrão api.openai.com)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://api.openai.com/v1"
          placeholderTextColor="#555"
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
        />
        <PrimaryButton label={saved ? 'SALVO' : 'SALVAR'} onPress={save} disabled={saved} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, gap: 12 },
  warn: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    color: colors.onSurfaceMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  label: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    color: colors.white,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: 12,
  },
});
