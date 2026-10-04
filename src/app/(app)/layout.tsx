import { getCurrentUser } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { canViewUsers, canManageUsers, canAccessBench } from "@/lib/users";
import { isPlatformAdmin } from "@/lib/platformAdmin";
import { ShortcutsProvider } from "@/lib/keyboardShortcuts";
import { UiProvider } from "@/components/ui/UiProvider";
import { APP_VERSION } from "@/lib/version";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { KeyboardShortcutsModal } from "@/components/shell/KeyboardShortcutsModal";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();
  const tenant = await getCurrentTenant();
  const canAccessOps = await isPlatformAdmin();

  return (
    <ShortcutsProvider>
      <UiProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          canManageUsers={canViewUsers(currentUser.role)}
          canManageSettings={canManageUsers(currentUser.role)}
          canAccessTestSuite={canManageUsers(currentUser.role)}
          canAccessOps={canAccessOps}
          canAccessBench={canAccessBench(currentUser.role)}
          tenantName={tenant.name}
          logoStyle={tenant.logoStyle}
          appVersion={APP_VERSION}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }} />
          <main className="flex-1 overflow-y-auto bg-neutral-50 px-4 py-6 md:px-6 md:py-8 dark:bg-neutral-950">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
      <KeyboardShortcutsModal />
      </UiProvider>
    </ShortcutsProvider>
  );
}
