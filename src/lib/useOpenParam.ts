"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Lets global search results deep-link into a table's view modal via
// ?open=<id> — reads the param once on mount, hands the id to the caller,
// then strips it from the URL so a refresh doesn't reopen it.
export function useOpenParam(onOpen: (id: string) => void) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const id = searchParams.get("open");
    if (id) {
      onOpen(id);
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}
