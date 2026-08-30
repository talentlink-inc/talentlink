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
