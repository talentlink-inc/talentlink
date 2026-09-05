import { getCurrentTenant } from "@/lib/tenant";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const tenant = await getCurrentTenant();

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <LoginForm tenantName={tenant.name} />
    </div>
  );
}
