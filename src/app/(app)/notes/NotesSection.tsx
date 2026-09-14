"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addNote, updateNote, deleteNote, listNotes, type NoteModule } from "./actions";
import { formatDateTime } from "@/lib/format";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
          {notes.map((note) =>
            editingId === note.id ? (
              <li key={note.id} className="text-sm">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={2}
                  autoFocus
                  className="w-full rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/15 dark:bg-transparent"
                />
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit || !editBody.trim()}
                    className="rounded-md bg-black px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  >
                    {savingEdit ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-black/15 px-2 py-1 text-xs dark:border-white/15"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li key={note.id} className="text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap">{note.body}</p>
                  {note.userId === currentUserId && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => startEdit(note)}
                        className="text-xs text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        disabled={deletingId === note.id}
                        onClick={() => {
                          if (deletingId) return;
                          setDeletingId(note.id);
                          startTransition(async () => {
                            try {
                              await deleteNote(note.id);
                              refresh();
                            } finally {
                              setDeletingId(null);
                            }
                          });
                        }}
                        className="text-xs text-black/40 hover:text-red-600 disabled:opacity-40 dark:text-white/40"
                      >
                        {deletingId === note.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-black/40 dark:text-white/40">
                  {note.user.name} ·{" "}
                  {formatDateTime(note.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone)}
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
