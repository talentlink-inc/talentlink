"use client";

import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { createHelpTopic, updateHelpTopic, deleteHelpTopic, reorderHelpTopics } from "./actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { usePageShortcuts } from "@/lib/keyboardShortcuts";
import { PageHeader } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/button";
import { useUi } from "@/components/ui/UiProvider";
import { toolbarInputClass } from "@/components/ui/table";

type Topic = { id: string; title: string; content: string; status: string; sortOrder: number };

const inputClass = `${toolbarInputClass} w-full`;
const labelClass = "mb-1 block text-xs font-medium text-black/60 dark:text-white/60";
// Typography for the (sanitized) topic HTML — headings, paragraphs, lists.
const proseClass =
  "text-sm leading-relaxed [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:font-semibold [&_h4:first-child]:mt-0 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1";

// [label, button text, execCommand, value] — same contentEditable approach
// as the Requirement job-description editor, plus headings for help topics.
const EDITOR_TOOLS: [string, string, string, string | undefined][] = [
  ["Heading", "H", "formatBlock", "h4"],
  ["Paragraph", "¶", "formatBlock", "p"],
  ["Bold", "B", "bold", undefined],
  ["Italic", "I", "italic", undefined],
  ["Underline", "U", "underline", undefined],
  ["Bulleted list", "• List", "insertUnorderedList", undefined],
  ["Numbered list", "1. List", "insertOrderedList", undefined],
];

const plainText = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

export function HelpCenter({ topics, isAdmin }: { topics: Topic[]; isAdmin: boolean }) {
  const [activeId, setActiveId] = useState<string | null>(topics[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Topic | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { toast } = useUi();

  usePageShortcuts({
    onFocusSearch: () => searchRef.current?.focus(),
    onClearSearch: () => setSearch(""),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter((t) => `${t.title} ${plainText(t.content)}`.toLowerCase().includes(q));
  }, [topics, search]);

  const active = topics.find((t) => t.id === activeId) ?? filtered[0] ?? null;

  async function move(id: string, delta: -1 | 1) {
    const ids = topics.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setError(null);
    const result = await reorderHelpTopics(ids);
    if (result.error) setError(result.error);
  }

  if (editing) {
    return (
      <TopicEditor
        topic={editing === "new" ? null : editing}
        onDone={(savedId) => {
          setEditing(null);
          if (savedId) {
            // Back to the topic just saved, not wherever the list was.
            setSearch("");
            setActiveId(savedId);
            toast({ message: "Topic saved", tone: "success" });
          }
        }}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Help Center"
        subtitle="How TalentLink works, step by step"
        actions={
          isAdmin && (
            <button type="button" onClick={() => setEditing("new")} className={buttonClass("primary")}>
              + Add topic
            </button>
          )
        }
      />
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {topics.length === 0 ? (
        <p className="rounded-lg border border-black/10 bg-white p-8 text-center text-sm text-black/50 dark:border-white/10 dark:bg-neutral-950 dark:text-white/50">
          No help topics yet.{isAdmin ? " Add the first one with “+ Add topic”." : ""}
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <aside>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search help…"
              aria-label="Search help topics"
              className={`${inputClass} mb-3`}
            />
            <nav aria-label="Help topics">
              <ul className="space-y-0.5">
                {filtered.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(t.id)}
                      aria-current={active?.id === t.id ? "page" : undefined}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                        active?.id === t.id
                          ? "bg-brand-soft font-medium text-ink-strong shadow-[inset_3px_0_0] shadow-brand dark:bg-white/10 dark:text-white"
                          : "text-black/70 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/5"
                      }`}
                    >
                      {t.title}
                      {t.status !== "Active" && <span className="ml-1 text-xs text-black/40 dark:text-white/40">(inactive)</span>}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && <li className="px-3 py-2 text-sm text-black/50 dark:text-white/50">No topics match.</li>}
              </ul>
            </nav>
          </aside>

          {active && (
            <article className="min-w-0 rounded-lg border border-black/10 border-t-[3px] border-t-brand bg-white p-6 shadow-sm dark:border-white/10 dark:bg-neutral-950">
              <div className="mb-4 flex flex-wrap items-start gap-2">
                <h2 className="mr-auto text-lg font-semibold">{active.title}</h2>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => move(active.id, -1)} disabled={topics[0]?.id === active.id} className={buttonClass("secondary", "sm")} aria-label="Move topic up">
                      ↑
                    </button>
                    <button type="button" onClick={() => move(active.id, 1)} disabled={topics.at(-1)?.id === active.id} className={buttonClass("secondary", "sm")} aria-label="Move topic down">
                      ↓
                    </button>
                    <button type="button" onClick={() => setEditing(active)} className={buttonClass("secondary", "sm")}>
                      Edit
                    </button>
                    <ConfirmButton
                      label="Delete"
                      className={buttonClass("dangerSoft", "sm")}
                      confirmText={`Delete “${active.title}”?`}
                      body="Everyone loses this topic. This can't be undone."
                      onConfirm={async () => {
                        const result = await deleteHelpTopic(active.id);
                        if (result.error) throw new Error(result.error);
                        setActiveId(null);
                        toast({ message: "Topic deleted", tone: "success" });
                      }}
                    />
                  </div>
                )}
              </div>
              {/* Sanitized server-side with sanitizeHelpHtml (no attributes, no script). */}
              <div className={proseClass} dangerouslySetInnerHTML={{ __html: active.content }} />
            </article>
          )}
        </div>
      )}
    </div>
  );
}

function TopicEditor({ topic, onDone }: { topic: Topic | null; onDone: (savedId?: string) => void }) {
  const action = topic ? updateHelpTopic.bind(null, topic.id) : createHelpTopic;
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [content, setContent] = useState(topic?.content ?? "");
  const editorRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const statusId = useId();
  const wasSubmitting = useRef(false);

  // Seed the editable area once; after that the DOM is the source of truth.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = topic?.content ?? "";
  }, [topic]);
  useEffect(() => {
    if (wasSubmitting.current && !pending && !state.error) onDone(state.savedId ?? topic?.id);
    wasSubmitting.current = pending;
  }, [pending, state, onDone, topic]);

  const format = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setContent(editorRef.current?.innerHTML ?? "");
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title={topic ? `Edit “${topic.title}”` : "New help topic"} subtitle="Help Center" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          formData.set("content", editorRef.current?.innerHTML ?? content);
          startTransition(() => formAction(formData));
        }}
        className="grid gap-4 rounded-lg border border-black/10 bg-white p-6 shadow-sm sm:grid-cols-[1fr_240px] dark:border-white/10 dark:bg-neutral-950"
      >
        <div>
          <label htmlFor={titleId} className={labelClass}>
            Title *
          </label>
          <input id={titleId} name="title" defaultValue={topic?.title ?? ""} required maxLength={200} className={inputClass} />
        </div>
        <div>
          <label htmlFor={statusId} className={labelClass}>
            Status
          </label>
          <select id={statusId} name="status" defaultValue={topic?.status ?? "Active"} className={inputClass}>
            <option value="Active">Active (visible to everyone)</option>
            <option value="Inactive">Inactive (hidden)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <span className={labelClass} id={`${titleId}-content`}>
            Content *
          </span>
          <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-black/15 p-1 dark:border-white/15">
            {EDITOR_TOOLS.map(([label, text, command, value]) => (
              <button key={label} type="button" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={() => format(command, value)} className="rounded px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10">
                {text}
              </button>
            ))}
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-labelledby={`${titleId}-content`}
            onInput={(e) => setContent(e.currentTarget.innerHTML)}
            className={`min-h-[320px] rounded-b-md border border-black/15 p-4 outline-none focus:border-brand dark:border-white/15 ${proseClass}`}
          />
          <p className="mt-1 text-xs text-black/40 dark:text-white/40">Headings, bold/italic/underline and lists are kept; other formatting is removed when saved.</p>
        </div>

        {state.error && !pending && (
          <p role="alert" className="text-sm text-red-600 sm:col-span-2">
            {state.error}
          </p>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={() => onDone()} className={buttonClass("secondary")}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Saving…" : "Save topic"}
          </button>
        </div>
      </form>
    </div>
  );
}
