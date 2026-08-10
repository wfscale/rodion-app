import 'server-only';

/**
 * Минимальный клиент Google OAuth 2.0 + Sheets API на fetch.
 *
 * Пакет googleapis сюда не берём: он весит десятки мегабайт и на Vercel
 * упирается в лимит размера serverless-функции. Нужны ровно четыре вызова.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** Интеграция считается настроенной, только если заданы все три переменные. */
export function getGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function buildConsentUrl(config: GoogleConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    // offline + consent — обязательны, иначе Google не выдаст refresh_token
    // при повторной авторизации того же аккаунта.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });

  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(
  config: GoogleConfig,
  code: string,
): Promise<{ access_token: string; refresh_token?: string } | null> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) return null;
  return (await response.json()) as { access_token: string; refresh_token?: string };
}

export async function refreshAccessToken(
  config: GoogleConfig,
  refreshToken: string,
): Promise<string | null> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { access_token?: string };
  return payload.access_token ?? null;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { email?: string };
  return payload.email ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Sheets                                                                     */
/* -------------------------------------------------------------------------- */

export type SheetPayload = { title: string; rows: (string | number)[][] };

/** Создаёт новую таблицу и возвращает её id. */
export async function createSpreadsheet(
  accessToken: string,
  title: string,
): Promise<string | null> {
  const response = await fetch(SHEETS_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties: { title } }),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { spreadsheetId?: string };
  return payload.spreadsheetId ?? null;
}

async function listSheetTitles(accessToken: string, sheetId: string): Promise<string[] | null> {
  const response = await fetch(
    `${SHEETS_API}/${encodeURIComponent(sheetId)}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    sheets?: { properties?: { title?: string } }[];
  };

  return (payload.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title));
}

/** Экранирует имя листа для использования в A1-нотации. */
function quoteTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/**
 * Записывает набор листов в таблицу: недостающие создаёт, существующие
 * полностью перезаписывает. Полная перезапись проще инкрементальной
 * синхронизации и для объёмов личного трекера совершенно безболезненна.
 */
export async function writeSheets(
  accessToken: string,
  sheetId: string,
  payloads: SheetPayload[],
): Promise<{ ok: boolean; error?: string }> {
  const existing = await listSheetTitles(accessToken, sheetId);
  if (existing === null) {
    return { ok: false, error: 'spreadsheet not found or no access' };
  }

  const missing = payloads.filter((payload) => !existing.includes(payload.title));

  if (missing.length > 0) {
    const response = await fetch(`${SHEETS_API}/${encodeURIComponent(sheetId)}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: missing.map((payload) => ({
          addSheet: { properties: { title: payload.title } },
        })),
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `cannot create sheets: ${await response.text()}` };
    }
  }

  for (const payload of payloads) {
    const range = quoteTitle(payload.title);

    const cleared = await fetch(
      `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!cleared.ok) {
      return { ok: false, error: `cannot clear ${payload.title}` };
    }

    const written = await fetch(
      `${SHEETS_API}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: payload.rows }),
      },
    );

    if (!written.ok) {
      return { ok: false, error: `cannot write ${payload.title}: ${await written.text()}` };
    }
  }

  return { ok: true };
}
