import type { Tenant } from "@/generated/prisma/client";

// Shared by JD-parsing (Requirements) and resume-parsing (Submissions) —
// both are "extract structured fields from pasted/uploaded text" calls
// against whichever provider the tenant configured in Settings. Groq is the
// default (fast, cheap, OpenAI-compatible chat completions API); Anthropic
// is the alternative. Nothing is called at all until an admin sets a key.

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI parsing isn't set up yet — add an API key in Settings.");
    this.name = "AiNotConfiguredError";
  }
}

// Asks the model for strict JSON and parses it — both Groq and Anthropic
// happily follow a "respond with only JSON" instruction, but neither
// guarantees it, so this strips code-fence wrapping before parsing rather
// than trusting the raw response.
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}

async function callGroq(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(apiKey: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// Returns parsed JSON from the model, or throws AiNotConfiguredError if the
// tenant hasn't set a key yet. Callers should catch AiNotConfiguredError
// specifically to show a friendly "set this up in Settings" message.
export async function callAiForJson(
  tenant: Pick<Tenant, "aiProvider" | "aiApiKey">,
  system: string,
  user: string
): Promise<unknown> {
  if (!tenant.aiApiKey) throw new AiNotConfiguredError();

  const raw =
    tenant.aiProvider === "anthropic"
      ? await callAnthropic(tenant.aiApiKey, system, user)
      : await callGroq(tenant.aiApiKey, system, user);

  try {
    return extractJson(raw);
  } catch {
    throw new Error("AI response wasn't valid JSON — try again.");
  }
}
