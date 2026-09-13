import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

// Polled client-side (see Sidebar) to detect when a newer deployment has
// gone live — must never be cached, or every client would keep reading the
// version that was live when the response was first cached.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    { headers: { "Cache-Control": "no-store" } }
  );
}
