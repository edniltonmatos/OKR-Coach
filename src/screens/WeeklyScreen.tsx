import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader } from '../components/AppHeader';
import { useAppData } from '../context/DataContext';
import {
  getChatMessagesInWeekRange,
  getWeekDigestsForCycle,
  getWeekEntriesForCycle,
  getWeekEntry,
  upsertWeekDigest,
  upsertWeekEntry,
} from '../db/repositories';
import { createId } from '../lib/id';
import { getCurrentWeekNumber, getWeekBounds } from '../lib/dates';
import { fetchWeeklyDigest } from '../lib/ai';
import { getOpenAiCredentials } from '../lib/openAiCredentials';
import type { KeyResult, WeekDigest, WeekDigestMood, WeekEntry } from '../types';
import { colors } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function moodGlyph(m: WeekDigestMood): string {
  if (m === 'good') return '+';
  if (m === 'bad') return '−';
  return '~';
}

function moodLabel(m: WeekDigestMood): string {
  if (m === 'good') return 'bom';
  if (m === 'bad') return 'ruim';
  return 'misto';
}

function localWeekMood(
  sortedKr: KeyResult[],
  weekNumber: number,
  weekCount: number,
  entry: WeekEntry | null | undefined
): WeekDigestMood {
  if (!entry || sortedKr.length === 0) return 'mixed';
  const progress = weekNumber / weekCount;
  let ok = 0;
  let bad = 0;
  for (let i = 0; i < sortedKr.length; i++) {
    const kr = sortedKr[i];
    const val = i === 0 ? entry.kr1Value : i === 1 ? entry.kr2Value : entry.kr3Value;
    if (val == null) return 'mixed';
    const span = kr.targetValue - kr.initialValue;
    if (Math.abs(span) < 1e-9) {
      ok++;
      continue;
    }
    const expected = kr.initialValue + span * progress;
    if (val + 1e-6 >= expected * 0.92) ok++;
    else bad++;
  }
  const notes = entry.notes?.toLowerCase() ?? '';
  const neg =
    /(ruim|péssim|falha|atras|bloqueio|problema|difícil|pior)/i.test(notes) &&
    !/(bom|ótimo|vitória|avanço)/i.test(notes);
  if (neg && bad > 0) return 'bad';
  if (bad === 0 && !neg) return 'good';
  if (ok === 0 && bad > 0) return 'bad';
  return 'mixed';
}

function effectiveMood(
  digest: WeekDigest | undefined,
  sortedKr: KeyResult[],
  wn: number,
  weekCount: number,
  entry: WeekEntry | null | undefined
): WeekDigestMood {
  return digest?.mood ?? localWeekMood(sortedKr, wn, weekCount, entry);
}

export function WeeklyScreen() {
  const navigation = useNavigation();
  const { cycle, keyResults, refresh } = useAppData();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [kr1, setKr1] = useState('');
  const [kr2, setKr2] = useState('');
  const [kr3, setKr3] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [digestByWeek, setDigestByWeek] = useState<Record<number, WeekDigest>>({});
  const [entriesByWeek, setEntriesByWeek] = useState<Record<number, WeekEntry | null>>({});
  const [digestLoading, setDigestLoading] = useState(false);
  const [modalWeek, setModalWeek] = useState<number | null>(null);
  const [modalEntry, setModalEntry] = useState<WeekEntry | null>(null);

  const sortedKr = useMemo(
    () => [...keyResults].sort((a, b) => a.sortOrder - b.sortOrder),
    [keyResults]
  );

  const currentWeek = cycle ? getCurrentWeekNumber(cycle) : 1;
  const weekCount = cycle?.weekCount ?? 12;

  const reloadSideData = useCallback(async () => {
    if (!cycle) return;
    const [digests, entries] = await Promise.all([
      getWeekDigestsForCycle(cycle.id),
      getWeekEntriesForCycle(cycle.id),
    ]);
    const dMap: Record<number, WeekDigest> = {};
    for (const d of digests) dMap[d.weekNumber] = d;
    setDigestByWeek(dMap);
    const eMap: Record<number, WeekEntry | null> = {};
    for (const e of entries) eMap[e.weekNumber] = e;
    setEntriesByWeek(eMap);
  }, [cycle]);

  useFocusEffect(
    useCallback(() => {
      reloadSideData();
    }, [reloadSideData])
  );

  const loadWeek = useCallback(
    async (wn: number) => {
      if (!cycle) return;
      const e = await getWeekEntry(cycle.id, wn);
      const krs = sortedKr;
      setKr1(
        e?.kr1Value != null ? String(e.kr1Value) : String(krs[0]?.currentValue ?? '')
      );
      setKr2(
        e?.kr2Value != null ? String(e.kr2Value) : String(krs[1]?.currentValue ?? '')
      );
      setKr3(
        e?.kr3Value != null ? String(e.kr3Value) : String(krs[2]?.currentValue ?? '')
      );
      setNotes(e?.notes ?? '');
    },
    [cycle, sortedKr]
  );

  useFocusEffect(
    useCallback(() => {
      if (!cycle) return;
      setExpanded((prev) => {
        const wn = prev ?? currentWeek;
        loadWeek(wn);
        return wn;
      });
    }, [cycle, currentWeek, loadWeek])
  );

  const toggle = (wn: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expanded === wn) {
      setExpanded(null);
    } else {
      setExpanded(wn);
      loadWeek(wn);
    }
  };

  const saveWeek = async (wn: number) => {
    if (!cycle) return;
    setSaving(true);
    try {
      const id = `${cycle.id}-w${wn}`;
      const v1 = parseFloat(kr1.replace(',', '.'));
      const v2 = parseFloat(kr2.replace(',', '.'));
      const v3 = parseFloat(kr3.replace(',', '.'));
      await upsertWeekEntry({
        id,
        cycleId: cycle.id,
        weekNumber: wn,
        kr1Value: Number.isFinite(v1) ? v1 : null,
        kr2Value: Number.isFinite(v2) ? v2 : null,
        kr3Value: Number.isFinite(v3) ? v3 : null,
        notes: notes.trim() || null,
        completed: wn < currentWeek,
      });
      await refresh();
      await reloadSideData();
    } finally {
      setSaving(false);
    }
  };

  const openPastWeekModal = async (wn: number) => {
    if (!cycle) return;
    const e = await getWeekEntry(cycle.id, wn);
    setModalEntry(e);
    setModalWeek(wn);
  };

  const editFromModal = () => {
    if (modalWeek == null) return;
    const wn = modalWeek;
    setModalWeek(null);
    setExpanded(wn);
    loadWeek(wn);
  };

  const runDigestForWeek = async (wn: number) => {
    if (!cycle) return;
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
    setDigestLoading(true);
    try {
      const { start, endExclusive } = getWeekBounds(cycle, wn);
      const msgs = await getChatMessagesInWeekRange(
        cycle.id,
        start.toISOString(),
        endExclusive.toISOString()
      );
      const transcript = msgs.map((m) => `${m.role === 'user' ? 'Você' : 'IA'}: ${m.content}`).join('\n\n');
      const entry = await getWeekEntry(cycle.id, wn);
      const krSnap = sortedKr
        .map((kr, idx) => {
          const v =
            idx === 0
              ? entry?.kr1Value
              : idx === 1
                ? entry?.kr2Value
                : entry?.kr3Value;
          return `${kr.label}: ${v != null ? v : '—'}`;
        })
        .join(' | ');
      const { summary, mood } = await fetchWeeklyDigest({
        apiKey,
        baseUrl,
        model,
        cycle,
        keyResults: sortedKr,
        weekNumber: wn,
        weekNotes: entry?.notes ?? null,
        krSnapshotLine: krSnap,
        chatTranscript: transcript,
      });
      await upsertWeekDigest({
        id: `${cycle.id}-dig${wn}`,
        cycleId: cycle.id,
        weekNumber: wn,
        summary,
        mood,
      });
      await reloadSideData();
    } catch (e) {
      Alert.alert('Resumo', e instanceof Error ? e.message : 'Falha ao gerar resumo.');
    } finally {
      setDigestLoading(false);
    }
  };

  const onTrack = useMemo(() => {
    if (!cycle || sortedKr.length === 0) return true;
    const progress = currentWeek / weekCount;
    return sortedKr.every((kr) => {
      const span = kr.targetValue - kr.initialValue;
      if (span === 0) return true;
      const expected = kr.initialValue + span * progress;
      return kr.currentValue + 1e-6 >= expected * 0.92;
    });
  }, [cycle, sortedKr, currentWeek, weekCount]);

  const currentDigest = digestByWeek[currentWeek];
  const modalDigest = modalWeek != null ? digestByWeek[modalWeek] : undefined;

  if (!cycle) {
    return (
      <View style={styles.root}>
        <AppHeader
          title="REGISTRO"
          onPressMenu={() => (navigation as { navigate: (n: string) => void }).navigate('CycleSetup')}
        />
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Crie um ciclo na configuração primeiro.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader
        title="REGISTRO"
        onPressMenu={() => (navigation as { navigate: (n: string) => void }).navigate('CycleSetup')}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowLine} />
          <Text style={styles.eyebrow}>REGISTRO SEMANAL</Text>
        </View>

        <View style={styles.digestCard}>
          <Text style={styles.digestEyebrow}>RESUMO DA SEMANA (IA)</Text>
          <Text style={styles.digestMeta}>
            Semana {String(currentWeek).padStart(2, '0')} ·{' '}
            {currentDigest
              ? `Atualizado · ${moodLabel(currentDigest.mood)}`
              : 'Ainda sem resumo gerado'}
          </Text>
          {digestLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
          ) : (
            <Text style={styles.digestBody}>
              {currentDigest?.summary ??
                'Gere um resumo que condensa o chat de análise e o registro desta semana.'}
            </Text>
          )}
          <Pressable
            style={[styles.digestBtn, digestLoading && { opacity: 0.7 }]}
            onPress={() => runDigestForWeek(currentWeek)}
            disabled={digestLoading}
          >
            <Text style={styles.digestBtnTxt}>
              {currentDigest ? 'ATUALIZAR RESUMO' : 'GERAR RESUMO'}
            </Text>
          </Pressable>
        </View>

        {Array.from({ length: weekCount }, (_, i) => i + 1).map((wn) => {
          const locked = wn > currentWeek;
          const past = wn < currentWeek;
          const active = wn === currentWeek;
          const isOpen = expanded === wn;
          const entry = entriesByWeek[wn] ?? null;
          const digest = digestByWeek[wn];
          const em = effectiveMood(digest, sortedKr, wn, weekCount, entry);

          if (locked) {
            return (
              <View key={wn} style={styles.weekLocked}>
                <Text style={styles.weekLabelMuted}>S{String(wn).padStart(2, '0')}</Text>
                <MaterialCommunityIcons name="lock-outline" size={20} color={colors.onSurfaceMuted} />
              </View>
            );
          }

          if (past && !isOpen) {
            return (
              <Pressable
                key={wn}
                onPress={() => openPastWeekModal(wn)}
                style={styles.weekDone}
              >
                <View>
                  <Text style={styles.weekLabelMuted}>S{String(wn).padStart(2, '0')}</Text>
                  <Text style={styles.weekMicro}>
                    {digest?.summary
                      ? digest.summary.slice(0, 72) + (digest.summary.length > 72 ? '…' : '')
                      : entry?.notes
                        ? entry.notes.slice(0, 72) + (entry.notes.length > 72 ? '…' : '')
                        : 'Toque para ver o registo'}
                  </Text>
                </View>
                <View style={styles.doneRow}>
                  <View style={[styles.moodPill, moodPillStyle(em)]}>
                    <Text style={styles.moodPillTxt}>{moodGlyph(em)}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.onSurfaceMuted} />
                </View>
              </Pressable>
            );
          }

          return (
            <View key={wn}>
              <Pressable
                onPress={() => toggle(wn)}
                style={[styles.weekActiveHead, isOpen && styles.weekActiveOpen]}
              >
                <View>
                  <Text style={styles.weekBig}>S{String(wn).padStart(2, '0')}</Text>
                  {active && <Text style={styles.sub}>SEMANA ATUAL</Text>}
                  {past && isOpen && <Text style={styles.subMuted}>EDITAR REGISTRO</Text>}
                </View>
                {active && (
                  <View style={[styles.badge, onTrack ? styles.badgeOk : styles.badgeWarn]}>
                    <Text style={styles.badgeTxt}>{onTrack ? 'ON TRACK' : 'ATENÇÃO'}</Text>
                  </View>
                )}
              </Pressable>
              {isOpen && (
                <View style={styles.form}>
                  {sortedKr.map((kr, idx) => (
                    <View key={kr.id} style={styles.field}>
                      <Text style={styles.fieldLabel}>{kr.label.toUpperCase()}</Text>
                      <TextInput
                        style={styles.fieldInput}
                        keyboardType="decimal-pad"
                        value={idx === 0 ? kr1 : idx === 1 ? kr2 : kr3}
                        onChangeText={idx === 0 ? setKr1 : idx === 1 ? setKr2 : setKr3}
                      />
                      <Text style={styles.meta}>META: {formatNum(kr.targetValue)}</Text>
                    </View>
                  ))}
                  <Text style={styles.fieldLabel}>ANÁLISE E OBSERVAÇÕES</Text>
                  <TextInput
                    style={styles.notes}
                    multiline
                    placeholder="Descreva os impedimentos ou vitórias da semana..."
                    placeholderTextColor="#555"
                    value={notes}
                    onChangeText={setNotes}
                    textAlignVertical="top"
                  />
                  <Pressable
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={() => saveWeek(wn)}
                    disabled={saving}
                  >
                    <Text style={styles.saveTxt}>SALVAR</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal
        visible={modalWeek != null}
        animationType="slide"
        transparent
        onRequestClose={() => setModalWeek(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalWeek(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              S{modalWeek != null ? String(modalWeek).padStart(2, '0') : ''} ·{' '}
              {modalDigest
                ? moodLabel(modalDigest.mood)
                : modalWeek != null
                  ? moodLabel(
                      effectiveMood(
                        undefined,
                        sortedKr,
                        modalWeek,
                        weekCount,
                        modalEntry
                      )
                    )
                  : ''}
            </Text>
            {sortedKr.map((kr, idx) => {
              const v =
                idx === 0
                  ? modalEntry?.kr1Value
                  : idx === 1
                    ? modalEntry?.kr2Value
                    : modalEntry?.kr3Value;
              return (
                <Text key={kr.id} style={styles.modalLine}>
                  {kr.label}: {v != null ? formatNum(v) : '—'}
                </Text>
              );
            })}
            <Text style={styles.modalSection}>Notas</Text>
            <Text style={styles.modalNotes}>
              {modalEntry?.notes?.trim() || 'Sem notas.'}
            </Text>
            {modalDigest?.summary ? (
              <>
                <Text style={styles.modalSection}>Resumo IA</Text>
                <Text style={styles.modalNotes}>{modalDigest.summary}</Text>
              </>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhost} onPress={() => setModalWeek(null)}>
                <Text style={styles.modalGhostTxt}>FECHAR</Text>
              </Pressable>
              <Pressable style={styles.modalAccent} onPress={editFromModal}>
                <Text style={styles.modalAccentTxt}>EDITAR</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function moodPillStyle(m: WeekDigestMood) {
  if (m === 'good') return { backgroundColor: '#1a3d2e' };
  if (m === 'bad') return { backgroundColor: '#4a1e1e' };
  return { backgroundColor: '#2a2a1e' };
}

function formatNum(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  eyebrowLine: { width: 24, height: 2, backgroundColor: colors.accent },
  eyebrow: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 3,
    color: colors.accent,
  },
  digestCard: {
    borderWidth: 1,
    borderColor: colors.accent,
    padding: 16,
    marginBottom: 20,
    backgroundColor: colors.surface,
    gap: 8,
  },
  digestEyebrow: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  digestMeta: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12,
    color: colors.onSurfaceMuted,
  },
  digestBody: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: colors.onSurface,
  },
  digestBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 8,
  },
  digestBtnTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    letterSpacing: 2,
    color: colors.onAccent,
  },
  weekLocked: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  weekDone: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    backgroundColor: colors.surface,
    gap: 12,
  },
  weekMicro: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12,
    color: colors.onSurfaceMuted,
    marginTop: 6,
    maxWidth: 220,
  },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moodPill: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodPillTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    color: colors.white,
  },
  weekLabelMuted: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 16,
    color: colors.onSurfaceMuted,
  },
  weekActiveHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 0,
    backgroundColor: colors.surface,
  },
  weekActiveOpen: { borderColor: colors.accent },
  weekBig: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 28,
    color: colors.accent,
  },
  sub: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
    marginTop: 4,
  },
  subMuted: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onSurfaceMuted,
    marginTop: 4,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  badgeOk: { backgroundColor: '#1a3d2e' },
  badgeWarn: { backgroundColor: '#3d2e1a' },
  badgeTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    color: colors.white,
  },
  form: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.accent,
    padding: 16,
    backgroundColor: colors.background,
    marginBottom: 16,
    gap: 12,
  },
  field: { marginBottom: 8 },
  fieldLabel: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 11,
    color: colors.onSurfaceMuted,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.white,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  meta: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    color: colors.onSurfaceMuted,
    marginTop: 4,
  },
  notes: {
    minHeight: 100,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.white,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  saveBtn: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  saveTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.onAccent,
    letterSpacing: 2,
  },
  emptyBox: { flex: 1, padding: 24, justifyContent: 'center' },
  emptyText: { fontFamily: 'SpaceGrotesk_400Regular', color: colors.onSurfaceMuted },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 10,
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 18,
    color: colors.accent,
    marginBottom: 8,
  },
  modalLine: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    color: colors.onSurface,
  },
  modalSection: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onSurfaceMuted,
    marginTop: 8,
  },
  modalNotes: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modalGhostTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    color: colors.onSurfaceMuted,
    letterSpacing: 1,
  },
  modalAccent: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  modalAccentTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    color: colors.onAccent,
    letterSpacing: 2,
  },
});
