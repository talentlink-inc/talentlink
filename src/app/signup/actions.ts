"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  hasRootDomainConfigured,
  rootDomain,
  isLocalDevHost,
  isReservedSubdomain,
  isValidSubdomainFormat,
} from "@/lib/subdomain";

export type SignupFormState = { error: string | null };

const signupSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Workspace address must be at least 3 characters")
    .max(63, "Workspace address must be at most 63 characters"),
  name: z.string().trim().min(1, "Your name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signUp(
  _prevState: SignupFormState,
  formData: FormData
): Promise<SignupFormState> {
  const host = (await headers()).get("host");

  // Mirrors the gate in signup/page.tsx — a direct POST to this action
  // (bypassing the UI) shouldn't be able to create tenants before the
  // platform is actually ready to route to them.
  if (!hasRootDomainConfigured() && !isLocalDevHost(host)) {
    return { error: "Sign-up isn't open yet." };
  }

  const parsed = signupSchema.safeParse({
    companyName: formData.get("companyName"),
    subdomain: formData.get("subdomain"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  if (!isValidSubdomainFormat(data.subdomain)) {
    return {
      error:
        "Workspace address can only contain lowercase letters, numbers, and hyphens, and can't start or end with a hyphen.",
    };
  }
  if (isReservedSubdomain(data.subdomain)) {
    return { error: `"${data.subdomain}" is reserved — please choose another workspace address.` };
  }

  const existingTenant = await prisma.tenant.findUnique({ where: { subdomain: data.subdomain } });
  if (existingTenant) {
    return { error: `"${data.subdomain}" is already taken — please choose another workspace address.` };
  }

  // Mirrors the admin-created-user path in (app)/users/actions.ts: create the
  // Supabase Auth identity first (most likely failure point — email already
  // registered globally), then the Tenant + first User row together, rolling
  // back the auth user if that second step fails for any reason.
  const { data: authData, error: authError } = await getSupabaseAdmin().auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    return { error: authError?.message ?? "Failed to create your login account." };
  }
  const authUserId = authData.user.id;

  let tenantSubdomain: string;
  try {
    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: { name: data.companyName, subdomain: data.subdomain, plan: "trial", status: "active" },
      });
      // The users table's RLS policy requires tenant_id to match
      // app.tenant_id on insert (see the RLS migration) — set it to the
      // tenant just created, in this same transaction, before the insert.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${newTenant.id}, true)`;
      await tx.user.create({
        data: {
          tenantId: newTenant.id,
          authUserId,
          name: data.name,
          email: data.email,
          role: "Admin",
          status: "active",
        },
      });
      return newTenant;
    });
    tenantSubdomain = tenant.subdomain;
  } catch (err) {
    await getSupabaseAdmin().auth.admin.deleteUser(authUserId).catch(() => {});
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: `"${data.subdomain}" was just taken — please choose another workspace address.` };
    }
    throw err;
  }

  // Session cookies are host-scoped and this form may be served from the bare
  // root domain (or a different tenant's subdomain) — rather than fight
  // cross-subdomain cookie config, send them to their own new subdomain's
  // login page to complete one normal sign-in there.
  const hostname = host?.split(":")[0] ?? "";
  const port = host?.split(":")[1];
  let destination: string;
  if (isLocalDevHost(host)) {
    destination = `http://${tenantSubdomain}.localhost${port ? `:${port}` : ""}/login?signup=1`;
  } else if (hasRootDomainConfigured()) {
    destination = `https://${tenantSubdomain}.${rootDomain()}/login?signup=1`;
  } else {
    destination = "/login?signup=1";
  }

  redirect(destination);
}
