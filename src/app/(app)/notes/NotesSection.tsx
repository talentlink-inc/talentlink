"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addNote, deleteNote, listNotes, type NoteModule } from "./actions";

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
  const [, startTransition] = useTransition();

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

  return (
    <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/10">
      <h3 className="mb-3 text-sm font-semibold">Notes</h3>

      <form action={formAction} className="mb-4 flex gap-2">
        <input
          name="body"
          placeholder="Add a note…"
          className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Add
        </button>
      </form>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {notes === null ? (
        <p className="text-sm text-black/50 dark:text-white/50">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap">{note.body}</p>
                {(note.userId === currentUserId) && (
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await deleteNote(note.id);
                        refresh();
                      })
                    }
                    className="shrink-0 text-xs text-black/40 hover:text-red-600 dark:text-white/40"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-xs text-black/40 dark:text-white/40">
                {note.user.name} · {note.createdAt.toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
