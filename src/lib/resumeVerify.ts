// Repository migration: decide whether a GAS Resume Lab file is a good
// resume, and recover the candidate's full name and job title for the
// "Full Name - Job Title" file name. Pure functions so the rules are tested.

// Section headers the GAS AI sometimes returned as the "name".
const HEADER_WORDS =
  /^(professional\s+summary|work\s+experience|experience|education|skills?|technical\s+skills|summary|profile|objective|career\s+(objective|summary)|contact|about|qualifications|curriculum\s+vitae|resume|cv|personal\s+details|employment\s+history)$/i;
const NOT_NAME_WORDS =
  /\b(resume|curriculum|vitae|cv|profile|summary|developer|engineer|consultant|analyst|architect|manager|lead|senior|sr|jr|admin|administrator|tester|testing|test|designer|specialist|experience|years|java|python|sap|oracle|salesforce|devops|data|cloud|aws|azure|updated|final|new|copy|page|phone|email|mobile|address|linkedin|dotnet|net|full|stack|fullstack|frontend|backend|qa|automation|sdet|ios|android|ui|ux|etl|bi|sql|mulesoft|sharepoint|drupal|react|angular|node|scrum|agile|business|software|technical|programmer|support|network|security|hadoop|spark|tableau|power|servicenow|workday|ariba|mm|fico|abap|hana|bpm|crm|erp|sdlc|selenium|cyber|mainframe|cobol|golang|kotlin|swift|php|ruby|perl|scala)\b/i;

function collapse(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

/** Title-case a name that arrived all-caps or all-lower ("JOHN DOE" → "John Doe"). */
export function tidyName(name: string): string {
  const n = collapse(
    name
      .replace(/[_|•·]+/g, " ")
      .replace(/\s*[,(].*$/, "")
      .replace(/[’‘`]/g, "'")
      // "Krishna.Nelluri" → "Krishna Nelluri" (a dot between names, not an initial)
      .replace(/([a-z]{2,})\.(?=[A-Za-z]{2,})/gi, "$1 ")
  );
  const cap = (w: string) => (w.length <= 2 && w.endsWith(".") ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1));
  // All-caps or all-lower → title case; mixed case → capitalise any lower-case word
  // ("Hari babu Thatikonda" → "Hari Babu Thatikonda") but keep "McDonald" etc.
  if (n === n.toUpperCase() || n === n.toLowerCase()) return n.toLowerCase().split(" ").map(cap).join(" ");
  return n
    .split(" ")
    .map((w) => (/^[a-z]/.test(w) ? cap(w) : w))
    .join(" ");
}

/** A plausible person's full name: 2–5 words of letters (initials allowed), not a header or a job word. */
export function isRealName(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const n = collapse(raw);
  if (n.length < 4 || n.length > 50 || /\n/.test(raw)) return false;
  if (HEADER_WORDS.test(n)) return false;
  if (/[@\d#/\\:]/.test(n)) return false;
  // Two or more initials-only words ("Naeem K Al" style truncations) aren't a full name.
  if (NOT_NAME_WORDS.test(n)) return false;
  const words = n.split(" ");
  if (words.length < 2 || words.length > 5) return false;
  if (!words.every((w) => /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.-]*$/.test(w))) return false;
  // At least one word must be a proper name (3+ letters), not just initials.
  if (words.filter((w) => w.replace(/[.'-]/g, "").length >= 3).length < 1) return false;
  // Sentences aren't names: no common words, and every word capitalised
  // (or the whole thing in capitals, as resume headers often are).
  if (words.some((w) => STOP_WORDS.has(w.toLowerCase()))) return false;
  return n === n.toUpperCase() || words.every((w) => /^[A-ZÀ-ÖØ-Þ]/.test(w));
}

const STOP_WORDS = new Set(
  "i me my am is are was the and or of to in on at for with from by an all here there this that have has had be been not no yes we our you your he she they it its as so do did can will would should".split(" ")
);

/** Name from a file name like "John_Doe_Resume_2024.pdf" or "Resume - Jane Smith (Java).docx". */
export function nameFromFileName(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  let s = fileName.replace(/\.[a-z0-9]{2,5}$/i, "");
  s = s.replace(/\(.*?\)|\[.*?\]/g, " ");
  s = s.replace(/[_.+]+/g, " ").replace(/\s*-\s*/g, " - ");
  // Try each dash-separated part, then the whole thing minus job words.
  const parts = s.split(" - ").map((p) => p.replace(/\b(resume|cv|curriculum vitae|updated|final|latest|new|copy)\b/gi, " "));
  for (const p of parts) {
    const words = collapse(p.replace(/\d+/g, " ")).split(" ").filter(Boolean);
    for (let len = Math.min(4, words.length); len >= 2; len--) {
      const candidate = tidyName(words.slice(0, len).join(" "));
      if (isRealName(candidate)) return candidate;
    }
  }
  return null;
}

/** Name from the top of the resume text: the first short line that looks like a person's name. */
export function nameFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const lines = text
    .split(/\r?\n/)
    .map((l) => collapse(l.replace(/^(name|candidate)\s*[:\-]\s*/i, "")))
    .filter(Boolean)
    .slice(0, 12);
  for (const line of lines) {
    // A name line is often followed by contact info on the same line.
    const head = collapse(line.split(/\s{2,}|\||•|,|\t|(?=\S+@)|(?=\+?\d[\d\s().-]{7,})/)[0] ?? "");
    if (isRealName(head)) return tidyName(head);
  }
  return null;
}

/** Best full name: GAS's value if real, then the file name, then the resume text. */
export function resolveName(sheetName: string | null | undefined, fileName: string | null | undefined, text: string | null | undefined): string | null {
  if (sheetName && isRealName(tidyName(sheetName))) return tidyName(sheetName);
  // "Shabana Java", "Rashmi Sr." — a first name plus a job word: keep the
  // first name only if the file name or resume gives the full name.
  return nameFromFileName(fileName) ?? nameFromText(text);
}

const TITLE_WORDS =
  /\b(developer|engineer|consultant|analyst|architect|manager|lead|administrator|admin|tester|designer|specialist|scientist|programmer|director|coordinator|owner|master|recruiter|accountant|associate|officer)\b/i;

/** Job title: GAS's value if usable, else a title-like line near the top of the resume. */
export function resolveTitle(sheetTitle: string | null | undefined, text: string | null | undefined): string | null {
  const clean = (t: string) => collapse(t.replace(/[|•·]+/g, " ").replace(/^(title|role|position|designation)\s*[:\-]\s*/i, ""));
  if (sheetTitle) {
    const t = clean(sheetTitle.split(/[\n;]/)[0]);
    if (t.length >= 3 && t.length <= 70 && !/@/.test(t)) return t;
  }
  if (!text) return null;
  for (const line of text.split(/\r?\n/).map(clean).filter(Boolean).slice(0, 20)) {
    if (line.length <= 70 && TITLE_WORDS.test(line) && !/@|\d{5,}/.test(line) && !/^(summary|objective)/i.test(line)) return line;
  }
  return null;
}

const SECTION_SIGNALS =
  /\b(experience|employment|work history|education|skills|projects?|certifications?|responsibilities|professional summary|qualifications|technical skills)\b/gi;

export type ResumeCheck = { ok: true } | { ok: false; reason: string };

/**
 * Is this text a real resume? Enough content, at least two resume sections,
 * and a way to reach the person (email or phone). Files the GAS team already
 * verified ("live") only need readable text.
 */
export function checkResumeText(text: string | null | undefined, opts: { verified: boolean }): ResumeCheck {
  const t = text?.trim() ?? "";
  if (t.length < 200) return { ok: false, reason: "no readable text" };
  if (opts.verified) return { ok: true };
  if (t.length < 600) return { ok: false, reason: "too short for a resume" };
  const sections = new Set((t.match(SECTION_SIGNALS) ?? []).map((s) => s.toLowerCase().replace(/s$/, "")));
  if (sections.size < 2) return { ok: false, reason: "no resume sections" };
  const hasContact = /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) || /\+?\d[\d\s().-]{8,}\d/.test(t);
  if (!hasContact) return { ok: false, reason: "no contact details" };
  return { ok: true };
}

/** "Jane Smith - Senior Java Developer.pdf", safe for storage and downloads. */
export function repositoryFileName(name: string, title: string | null, ext: string): string {
  const safe = (s: string) => collapse(s.replace(/[\\/:*?"<>|#%{}^~[\]`]+/g, " ")).slice(0, 80);
  const base = title ? `${safe(name)} - ${safe(title)}` : safe(name);
  return `${base}.${ext.replace(/^\./, "").toLowerCase()}`;
}
