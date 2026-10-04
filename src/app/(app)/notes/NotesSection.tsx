"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addNote, updateNote, deleteNote, listNotes, type NoteModule } from "./actions";
import { formatDateTime } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { useUi } from "@/components/ui/UiProvider";
import { toolbarInputClass } from "@/components/ui/table";

type Note = Awaited<ReturnType<typeof listNotes>>[number];

export function NotesSection({
  module,
  recordId,
  currentUserId,
}: {
  module: NoteModule;
  recordId: string;
  currentUserId: string;
}) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const { confirm, toast } = useUi();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [, startTransition] = useTransition();

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditBody(note.body);
  }
  function saveEdit() {
    if (!editingId || !editBody.trim()) return;
    setSavingEdit(true);
    startTransition(async () => {
      try {
        await updateNote(editingId, editBody);
        setEditingId(null);
        refresh();
      } finally {
        setSavingEdit(false);
      }
    });
  }

  const boundAddNote = addNote.bind(null, module, recordId);
  const [error, formAction, pending] = useActionState(boundAddNote, null);

  const refresh = () => {
    startTransition(async () => {
      setNotes(await listNotes(module, recordId));
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, recordId]);

  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !error) refresh();
    wasPending.current = pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, error]);

  // Notes are hard-deleted, so deleting asks first (in the shared dialog).
  function askDelete(note: Note) {
    confirm({
      title: "Delete this note?",
      body: "This can't be undone.",
      action: async () => {
        await deleteNote(note.id);
        refresh();
        toast({ message: "Note deleted", tone: "success" });
      },
    });
  }

  const linkButton = "text-xs font-medium text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white";

  return (
    <div>
      <form action={formAction} className="mb-4 flex gap-2">
        <input name="body" aria-label="Add a note" placeholder="Add a note…" className={`${toolbarInputClass} min-w-0 flex-1`} />
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {notes === null ? (
        <ul className="space-y-4" aria-label="Loading notes">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <div className="tl-skeleton h-3.5 w-4/5" />
              <div className="tl-skeleton mt-2 h-3 w-1/3" />
            </li>
          ))}
        </ul>
      ) : notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 px-4 py-6 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
          No notes yet — add the first one above.
        </p>
      ) : (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {notes.map((note) =>
            editingId === note.id ? (
              <li key={note.id} className="py-3 text-sm">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={3}
                  autoFocus
                  aria-label="Edit note"
                  className={`${toolbarInputClass} w-full`}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingId(null)} className={buttonClass("secondary", "sm")}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={savingEdit || !editBody.trim()}
                    className={buttonClass("primary", "sm")}
                  >
                    {savingEdit ? "Saving…" : "Save"}
                  </button>
                </div>
              </li>
            ) : (
              <li key={note.id} className="py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words whitespace-pre-wrap">{note.body}</p>
                  {(note.userId === currentUserId || note.canDelete) && (
                    <div className="flex shrink-0 items-center gap-3">
                      {note.userId === currentUserId && (
                        <button type="button" onClick={() => startEdit(note)} className={linkButton}>
                          Edit
                        </button>
                      )}
                      {note.canDelete && (
                        <button type="button" onClick={() => askDelete(note)} className={`${linkButton} hover:text-red-600`}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-black/45 dark:text-white/45">
                  {note.user.name} · {formatDateTime(note.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}
                  {note.updatedAt.getTime() !== note.createdAt.getTime() && " (edited)"}
                </p>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
