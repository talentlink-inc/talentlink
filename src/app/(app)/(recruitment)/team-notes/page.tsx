import { getCurrentUser } from "@/lib/auth";
import { NotesSection } from "../../notes/NotesSection";

export const dynamic = "force-dynamic";

// GAS Recruitment "Notes" tab: a team-wide board, not tied to any one
// requirement/submission (those have their own notes threads).
export default async function RecruitmentNotesPage() {
  const user = await getCurrentUser();
  return (
    <div className="max-w-3xl rounded-lg border border-black/10 border-t-[3px] border-t-brand bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-950">
      <h2 className="text-base font-semibold">Team notes</h2>
      <p className="mt-0.5 mb-4 text-sm text-black/55 dark:text-white/55">
        Shared across Recruitment. Notes about a specific requirement, submission or interview live on that record.
      </p>
      <NotesSection module="recruitment_board" recordId="board" currentUserId={user.id} />
    </div>
  );
}
