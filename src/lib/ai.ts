import type { Cycle, KeyResult, WeekDigestMood } from '../types';
import { ApiError } from './apiErrors';

const DEFAULT_BASE = 'https://api.openai.com/v1';

export type ChatCompletionParams = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  cycle: Cycle;
  keyResults: KeyResult[];
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
};

export async function sendChatCompletion(params: ChatCompletionParams): Promise<string> {
  const { apiKey, baseUrl = DEFAULT_BASE, model = 'gpt-4o-mini', cycle, keyResults, messages } = params;
  const system = buildSystemPrompt(cycle, keyResults);
  const body = {
    model,
    messages: [{ role: 'system' as const, content: system }, ...messages],
    temperature: 0.6,
  };
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(res.status, errText || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Resposta vazia da API');
  return text;
}

async function chatCompletionRaw(
  apiKey: string,
  baseUrl: string | undefined,
  model: string | undefined,
  system: string,
  userContent: string
): Promise<string> {
  const m = model ?? 'gpt-4o-mini';
  const base = baseUrl?.replace(/\/$/, '') || DEFAULT_BASE;
  const body = {
    model: m,
    messages: [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: userContent },
    ],
    temperature: 0.5,
  };
  const url = `${base}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(res.status, errText || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Resposta vazia da API');
  return text;
}

export async function fetchWeeklyDigest(params: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  cycle: Cycle;
  keyResults: KeyResult[];
  weekNumber: number;
  weekNotes: string | null;
  krSnapshotLine: string;
  chatTranscript: string;
}): Promise<{ summary: string; mood: WeekDigestMood }> {
  const {
    apiKey,
    baseUrl,
    model,
    cycle,
    keyResults,
    weekNumber,
    weekNotes,
    krSnapshotLine,
    chatTranscript,
  } = params;
  const krCtx = keyResults
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(
      (kr) =>
        `KR${kr.sortOrder} ${kr.label}: início ${kr.initialValue} → meta ${kr.targetValue}`
    )
    .join('\n');
  const userContent = `Objetivo do ciclo: "${cycle.objectiveTitle}".

Semana ${weekNumber} de ${cycle.weekCount}.

Contexto dos KRs:
${krCtx}

Valores registados nesta semana:
${krSnapshotLine}

Notas / análise semanal do utilizador:
${weekNotes?.trim() || '(sem notas)'}

Mensagens no chat com a IA durante esta semana:
${chatTranscript.trim() || '(nenhuma mensagem nesta semana)'}

Tarefa: Escreva um resumo condensado (4–6 linhas curtas) que integre o tom das notas, o chat e o progresso dos números. Última linha do texto DEVE ser exatamente uma destas: MOOD: good | MOOD: mixed | MOOD: bad — avaliando números e comentários.`;

  const system = `És o Strategy AI do OKR Coach. Respostas só em português do Brasil.`;
  const text = await chatCompletionRaw(apiKey, baseUrl, model, system, userContent);
  const moodMatch = text.match(/MOOD:\s*(good|mixed|bad)/i);
  let mood: WeekDigestMood = 'mixed';
  if (moodMatch) {
    const w = moodMatch[1].toLowerCase();
    if (w === 'good' || w === 'bad' || w === 'mixed') mood = w;
  }
  const summary = text.replace(/\n*MOOD:\s*(good|mixed|bad)\s*$/i, '').trim();
  return { summary, mood };
}

export async function fetchStatusInsight(params: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  cycle: Cycle;
  keyResults: KeyResult[];
}): Promise<string> {
  const { apiKey, baseUrl, model, cycle, keyResults } = params;
  return sendChatCompletion({
    apiKey,
    baseUrl,
    model,
    cycle,
    keyResults,
    messages: [
      {
        role: 'user',
        content:
          'Em 2–3 frases curtas em português, descreva o status atual dos KRs e uma recomendação prática para esta semana. Tom técnico e direto.',
      },
    ],
  });
}

export type WizardCyclePayload = {
  objectiveTitle: string;
  keyResults: Array<{
    sortOrder: number;
    label: string;
    initialValue: number;
    targetValue: number;
  }>;
  startDate: string;
  reviewWeekday: number;
  weekCount: number;
};

const WIZARD_SYSTEM = `És o assistente de configuração do OKR Coach. Guia o utilizador em português do Brasil, uma pergunta de cada vez, de forma curta.
Objetivo: recolher (1) objetivo principal, (2) três resultados-chave mensuráveis com valor inicial e meta, (3) data de início do ciclo (AAAA-MM-DD), (4) dia da semana para revisão (0=domingo … 6=sábado), (5) número de semanas do ciclo (1–52, predefinido 12).
Quando tiveres tudo confirmado, a última mensagem DEVE incluir APENAS um bloco JSON válido entre marcadores:
JSON_START
{ ... }
JSON_END
O JSON deve ter a forma:
{"objectiveTitle":"...","keyResults":[{"sortOrder":1,"label":"...","initialValue":0,"targetValue":100}, ... três itens ...],"startDate":"YYYY-MM-DD","reviewWeekday":4,"weekCount":12}
Não incluas texto explicativo depois do JSON_END.`;

export async function sendWizardTurn(params: {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}): Promise<string> {
  const { apiKey, baseUrl, model, messages } = params;
  const m = model ?? 'gpt-4o-mini';
  const base = baseUrl?.replace(/\/$/, '') || DEFAULT_BASE;
  const body = {
    model: m,
    messages: [{ role: 'system' as const, content: WIZARD_SYSTEM }, ...messages],
    temperature: 0.35,
  };
  const url = `${base}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new ApiError(res.status, errText || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Resposta vazia da API');
  return text;
}

export function parseWizardPayload(text: string): WizardCyclePayload | null {
  let raw = text.match(/JSON_START\s*([\s\S]*?)\s*JSON_END/)?.[1]?.trim();
  if (!raw) {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    raw = fence?.[1]?.trim();
  }
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as WizardCyclePayload;
    if (!o.objectiveTitle || !Array.isArray(o.keyResults) || o.keyResults.length < 3) return null;
    return o;
  } catch {
    return null;
  }
}

function buildSystemPrompt(cycle: Cycle, keyResults: KeyResult[]): string {
  const krLines = keyResults
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(
      (kr) =>
        `KR${kr.sortOrder} ${kr.label}: atual ${kr.currentValue}, meta ${kr.targetValue} (início ${kr.initialValue})`
    )
    .join('\n');
  return `Você é o Strategy AI do app OKR Coach. Ciclo: objetivo "${cycle.objectiveTitle}".\n${krLines}\nResponda sempre em português do Brasil.`;
}
