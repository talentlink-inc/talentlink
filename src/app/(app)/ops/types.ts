import type { Tenant } from "@/generated/prisma/client";

export type TenantWithStats = Tenant & { userCount: number };
