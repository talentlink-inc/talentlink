import { getCurrentUser } from "@/lib/auth";
import { NotesSection } from "../../notes/NotesSection";

export const dynamic = "force-dynamic";

// GAS Bench Sales "Notes" tab: a team-wide board for the module, not tied
// to any one consultant/submission (those have their own notes threads).
export default async function BenchNotesPage() {
  const user = await getCurrentUser();
  return (
    <div className="max-w-3xl">
      <p className="mb-2 text-sm text-black/60 dark:text-white/60">
        Team notes for Bench Sales. Notes about a specific consultant, submission or interview live on that record.
      </p>
      <NotesSection module="bench_board" recordId="board" currentUserId={user.id} />
    </div>
  );
}
