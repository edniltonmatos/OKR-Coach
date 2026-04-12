import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader } from '../components/AppHeader';
import { AssistantMarkdown } from '../components/AssistantMarkdown';
import { useAppData } from '../context/DataContext';
import { getChatMessages, insertChatMessage } from '../db/repositories';
import { sendChatCompletion } from '../lib/ai';
import { getOpenAiCredentials } from '../lib/openAiCredentials';
import { getUserFacingApiErrorMessage } from '../lib/apiErrors';
import { createId } from '../lib/id';
import { getCurrentWeekNumber, isReviewDay } from '../lib/dates';
import type { ChatMessage } from '../types';
import { colors } from '../theme';

/** Altura aproximada do AppHeader abaixo da status bar (padding 16+16 + linha ~40). */
const HEADER_CONTENT_HEIGHT = 56;

export function AnalysisScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { cycle, keyResults, refresh } = useAppData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  const load = useCallback(async () => {
    if (!cycle) {
      setMessages([]);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    try {
      const rows = await getChatMessages(cycle.id);
      setMessages(rows);
    } finally {
      setLoadingList(false);
    }
  }, [cycle]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const week = cycle ? getCurrentWeekNumber(cycle) : 1;
  const sortedKr = [...keyResults].sort((a, b) => a.sortOrder - b.sortOrder);
  const metricsLine = sortedKr
    .map((kr, i) => `KR ${i + 1}: ${kr.currentValue}/${kr.targetValue}`)
    .join(' · ');

  const send = async () => {
    if (!cycle || !input.trim()) return;
    const { apiKey, baseUrl, model: modelName } = await getOpenAiCredentials();
    if (!apiKey) {
      Alert.alert(
        'Chave da API',
        'Defina EXPO_PUBLIC_OPENAI_API_KEY no ficheiro .env (e opcionalmente EXPO_PUBLIC_OPENAI_BASE_URL e EXPO_PUBLIC_OPENAI_MODEL). Reinicie o Metro e gere de novo o build do app para a chave entrar no pacote.'
      );
      return;
    }
    const userMsg: ChatMessage = {
      id: createId('msg'),
      cycleId: cycle.id,
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };
    await insertChatMessage(userMsg);
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const history = [...messages, userMsg].map((x) => ({
        role: x.role as 'user' | 'assistant',
        content: x.content,
      }));
      const reply = await sendChatCompletion({
        apiKey,
        baseUrl,
        model: modelName,
        cycle,
        keyResults: sortedKr,
        messages: history,
      });
      const asst: ChatMessage = {
        id: createId('msg'),
        cycleId: cycle.id,
        role: 'assistant',
        content: reply,
        createdAt: new Date().toISOString(),
      };
      await insertChatMessage(asst);
      setMessages((m) => [...m, asst]);
      await refresh();
    } catch (e) {
      const err: ChatMessage = {
        id: createId('msg'),
        cycleId: cycle.id,
        role: 'assistant',
        content: getUserFacingApiErrorMessage(e),
        createdAt: new Date().toISOString(),
      };
      await insertChatMessage(err);
      setMessages((m) => [...m, err]);
    } finally {
      setLoading(false);
    }
  };

  const goWeekly = () => {
    (navigation as { navigate: (n: string) => void }).navigate('Weekly');
  };

  if (!cycle) {
    return (
      <View style={styles.root}>
        <AppHeader
          title="ANÁLISE"
          onPressMenu={() => (navigation as { navigate: (n: string) => void }).navigate('CycleSetup')}
        />
        <View style={styles.center}>
          <Text style={styles.muted}>Configure um ciclo primeiro.</Text>
        </View>
      </View>
    );
  }

  const showReviewBanner = isReviewDay(cycle);
  const keyboardOffset = insets.top + HEADER_CONTENT_HEIGHT;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
    >
      <AppHeader
        title="ANÁLISE"
        onPressMenu={() => (navigation as { navigate: (n: string) => void }).navigate('CycleSetup')}
      />
      <View style={styles.ctx}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowLine} />
          <Text style={styles.eyebrow}>CONTEXTO ATUAL</Text>
        </View>
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillTxt}>SEMANAL</Text>
          </View>
        </View>
        <Text style={styles.metrics}>
          Week {week} · {metricsLine}
        </Text>
      </View>
      {showReviewBanner && (
        <Pressable style={styles.banner} onPress={goWeekly}>
          <Text style={styles.bannerTitle}>HOJE É DIA DE ANÁLISE SEMANAL.</Text>
          <View style={styles.bannerRow}>
            <Text style={styles.bannerCta}>INICIAR</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color={colors.accent} />
          </View>
        </Pressable>
      )}
      {loadingList ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          style={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'assistant' ? styles.bubbleAi : styles.bubbleUser,
              ]}
            >
              <View style={item.role === 'assistant' ? styles.aiBar : undefined} />
              <View style={{ flex: 1 }}>
                {item.role === 'assistant' ? (
                  <AssistantMarkdown content={item.content} />
                ) : (
                  <Text style={styles.bubbleText}>{item.content}</Text>
                )}
                <Text style={styles.meta}>
                  {item.role === 'assistant' ? 'STRATEGY AI' : 'VOCÊ'} ·{' '}
                  {new Date(item.createdAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.muted}>
              Nenhuma mensagem ainda. Peça um plano para os próximos 48h ou comente seus KRs.
            </Text>
          }
        />
      )}
      <View style={[styles.inputRow, { paddingBottom: 16 + insets.bottom }]}>
        <TextInput
          style={styles.input}
          placeholder="Digite sua resposta técnica"
          placeholderTextColor="#555"
          value={input}
          onChangeText={setInput}
          multiline
          editable={!loading}
        />
        <Pressable
          accessibilityRole="button"
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
            <View style={styles.sendInner}>
              <Text style={styles.sendLabel}>SEND</Text>
              <MaterialCommunityIcons name="send" size={18} color={colors.onAccent} />
            </View>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ctx: { paddingHorizontal: 24, paddingBottom: 12 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  eyebrowLine: { width: 24, height: 2, backgroundColor: colors.accent },
  eyebrow: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 3,
    color: colors.accent,
  },
  pillRow: { flexDirection: 'row', marginBottom: 8 },
  pill: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  metrics: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 13,
    color: colors.onSurface,
  },
  banner: {
    marginHorizontal: 24,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  bannerTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 12,
    color: colors.accent,
    marginBottom: 8,
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerCta: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14,
    color: colors.accent,
    letterSpacing: 2,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 24, paddingBottom: 16, gap: 12 },
  bubble: {
    flexDirection: 'row',
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  bubbleAi: { backgroundColor: '#141414' },
  bubbleUser: { backgroundColor: '#1a1a1a', marginLeft: 24 },
  aiBar: {
    width: 3,
    backgroundColor: colors.accent,
    borderRadius: 0,
  },
  bubbleText: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurface,
  },
  meta: {
    marginTop: 8,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    color: colors.onSurfaceMuted,
  },
  muted: {
    fontFamily: 'SpaceGrotesk_400Regular',
    color: colors.onSurfaceMuted,
    paddingHorizontal: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
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
    paddingVertical: 16,
    paddingHorizontal: 18,
    justifyContent: 'center',
    minWidth: 100,
    alignItems: 'center',
  },
  sendInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sendLabel: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 14,
    letterSpacing: 1,
    color: colors.onAccent,
  },
});
