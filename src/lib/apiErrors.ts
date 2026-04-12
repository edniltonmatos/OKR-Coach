/** Erro HTTP da API de chat (OpenAI-compatível); preserva status e corpo para mensagens ao utilizador. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyText: string
  ) {
    super(bodyText);
    this.name = 'ApiError';
  }
}

type OpenAiErrShape = {
  error?: { message?: string; code?: string; type?: string };
};

function parseOpenAiMessage(bodyText: string): string | null {
  const t = bodyText.trim();
  if (!t.startsWith('{')) return null;
  try {
    const j = JSON.parse(t) as OpenAiErrShape;
    const m = j.error?.message;
    return typeof m === 'string' && m.length > 0 ? m : null;
  } catch {
    return null;
  }
}

function mapByStatus(status: number, bodyText: string, apiMsg: string | null): string {
  const lower = `${apiMsg ?? ''} ${bodyText}`.toLowerCase();

  if (status === 401) {
    const detail = apiMsg && apiMsg.length < 180 ? ` Detalhe: ${apiMsg}` : '';
    return (
      'Chave recusada (401).' +
      detail +
      ' Confirme: chave e Base URL são do mesmo serviço (OpenAI: https://api.openai.com/v1; Groq: https://api.groq.com/openai/v1).' +
      ' No .env não use aspas à volta do valor; alterou o .env? Pare o Metro e rode de novo com cache limpo: npx expo start -c.' +
      ' Se usa Ajustes no telefone, volte a colar a chave sem espaços extra.'
    );
  }
  if (status === 403) {
    return 'Acesso recusado pelo serviço. Verifique a chave e as permissões da conta.';
  }
  if (status === 429) {
    return 'Muitos pedidos de seguida ou quota esgotada. Espere um pouco ou verifique o plano no site do provedor.';
  }
  if (status === 402 || lower.includes('insufficient_quota') || lower.includes('billing')) {
    return 'Conta sem saldo ou faturação em falta. Adicione créditos ou verifique o painel do provedor (ex.: OpenAI ou Groq).';
  }
  if (status >= 500) {
    return 'O serviço da IA está indisponível. Tente de novo daqui a pouco.';
  }
  if (status === 400) {
    if (lower.includes('model') || lower.includes('invalid')) {
      return 'O modelo configurado não é válido ou não está disponível. Em Ajustes, confira o nome do modelo.';
    }
    return 'O pedido foi recusado. Verifique base URL, modelo e chave nas definições.';
  }
  if (status === 404) {
    return 'Endereço da API não encontrado. Confira a Base URL em Ajustes (ex.: …/v1).';
  }

  if (apiMsg && apiMsg.length < 200) {
    return `Não foi possível concluir o pedido: ${apiMsg}`;
  }
  return 'Não foi possível concluir o pedido à IA. Verifique a rede e as definições da API.';
}

export function getUserFacingApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const apiMsg = parseOpenAiMessage(error.bodyText);
    return mapByStatus(error.status, error.bodyText, apiMsg);
  }
  if (error instanceof Error) {
    if (error.message === 'Resposta vazia da API') {
      return 'A IA não devolveu texto. Verifique o modelo em Ajustes ou tente de novo.';
    }
    const msg = error.message;
    if (
      error.name === 'TypeError' ||
      /network|failed to fetch|network request failed|aborted/i.test(msg)
    ) {
      return 'Sem ligação estável à internet. Verifique a rede e tente de novo.';
    }
  }
  return 'Algo correu mal ao contactar a IA. Tente de novo ou reveja a chave em Ajustes.';
}
