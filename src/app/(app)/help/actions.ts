"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import { canManageUsers } from "@/lib/users";
import { sanitizeHelpHtml } from "@/lib/sanitizeRichText";

// GAS HelpContent.js: everyone signed in reads Active topics; only Admins
// add, edit, delete, reorder or deactivate them.
const ADMIN_ERROR = "Only Admins can manage Help Center topics.";

// savedId lets the page go straight back to the topic that was just saved.
export type HelpFormState = { error: string | null; savedId?: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) throw new Error(ADMIN_ERROR);
}

const topicSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().trim().min(1, "Content is required").max(50000),
  status: z.enum(["Active", "Inactive"]),
});

function parse(formData: FormData) {
  return topicSchema.safeParse({
    title: formData.get("title") ?? "",
    content: formData.get("content") ?? "",
    status: formData.get("status") || "Active",
  });
}

export async function createHelpTopic(_prev: HelpFormState, formData: FormData): Promise<HelpFormState> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) return { error: ADMIN_ERROR };
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const content = sanitizeHelpHtml(parsed.data.content);
  if (!content.replace(/<[^>]*>/g, "").trim()) return { error: "Content is required" };

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const last = await db.helpTopic.aggregate({ where: { tenantId: tenant.id }, _max: { sortOrder: true } });
  const created = await db.helpTopic.create({
    data: {
      tenantId: tenant.id,
      title: parsed.data.title,
      content,
      status: parsed.data.status,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath("/help");
  return { error: null, savedId: created.id };
}

export async function updateHelpTopic(id: string, _prev: HelpFormState, formData: FormData): Promise<HelpFormState> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) return { error: ADMIN_ERROR };
  const parsed = parse(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const content = sanitizeHelpHtml(parsed.data.content);
  if (!content.replace(/<[^>]*>/g, "").trim()) return { error: "Content is required" };

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.helpTopic.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) return { error: "Topic not found." };
  await db.helpTopic.update({
    where: { id, tenantId: tenant.id },
    data: { title: parsed.data.title, content, status: parsed.data.status },
  });
  revalidatePath("/help");
  return { error: null, savedId: id };
}

export async function deleteHelpTopic(id: string): Promise<{ error: string | null }> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) return { error: ADMIN_ERROR };
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.helpTopic.findFirst({ where: { id, tenantId: tenant.id } });
  if (!existing) return { error: "Topic not found." };
  await db.helpTopic.delete({ where: { id, tenantId: tenant.id } });
  revalidatePath("/help");
  return { error: null };
}

// GAS reorderHelpTopics: renumbers sortOrder from the full ordered id list.
export async function reorderHelpTopics(orderedIds: string[]): Promise<{ error: string | null }> {
  await requireAdmin();
  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const topics = await db.helpTopic.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
  const known = new Set(topics.map((t) => t.id));
  if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
    return { error: "The topic list changed — reload and try again." };
  }
  for (const [index, id] of orderedIds.entries()) {
    await db.helpTopic.update({ where: { id, tenantId: tenant.id }, data: { sortOrder: index + 1 } });
  }
  revalidatePath("/help");
  return { error: null };
}
