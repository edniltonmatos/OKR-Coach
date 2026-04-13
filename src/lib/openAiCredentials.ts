import * as SecureStore from 'expo-secure-store';
import { SECURE_OPENAI_BASE, SECURE_OPENAI_KEY, SECURE_OPENAI_MODEL } from '../config/secrets';

export type OpenAiCredentials = {
  apiKey: string | null;
  baseUrl?: string;
  model?: string;
};

/** Aspas ou BOM no .env (comum no Windows) invalidam a chave se forem enviadas à API. */
function sanitizeEnvValue(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let s = raw.trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.length > 0 ? s : undefined;
}

/**
 * Resolve API key / base / model: cofre local (SecureStore), se ainda existir valor de
 * instalações antigas; caso contrário EXPO_PUBLIC_* do `.env` no momento do build.
 *
 * Atenção: EXPO_PUBLIC_* entra no bundle JS — não commite o `.env`; para maior segurança
 * use um backend proxy em vez de embutir a chave.
 */
export async function getOpenAiCredentials(): Promise<OpenAiCredentials> {
  const [kStore, bStore, mStore] = await Promise.all([
    SecureStore.getItemAsync(SECURE_OPENAI_KEY),
    SecureStore.getItemAsync(SECURE_OPENAI_BASE),
    SecureStore.getItemAsync(SECURE_OPENAI_MODEL),
  ]);

  const kEnv = sanitizeEnvValue(process.env.EXPO_PUBLIC_OPENAI_API_KEY);
  const bEnv =
    sanitizeEnvValue(process.env.EXPO_PUBLIC_OPENAI_BASE_URL)?.replace(/\/$/, '') || undefined;
  const mEnv = sanitizeEnvValue(process.env.EXPO_PUBLIC_OPENAI_MODEL);

  const apiKey = (kStore?.trim() || kEnv) ?? null;
  const baseUrl = bStore?.trim() || bEnv || undefined;
  const model = mStore?.trim() || mEnv || undefined;

  return { apiKey, baseUrl, model };
}

async function setOrRemove(key: string, value: string | null | undefined): Promise<void> {
  const v = value?.trim();
  if (v) {
    await SecureStore.setItemAsync(key, v);
  } else {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* key may not exist */
    }
  }
}

/** Grava credenciais no SecureStore. Strings vazias removem o valor do cofre (volta ao .env se existir). */
export async function setOpenAiCredentials(params: {
  apiKey?: string | null;
  baseUrl?: string | null;
  model?: string | null;
}): Promise<void> {
  await Promise.all([
    setOrRemove(SECURE_OPENAI_KEY, params.apiKey ?? undefined),
    setOrRemove(SECURE_OPENAI_BASE, params.baseUrl ?? undefined),
    setOrRemove(SECURE_OPENAI_MODEL, params.model ?? undefined),
  ]);
}

/** Atualiza só base URL e modelo no cofre (campos vazios removem o override). */
export async function setOpenAiEndpointInStore(params: {
  baseUrl?: string | null;
  model?: string | null;
}): Promise<void> {
  await Promise.all([
    setOrRemove(SECURE_OPENAI_BASE, params.baseUrl ?? undefined),
    setOrRemove(SECURE_OPENAI_MODEL, params.model ?? undefined),
  ]);
}

/** Grava ou substitui a chave no cofre. */
export async function setOpenAiApiKeyInStore(apiKey: string): Promise<void> {
  const v = apiKey.trim();
  if (!v) return;
  await SecureStore.setItemAsync(SECURE_OPENAI_KEY, v);
}

export async function removeOpenAiApiKeyFromStore(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_OPENAI_KEY);
  } catch {
    /* */
  }
}

export async function clearOpenAiCredentials(): Promise<void> {
  await setOpenAiCredentials({ apiKey: '', baseUrl: '', model: '' });
}

/** True se a chave foi guardada pelo utilizador no cofre (não só via .env). */
export async function hasUserStoredApiKey(): Promise<boolean> {
  const k = await SecureStore.getItemAsync(SECURE_OPENAI_KEY);
  return !!k?.trim();
}
