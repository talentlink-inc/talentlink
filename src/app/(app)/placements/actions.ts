"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTenantDb } from "@/lib/tenantDb";
import { getCurrentTenant } from "@/lib/tenant";
import { getCurrentUser } from "@/lib/auth";
import {
  isRejectedStatus,
  isQualifyingPlacementStatus,
  shouldClearPlacementId,
} from "@/lib/recruitment";
import { canManageRecruitment } from "@/lib/users";

export type PlacementFormState = { error: string | null };
const initialState: PlacementFormState = { error: null };

const placementSchema = z.object({
  status: z.string().trim().min(1),
  doj: z.string().trim().optional(),
  billRate: z.coerce.number().optional().nullable(),
  payRate: z.coerce.number().optional().nullable(),
  commission: z.coerce.number().optional().nullable(),
  salesBy: z.string().trim().optional(),
  rejectReason: z.string().trim().optional(),
});

export async function updatePlacement(
  id: string,
  _prevState: PlacementFormState,
  formData: FormData
): Promise<PlacementFormState> {
  const currentUser = await getCurrentUser();
  if (!canManageRecruitment(currentUser.role)) {
    return { error: "Your role only has view access to Placements." };
  }

  const parsed = placementSchema.safeParse({
    status: formData.get("status"),
    doj: formData.get("doj") || undefined,
    billRate: formData.get("billRate") || null,
    payRate: formData.get("payRate") || null,
    commission: formData.get("commission") || null,
    salesBy: formData.get("salesBy") || undefined,
    rejectReason: formData.get("rejectReason") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  if (isRejectedStatus(data.status) && !data.rejectReason) {
    return { error: "A reject reason is required for this status." };
  }

  const tenant = await getCurrentTenant();
  const db = await getTenantDb();
  const existing = await db.submission.findUnique({ where: { id, tenantId: tenant.id } });
  if (!existing) return { error: "Placement not found." };

  const clearPlacement = shouldClearPlacementId(data.status, !!existing.placementId);
  const assignPlacement = isQualifyingPlacementStatus(data.status) && !existing.placementId;

  let placementId = existing.placementId;
  if (clearPlacement) {
    placementId = null;
  } else if (assignPlacement) {
    const count = await db.submission.count({
      where: { tenantId: tenant.id, placementId: { not: null } },
    });
    placementId = `PLC-${String(count + 1).padStart(4, "0")}`;
  }

  await db.submission.update({
    where: { id, tenantId: tenant.id },
    data: {
      status: data.status,
      doj: data.doj ? new Date(data.doj) : null,
      billRate: data.billRate ?? null,
      payRate: data.payRate ?? null,
      commission: data.commission ?? null,
      salesBy: data.salesBy || null,
      rejectReason: isRejectedStatus(data.status) ? data.rejectReason : null,
      placementId,
      selectedDate: assignPlacement && !existing.selectedDate ? new Date() : existing.selectedDate,
    },
  });

  revalidatePath("/placements");
  revalidatePath("/submissions");
  return initialState;
}
