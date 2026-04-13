import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppHeader } from '../components/AppHeader';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScreenGlow } from '../components/ScreenGlow';
import { useAppData } from '../context/DataContext';
import type { KeyResult } from '../types';
import {
  createCycleWithKeyResults,
  getKeyResults,
  getLatestCycle,
  replaceKeyResultsForCycle,
  updateCycleFields,
} from '../db/repositories';
import { createId } from '../lib/id';
import { parseLocalDate } from '../lib/dates';
import {
  getOpenAiCredentials,
  hasUserStoredApiKey,
  removeOpenAiApiKeyFromStore,
  setOpenAiApiKeyInStore,
  setOpenAiEndpointInStore,
} from '../lib/openAiCredentials';
import { colors } from '../theme';

/** Altura aproximada do AppHeader abaixo da status bar. */
const HEADER_CONTENT_HEIGHT = 56;

const WEEK_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
/** Seg=1 ... Dom=0 (Date.getDay) */
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

export function CycleSetupScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { refresh } = useAppData();
  const [objective, setObjective] = useState('');
  const [kr1, setKr1] = useState({ label: '', initial: '0', target: '' });
  const [kr2, setKr2] = useState({ label: '', initial: '0', target: '' });
  const [kr3, setKr3] = useState({ label: '', initial: '0', target: '' });
  const [startDate, setStartDate] = useState(new Date());
  const [weekCountStr, setWeekCountStr] = useState('12');
  const [showDate, setShowDate] = useState(false);
  const [reviewDay, setReviewDay] = useState(4);
  const [saving, setSaving] = useState(false);
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
  const loadedKrsRef = useRef<KeyResult[]>([]);
  const cycleBaselineRef = useRef<{ start: string; weekCount: number } | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiBaseInput, setApiBaseInput] = useState('');
  const [apiModelInput, setApiModelInput] = useState('');
  const [apiKeyStored, setApiKeyStored] = useState(false);
  const [apiSaving, setApiSaving] = useState(false);
  const [keyboardPad, setKeyboardPad] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardPad(e.endCoordinates?.height ?? 0)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardPad(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const scrollToBottomSoon = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const loadApiFields = useCallback(async () => {
    const [creds, stored] = await Promise.all([
      getOpenAiCredentials(),
      hasUserStoredApiKey(),
    ]);
    setApiKeyStored(stored);
    setApiBaseInput(creds.baseUrl ?? '');
    setApiModelInput(creds.model ?? '');
    setApiKeyInput('');
  }, []);

  const loadCycleForm = useCallback(async () => {
    const c = await getLatestCycle();
    if (!c) {
      setEditingCycleId(null);
      cycleBaselineRef.current = null;
      loadedKrsRef.current = [];
      setObjective('');
      setKr1({ label: '', initial: '0', target: '' });
      setKr2({ label: '', initial: '0', target: '' });
      setKr3({ label: '', initial: '0', target: '' });
      setStartDate(new Date());
      setWeekCountStr('12');
      setReviewDay(4);
      return;
    }
    setEditingCycleId(c.id);
    cycleBaselineRef.current = { start: c.startDate, weekCount: c.weekCount };
    setObjective(c.objectiveTitle);
    setStartDate(parseLocalDate(c.startDate));
    setWeekCountStr(String(c.weekCount));
    const ri = WEEKDAY_VALUES.indexOf(c.reviewWeekday);
    setReviewDay(ri >= 0 ? ri : 4);
    const krs = [...(await getKeyResults(c.id))].sort((a, b) => a.sortOrder - b.sortOrder);
    loadedKrsRef.current = krs;
    const pad = (x: KeyResult | undefined) => ({
      label: x?.label ?? '',
      initial: x != null ? String(x.initialValue) : '0',
      target: x != null ? String(x.targetValue) : '',
    });
    setKr1(pad(krs[0]));
    setKr2(pad(krs[1]));
    setKr3(pad(krs[2]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadApiFields();
      loadCycleForm();
    }, [loadApiFields, loadCycleForm])
  );

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const onSaveApi = async () => {
    setApiSaving(true);
    try {
      if (apiKeyInput.trim()) {
        await setOpenAiApiKeyInStore(apiKeyInput.trim());
        setApiKeyStored(true);
        setApiKeyInput('');
      }
      await setOpenAiEndpointInStore({
        baseUrl: apiBaseInput.trim() || null,
        model: apiModelInput.trim() || null,
      });
      Alert.alert('IA', 'Credenciais guardadas no dispositivo.');
      await loadApiFields();
    } finally {
      setApiSaving(false);
    }
  };

  const onRemoveApiKey = () => {
    Alert.alert('Remover chave', 'A chave guardada no cofre será apagada.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await removeOpenAiApiKeyFromStore();
          setApiKeyStored(false);
          await loadApiFields();
        },
      },
    ]);
  };

  const persistNewCycle = async () => {
    const t1 = parseFloat(kr1.target || '0');
    const t2 = parseFloat(kr2.target || '0');
    const t3 = parseFloat(kr3.target || '0');
    const wc = Math.min(52, Math.max(1, parseInt(weekCountStr, 10) || 12));
    const cycleId = createId('cycle');
    await createCycleWithKeyResults(
      {
        id: cycleId,
        objectiveTitle: objective.trim(),
        startDate: fmt(startDate),
        weekCount: wc,
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
  };

  const persistEditCycle = async () => {
    if (!editingCycleId) return;
    const t1 = parseFloat(kr1.target || '0');
    const t2 = parseFloat(kr2.target || '0');
    const t3 = parseFloat(kr3.target || '0');
    const wc = Math.min(52, Math.max(1, parseInt(weekCountStr, 10) || 12));
    const lk = loadedKrsRef.current;
    await updateCycleFields(editingCycleId, {
      objectiveTitle: objective.trim(),
      startDate: fmt(startDate),
      weekCount: wc,
      reviewWeekday: WEEKDAY_VALUES[reviewDay] ?? 5,
    });
    await replaceKeyResultsForCycle(editingCycleId, [
      {
        sortOrder: 1,
        label: kr1.label.trim() || 'KR 1',
        initialValue: parseFloat(kr1.initial || '0'),
        targetValue: Number.isFinite(t1) ? t1 : 100,
        currentValue: lk[0]?.currentValue ?? parseFloat(kr1.initial || '0'),
      },
      {
        sortOrder: 2,
        label: kr2.label.trim() || 'KR 2',
        initialValue: parseFloat(kr2.initial || '0'),
        targetValue: Number.isFinite(t2) ? t2 : 100,
        currentValue: lk[1]?.currentValue ?? parseFloat(kr2.initial || '0'),
      },
      {
        sortOrder: 3,
        label: kr3.label.trim() || 'KR 3',
        initialValue: parseFloat(kr3.initial || '0'),
        targetValue: Number.isFinite(t3) ? t3 : 100,
        currentValue: lk[2]?.currentValue ?? parseFloat(kr3.initial || '0'),
      },
    ]);
  };

  const onSave = () => {
    if (!objective.trim()) return;

    const run = async () => {
      setSaving(true);
      try {
        if (editingCycleId) {
          await persistEditCycle();
        } else {
          await persistNewCycle();
        }
        await refresh();
        navigation.goBack();
      } finally {
        setSaving(false);
      }
    };

    if (editingCycleId && cycleBaselineRef.current) {
      const wc = Math.min(52, Math.max(1, parseInt(weekCountStr, 10) || 12));
      const changed =
        fmt(startDate) !== cycleBaselineRef.current.start ||
        wc !== cycleBaselineRef.current.weekCount;
      if (changed) {
        Alert.alert(
          'Alterar ciclo',
          'Mudar a data de início ou o número de semanas altera a numeração das semanas em relação aos registos já guardados.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Guardar', onPress: () => void run() },
          ]
        );
        return;
      }
    }

    void run();
  };

  const keyboardOffset = insets.top + HEADER_CONTENT_HEIGHT;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}
    >
      <ScreenGlow />
      <AppHeader
        title="CONFIGURAÇÃO"
        onPressMenu={() => navigation.goBack()}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 48 + keyboardPad + (Platform.OS === 'android' ? insets.bottom : 0) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowLine} />
          <Text style={styles.eyebrow}>SETTING UP TARGETS</Text>
        </View>
        <Text style={styles.h1}>
          {editingCycleId ? 'Editar ' : 'Novo '}
          <Text style={styles.h1Accent}>Ciclo</Text>
        </Text>
        <Pressable
          style={styles.wizardBtn}
          onPress={() =>
            (navigation as { navigate: (n: string) => void }).navigate('CycleWizard')
          }
        >
          <Text style={styles.wizardBtnTxt}>CRIAR COM IA (ASSISTENTE)</Text>
        </Pressable>
        <View style={{ height: 20 }} />
        <Text style={styles.label}>IA — CHAVE E API (OPCIONAL)</Text>
        <Text style={styles.apiHint}>
          Guardado com segurança no aparelho. Variáveis EXPO_PUBLIC_* no build continuam a funcionar
          como fallback.
        </Text>
        <Text style={styles.apiStatus}>
          {apiKeyStored
            ? 'Chave API: guardada no cofre.'
            : 'Chave API: não guardada no cofre (use o campo abaixo ou .env no build).'}
        </Text>
        <TextInput
          style={styles.inputLine}
          placeholder="sk-… (nova chave — substitui a do cofre)"
          placeholderTextColor="#555"
          value={apiKeyInput}
          onChangeText={setApiKeyInput}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={styles.meta}>Base URL (vazio = OpenAI padrão)</Text>
        <TextInput
          style={styles.inputBox}
          placeholder="https://api.openai.com/v1"
          placeholderTextColor="#555"
          value={apiBaseInput}
          onChangeText={setApiBaseInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.meta}>Modelo</Text>
        <TextInput
          style={styles.inputBox}
          placeholder="gpt-4o-mini"
          placeholderTextColor="#555"
          value={apiModelInput}
          onChangeText={setApiModelInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.apiRow}>
          <Pressable
            style={[styles.apiBtn, apiSaving && { opacity: 0.7 }]}
            onPress={onSaveApi}
            disabled={apiSaving}
          >
            <Text style={styles.apiBtnTxt}>GUARDAR IA</Text>
          </Pressable>
          {apiKeyStored && (
            <Pressable style={styles.apiBtnGhost} onPress={onRemoveApiKey}>
              <Text style={styles.apiBtnGhostTxt}>REMOVER CHAVE</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.divider} />
        <View style={{ height: 16 }} />
        <Text style={styles.label}>OBJETIVO PRINCIPAL</Text>
        <TextInput
          style={styles.textarea}
          placeholder="Ex: Dominar o mercado de expansão regional Q3"
          placeholderTextColor="#242424"
          value={objective}
          onChangeText={setObjective}
          multiline
          textAlignVertical="top"
          onFocus={scrollToBottomSoon}
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
            <Text style={styles.label}>SEMANAS NO CICLO</Text>
            <TextInput
              style={styles.inputBox}
              keyboardType="number-pad"
              placeholder="12"
              placeholderTextColor="#555"
              value={weekCountStr}
              onChangeText={setWeekCountStr}
              onFocus={scrollToBottomSoon}
            />
          </View>
        </View>
        <View style={{ marginTop: 16 }}>
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
          label={editingCycleId ? 'GUARDAR ALTERAÇÕES' : 'COMEÇAR CICLO'}
          onPress={onSave}
          loading={saving}
          disabled={!objective.trim()}
        />
        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
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
  wizardBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  wizardBtnTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
  },
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
  apiHint: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceMuted,
    marginBottom: 10,
  },
  apiStatus: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 12,
    color: colors.onSurface,
    marginBottom: 12,
  },
  apiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  apiBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  apiBtnTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 12,
    letterSpacing: 2,
    color: colors.onAccent,
  },
  apiBtnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  apiBtnGhostTxt: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    letterSpacing: 1,
    color: colors.onSurfaceMuted,
  },
});
