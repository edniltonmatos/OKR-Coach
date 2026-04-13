import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { KrProgressBar } from '../components/KrProgressBar';
import { ScreenGlow } from '../components/ScreenGlow';
import { useAppData } from '../context/DataContext';
import { colors } from '../theme';
import { getCurrentWeekNumber } from '../lib/dates';
import { ObjectiveTitle } from '../lib/objective';
import { buildLocalStatusInsight } from '../lib/insights';
import { fetchStatusInsight } from '../lib/ai';
import { getOpenAiCredentials } from '../lib/openAiCredentials';

export function HomeScreen() {
  const { cycle, keyResults, loading, refresh } = useAppData();
  const navigation = useNavigation();
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [showApiHint, setShowApiHint] = useState(false);

  const weekInfo = useMemo(() => {
    if (!cycle) return null;
    const w = getCurrentWeekNumber(cycle);
    return { current: w, total: cycle.weekCount };
  }, [cycle]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { apiKey } = await getOpenAiCredentials();
        if (!cancelled) setShowApiHint(!apiKey);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cycle || keyResults.length === 0) {
          setInsight(null);
          return;
        }
        const local = buildLocalStatusInsight(
          keyResults,
          weekInfo?.current ?? 1,
          cycle.weekCount
        );
        const { apiKey, baseUrl, model: modelName } = await getOpenAiCredentials();
        if (!apiKey) {
          if (!cancelled) setInsight(local);
          return;
        }
        setInsightLoading(true);
        try {
          const text = await fetchStatusInsight({
            apiKey,
            baseUrl,
            model: modelName,
            cycle,
            keyResults,
          });
          if (!cancelled) setInsight(text);
        } catch {
          if (!cancelled) setInsight(local);
        } finally {
          if (!cancelled) setInsightLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [cycle, keyResults, weekInfo?.current])
  );

  const openSetup = () => (navigation as { navigate: (n: string) => void }).navigate('CycleSetup');

  if (loading && !cycle) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!cycle) {
    return (
      <View style={styles.root}>
        <AppHeader title="STRATEGY" onPressMenu={openSetup} />
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nenhum ciclo ativo</Text>
          <Text style={styles.emptyBody}>Configure seu objetivo e KRs para começar.</Text>
          <PrimaryButton label="CONFIGURAR CICLO" onPress={() => openSetup()} />
        </View>
      </View>
    );
  }

  const sortedKr = [...keyResults].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <View style={styles.root}>
      <ScreenGlow />
      <AppHeader title="STRATEGY" onPressMenu={openSetup} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowLine} />
          <Text style={styles.eyebrow}>
            CICLO 01 · SEMANA {weekInfo?.current ?? 1} DE {weekInfo?.total ?? 12}
          </Text>
        </View>
        <ObjectiveTitle text={cycle.objectiveTitle} />
        <View style={styles.spacer} />
        {sortedKr.map((kr) => (
          <KrProgressBar key={kr.id} kr={kr} />
        ))}
        <View style={styles.statusCard}>
          <Text style={styles.statusEyebrow}>STATUS ATUAL</Text>
          {showApiHint && (
            <Text style={styles.apiHint}>
              Sem chave da API: o texto abaixo é local. Configure em Configuração para usar a IA.
            </Text>
          )}
          {insightLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
          ) : (
            <Text style={styles.statusBody}>{insight ?? buildLocalStatusInsight(sortedKr, weekInfo?.current ?? 1, cycle.weekCount)}</Text>
          )}
          <PrimaryButton
            label="ANALISAR COM IA"
            onPress={() => (navigation as { navigate: (n: string) => void }).navigate('Analysis')}
            icon="arrow-right"
          />
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  eyebrowLine: { width: 24, height: 2, backgroundColor: colors.accent },
  eyebrow: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 3,
    color: colors.accent,
  },
  spacer: { height: 24 },
  statusCard: {
    marginTop: 32,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  statusEyebrow: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 11,
    letterSpacing: 2,
    color: colors.onSurfaceMuted,
    textTransform: 'uppercase',
  },
  apiHint: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceMuted,
    marginBottom: 4,
  },
  statusBody: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurface,
  },
  empty: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    color: colors.white,
  },
  emptyBody: { fontFamily: 'SpaceGrotesk_400Regular', color: colors.onSurfaceMuted, marginBottom: 8 },
});
