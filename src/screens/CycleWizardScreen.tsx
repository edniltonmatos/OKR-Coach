import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader } from '../components/AppHeader';
import { AssistantMarkdown } from '../components/AssistantMarkdown';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAppData } from '../context/DataContext';
import { createCycleWithKeyResults, getLatestCycle } from '../db/repositories';
import { parseWizardPayload, sendWizardTurn, type WizardCyclePayload } from '../lib/ai';
import { getUserFacingApiErrorMessage } from '../lib/apiErrors';
import { getOpenAiCredentials } from '../lib/openAiCredentials';
import { createId } from '../lib/id';
import { colors } from '../theme';

const HEADER_CONTENT_HEIGHT = 56;

type Row = { id: string; role: 'user' | 'assistant'; content: string };

export function CycleWizardScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { refresh } = useAppData();
  const [messages, setMessages] = useState<Row[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Olá! Sou o assistente de ciclo. Vamos definir o teu objetivo e três resultados-chave, datas e revisão semanal. Quando estiver tudo claro, devolvo um resumo em JSON para guardares. Começa por descrever o **objetivo principal** que queres para este ciclo.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const lastPayload = useMemo(() => {
    const lastAsst = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAsst) return null;
    return parseWizardPayload(lastAsst.content);
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const { apiKey, baseUrl, model } = await getOpenAiCredentials();
    if (!apiKey) {
      Alert.alert('Chave da API', 'Configure a IA em Configuração.', [
        { text: 'OK', style: 'cancel' },
        {
          text: 'Abrir configuração',
          onPress: () =>
            (navigation as { navigate: (n: string) => void }).navigate('CycleSetup'),
        },
      ]);
      return;
    }
    const userRow: Row = {
      id: createId('wiz'),
      role: 'user',
      content: input.trim(),
    };
    const next = [...messages, userRow];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const history = next.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const reply = await sendWizardTurn({
        apiKey,
        baseUrl,
        model,
        messages: history,
      });
      setMessages((m) => [
        ...m,
        { id: createId('wiz'), role: 'assistant', content: reply },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: createId('wiz'),
          role: 'assistant',
          content: getUserFacingApiErrorMessage(e),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const applyPayload = useCallback(
    async (payload: WizardCyclePayload) => {
      const krs = payload.keyResults.slice(0, 3).map((kr, i) => ({
        sortOrder: i + 1,
        label: kr.label?.trim() || `KR ${i + 1}`,
        initialValue: Number.isFinite(kr.initialValue) ? kr.initialValue : 0,
        targetValue: Number.isFinite(kr.targetValue) ? kr.targetValue : 100,
        currentValue: Number.isFinite(kr.initialValue) ? kr.initialValue : 0,
      }));
      const wc = Math.min(52, Math.max(1, payload.weekCount || 12));
      let rw = payload.reviewWeekday;
      if (!Number.isFinite(rw) || rw < 0 || rw > 6) rw = 4;
      const cycleId = createId('cycle');
      await createCycleWithKeyResults(
        {
          id: cycleId,
          objectiveTitle: payload.objectiveTitle.trim(),
          startDate: payload.startDate,
          weekCount: wc,
          reviewWeekday: rw,
        },
        krs
      );
      await refresh();
      navigation.goBack();
    },
    [navigation, refresh]
  );

  const onSaveCycle = async () => {
    if (!lastPayload) {
      Alert.alert('Assistente', 'Ainda não há um JSON final. Continua a conversa com a IA.');
      return;
    }
    const existing = await getLatestCycle();
    if (existing) {
      Alert.alert(
        'Substituir ciclo',
        'Já existe um ciclo. Guardar apaga o atual e cria um novo.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Substituir', onPress: () => void applyPayload(lastPayload) },
        ]
      );
      return;
    }
    await applyPayload(lastPayload);
  };

  const keyboardOffset = insets.top + HEADER_CONTENT_HEIGHT;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
    >
      <AppHeader
        title="CRIAR COM IA"
        onPressMenu={() => navigation.goBack()}
      />
      <View style={styles.ctx}>
        <Text style={styles.ctxTxt}>
          Responde às perguntas. No fim, a IA envia um bloco JSON_START … JSON_END para
          confirmares.
        </Text>
      </View>
      <FlatList
        style={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'assistant' ? styles.bubbleAi : styles.bubbleUser,
            ]}
          >
            {item.role === 'assistant' ? (
              <AssistantMarkdown content={item.content} />
            ) : (
              <Text style={styles.bubbleText}>{item.content}</Text>
            )}
          </View>
        )}
      />
      {lastPayload && (
        <View style={styles.readyBanner}>
          <Text style={styles.readyTxt}>JSON do ciclo recebido — podes guardar.</Text>
          <PrimaryButton label="GUARDAR CICLO" onPress={onSaveCycle} />
        </View>
      )}
      <View style={[styles.inputRow, { paddingBottom: 12 + insets.bottom }]}>
        <TextInput
          style={styles.input}
          placeholder="A tua resposta…"
          placeholderTextColor="#555"
          value={input}
          onChangeText={setInput}
          multiline
          editable={!loading}
        />
        <Pressable
          onPress={send}
          disabled={loading || !input.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            (loading || !input.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <MaterialCommunityIcons name="send" size={22} color={colors.onAccent} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  ctx: { paddingHorizontal: 24, paddingBottom: 8 },
  ctxTxt: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    color: colors.onSurfaceMuted,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 24, paddingBottom: 12, gap: 12 },
  bubble: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleAi: { backgroundColor: '#141414' },
  bubbleUser: { backgroundColor: '#1a1a1a', marginLeft: 16 },
  bubbleText: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 15,
    color: colors.onSurface,
  },
  readyBanner: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.accent,
    gap: 8,
    backgroundColor: colors.surface,
  },
  readyTxt: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 13,
    color: colors.accent,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.white,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  sendBtn: {
    backgroundColor: colors.accent,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
