import { readFileSync } from "node:fs";
import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set (path or inline JSON).");
  }
  const json = raw.trim().startsWith("{") ? raw : readFileSync(raw, "utf8");
  return JSON.parse(json);
}

export function getGoogleClients() {
  const auth = new google.auth.GoogleAuth({
    credentials: loadCredentials(),
    scopes: SCOPES,
  });
  return {
    sheets: google.sheets({ version: "v4", auth }),
    drive: google.drive({ version: "v3", auth }),
  };
}

// Reads a whole sheet and returns an array of header-keyed row objects.
// Uses FORMATTED_VALUE so dates/numbers come back as the same text a user
// would see in the sheet — good enough for a one-shot migration script.
export async function readSheetAsObjects(
  sheets: ReturnType<typeof getGoogleClients>["sheets"],
  spreadsheetId: string,
  sheetName: string
): Promise<Record<string, string>[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = res.data.values ?? [];
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => String(h ?? "").trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] != null ? String(row[i]) : "";
    });
    return obj;
  });
}

/**
 * Like readSheetAsObjects, but reads a big tab in row chunks with a timeout
 * and retries per request — one huge values.get can stall for minutes.
 */
export async function readSheetAsObjectsChunked(
  sheets: ReturnType<typeof getGoogleClients>["sheets"],
  spreadsheetId: string,
  sheetName: string,
  opts: { chunkRows?: number; timeoutMs?: number; retries?: number; onProgress?: (rows: number) => void } = {}
): Promise<Record<string, string>[]> {
  const { chunkRows = 500, timeoutMs = 60_000, retries = 4, onProgress } = opts;
  const get = async (range: string) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await sheets.spreadsheets.values.get(
          { spreadsheetId, range, valueRenderOption: "FORMATTED_VALUE" },
          { timeout: timeoutMs }
        );
        return res.data.values ?? [];
      } catch (err) {
        if (attempt > retries) throw err;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  };

  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" }, { timeout: timeoutMs });
  const props = meta.data.sheets?.find((s) => s.properties?.title === sheetName)?.properties;
  const totalRows = props?.gridProperties?.rowCount ?? 0;
  const header = (await get(`'${sheetName}'!1:1`))[0] ?? [];
  const headers = header.map((h) => String(h ?? "").trim());
  if (headers.length === 0) return [];

  const out: Record<string, string>[] = [];
  for (let start = 2; start <= totalRows; start += chunkRows) {
    const end = Math.min(totalRows, start + chunkRows - 1);
    const rows = await get(`'${sheetName}'!${start}:${end}`);
    for (const row of rows) {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = row[i] != null ? String(row[i]) : ""));
      out.push(obj);
    }
    onProgress?.(out.length);
    if (rows.length === 0) break;
  }
  return out;
}
