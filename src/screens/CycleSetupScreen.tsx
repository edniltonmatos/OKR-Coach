import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenGlow } from '../components/ScreenGlow';
import { useAppData } from '../context/DataContext';
import { createCycleWithKeyResults } from '../db/repositories';
import { createId } from '../lib/id';
import { colors } from '../theme';

const WEEK_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
/** Seg=1 ... Dom=0 (Date.getDay) */
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

export function CycleSetupScreen() {
  const navigation = useNavigation();
  const { refresh } = useAppData();
  const [objective, setObjective] = useState('');
  const [kr1, setKr1] = useState({ label: '', initial: '0', target: '' });
  const [kr2, setKr2] = useState({ label: '', initial: '0', target: '' });
  const [kr3, setKr3] = useState({ label: '', initial: '0', target: '' });
  const [startDate, setStartDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [reviewDay, setReviewDay] = useState(4);
  const [saving, setSaving] = useState(false);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const onSave = async () => {
    const t1 = parseFloat(kr1.target || '0');
    const t2 = parseFloat(kr2.target || '0');
    const t3 = parseFloat(kr3.target || '0');
    if (!objective.trim()) return;
    setSaving(true);
    try {
      const cycleId = createId('cycle');
      await createCycleWithKeyResults(
        {
          id: cycleId,
          objectiveTitle: objective.trim(),
          startDate: fmt(startDate),
          weekCount: 12,
          reviewWeekday: WEEKDAY_VALUES[reviewDay] ?? 5,
        },
        [
          {
            sortOrder: 1,
            label: kr1.label.trim() || 'KR 1',
            initialValue: parseFloat(kr1.initial || '0'),
            targetValue: Number.isFinite(t1) ? t1 : 100,
            currentValue: parseFloat(kr1.initial || '0'),
          },
          {
            sortOrder: 2,
            label: kr2.label.trim() || 'KR 2',
            initialValue: parseFloat(kr2.initial || '0'),
            targetValue: Number.isFinite(t2) ? t2 : 100,
            currentValue: parseFloat(kr2.initial || '0'),
          },
          {
            sortOrder: 3,
            label: kr3.label.trim() || 'KR 3',
            initialValue: parseFloat(kr3.initial || '0'),
            targetValue: Number.isFinite(t3) ? t3 : 100,
            currentValue: parseFloat(kr3.initial || '0'),
          },
        ]
      );
      await refresh();
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenGlow />
      <AppHeader
        title="CONFIGURAÇÃO"
        onPressMenu={() => navigation.goBack()}
        onPressProfile={() => (navigation as { navigate: (n: string) => void }).navigate('Settings')}
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowLine} />
          <Text style={styles.eyebrow}>SETTING UP TARGETS</Text>
        </View>
        <Text style={styles.h1}>
          Novo <Text style={styles.h1Accent}>Ciclo</Text>
        </Text>
        <View style={{ height: 32 }} />
        <Text style={styles.label}>OBJETIVO PRINCIPAL</Text>
        <TextInput
          style={styles.textarea}
          placeholder="Ex: Dominar o mercado de expansão regional Q3"
          placeholderTextColor="#242424"
          value={objective}
          onChangeText={setObjective}
          multiline
          textAlignVertical="top"
        />
        <View style={styles.divider} />
        {[kr1, kr2, kr3].map((kr, idx) => (
          <View key={idx} style={styles.krBlock}>
            <View style={styles.krHead}>
              <Text style={styles.krNum}>{String(idx + 1).padStart(2, '0')}</Text>
              <Text style={styles.krTag}>KEY RESULT</Text>
            </View>
            <TextInput
              style={styles.inputLine}
              placeholder="Descrição do resultado chave..."
              placeholderTextColor="#555"
              value={idx === 0 ? kr1.label : idx === 1 ? kr2.label : kr3.label}
              onChangeText={(t) => {
                if (idx === 0) setKr1({ ...kr1, label: t });
                else if (idx === 1) setKr2({ ...kr2, label: t });
                else setKr3({ ...kr3, label: t });
              }}
            />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.meta}>Valor Inicial</Text>
                <TextInput
                  style={styles.inputBox}
                  keyboardType="decimal-pad"
                  value={idx === 0 ? kr1.initial : idx === 1 ? kr2.initial : kr3.initial}
                  onChangeText={(t) => {
                    if (idx === 0) setKr1({ ...kr1, initial: t });
                    else if (idx === 1) setKr2({ ...kr2, initial: t });
                    else setKr3({ ...kr3, initial: t });
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.meta}>Meta Final</Text>
                <TextInput
                  style={styles.inputBox}
                  keyboardType="decimal-pad"
                  placeholder="100"
                  placeholderTextColor="#555"
                  value={idx === 0 ? kr1.target : idx === 1 ? kr2.target : kr3.target}
                  onChangeText={(t) => {
                    if (idx === 0) setKr1({ ...kr1, target: t });
                    else if (idx === 1) setKr2({ ...kr2, target: t });
                    else setKr3({ ...kr3, target: t });
                  }}
                />
              </View>
            </View>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>DATA DE INÍCIO</Text>
            <Pressable onPress={() => setShowDate(true)} style={styles.inputBox}>
              <Text style={styles.dateText}>{fmt(startDate)}</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>REVISÃO SEMANAL</Text>
            <View style={styles.weekRow}>
              {WEEK_LABELS.map((l, i) => (
                <Pressable
                  key={i}
                  onPress={() => setReviewDay(i)}
                  style={[
                    styles.weekCell,
                    i < 6 && styles.weekCellBorder,
                    reviewDay === i && styles.weekCellActive,
                  ]}
                >
                  <Text
                    style={[styles.weekCellText, reviewDay === i && styles.weekCellTextActive]}
                  >
                    {l}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        {showDate && (
          <>
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(ev, d) => {
                if (Platform.OS === 'android') {
                  setShowDate(false);
                  if (ev.type === 'dismissed') return;
                }
                if (d) setStartDate(d);
              }}
            />
            {Platform.OS === 'ios' && (
              <Pressable style={styles.iosDateOk} onPress={() => setShowDate(false)}>
                <Text style={styles.iosDateOkText}>OK</Text>
              </Pressable>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
        <PrimaryButton
          label="COMEÇAR CICLO"
          onPress={onSave}
          loading={saving}
          disabled={!objective.trim()}
        />
        <Text style={styles.footerHint}>OPERATIONAL READINESS: OPTIMAL</Text>
        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  eyebrowLine: { width: 24, height: 2, backgroundColor: colors.accent },
  eyebrow: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 3,
    color: colors.accent,
  },
  h1: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 44,
    letterSpacing: -1.5,
    color: colors.white,
  },
  h1Accent: { color: colors.accent },
  label: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 3,
    color: colors.accent,
    marginBottom: 8,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    color: colors.white,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 22,
    paddingVertical: 16,
    minHeight: 100,
  },
  divider: {
    marginVertical: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  krBlock: { marginBottom: 24 },
  krHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  krNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 14, color: colors.accent },
  krTag: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 2,
    color: colors.onSurfaceMuted,
  },
  inputLine: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    color: colors.white,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  row2: { flexDirection: 'row', gap: 16 },
  meta: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 10,
    letterSpacing: 1,
    color: colors.onSurfaceMuted,
    marginBottom: 8,
  },
  inputBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: colors.white,
  },
  dateText: { fontFamily: 'SpaceGrotesk_400Regular', color: colors.white },
  weekRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border },
  weekCell: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCellBorder: { borderRightWidth: 1, borderRightColor: colors.border },
  weekCellActive: { backgroundColor: colors.accent },
  weekCellText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    color: colors.onSurface,
  },
  weekCellTextActive: { color: colors.onAccent },
  footerHint: {
    marginTop: 20,
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    letterSpacing: 2,
    color: '#666',
  },
  iosDateOk: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: colors.accent,
  },
  iosDateOkText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: colors.onAccent,
    letterSpacing: 2,
  },
});
