import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
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
import { getWeekEntry, upsertWeekEntry } from '../db/repositories';
import { createId } from '../lib/id';
import { getCurrentWeekNumber } from '../lib/dates';
import { colors } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
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

  const sortedKr = useMemo(
    () => [...keyResults].sort((a, b) => a.sortOrder - b.sortOrder),
    [keyResults]
  );

  const currentWeek = cycle ? getCurrentWeekNumber(cycle) : 1;
  const weekCount = cycle?.weekCount ?? 12;

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
      setExpanded(currentWeek);
      loadWeek(currentWeek);
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
    } finally {
      setSaving(false);
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

  if (!cycle) {
    return (
      <View style={styles.root}>
        <AppHeader
          title="REGISTRO"
          onPressMenu={() => (navigation as { navigate: (n: string) => void }).navigate('CycleSetup')}
          onPressProfile={() => (navigation as { navigate: (n: string) => void }).navigate('Settings')}
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
        onPressProfile={() => (navigation as { navigate: (n: string) => void }).navigate('Settings')}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowLine} />
          <Text style={styles.eyebrow}>REGISTRO SEMANAL</Text>
        </View>
        {Array.from({ length: weekCount }, (_, i) => i + 1).map((wn) => {
          const locked = wn > currentWeek;
          const past = wn < currentWeek;
          const active = wn === currentWeek;
          const isOpen = expanded === wn;

          if (locked) {
            return (
              <View key={wn} style={styles.weekLocked}>
                <Text style={styles.weekLabelMuted}>S{String(wn).padStart(2, '0')}</Text>
                <MaterialCommunityIcons name="lock-outline" size={20} color={colors.onSurfaceMuted} />
              </View>
            );
          }

          if (past && !active) {
            return (
              <Pressable
                key={wn}
                onPress={() => toggle(wn)}
                style={styles.weekDone}
              >
                <Text style={styles.weekLabelMuted}>S{String(wn).padStart(2, '0')}</Text>
                <View style={styles.doneRow}>
                  <Text style={styles.doneTxt}>CONCLUÍDO</Text>
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.onSurfaceMuted} />
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
                      <Text style={styles.meta}>
                        META: {formatNum(kr.targetValue)}
                      </Text>
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
    </View>
  );
}

function formatNum(n: number): string {
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  eyebrowLine: { width: 24, height: 2, backgroundColor: colors.accent },
  eyebrow: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 3,
    color: colors.accent,
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
  },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onSurfaceMuted,
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
});
