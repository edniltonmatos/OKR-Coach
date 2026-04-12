import type { Cycle, KeyResult } from '../types';
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
