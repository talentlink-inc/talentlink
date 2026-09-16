"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Plus, Pencil, RefreshCw } from "lucide-react";
import { TEST_CATEGORIES } from "@/lib/testManifest";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  createTestCase,
  updateTestCase,
  deleteTestCase,
  runTestCases,
  runCategory,
  dispatchCiRun,
  type TestCaseInput,
} from "./actions";
import type { SerializedTestCase, SerializedCiSnapshot, SerializedRunBatch } from "./types";

const SANITY_MODELS = ["requirement", "submission", "interview", "candidate", "user"] as const;
const SANITY_ALLOWED_FIELDS: Record<string, string[]> = {
  requirement: ["status"],
  submission: ["status"],
  interview: ["status"],
  candidate: [],
  user: ["role", "status"],
};

function StatusPill({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/50 dark:bg-white/10 dark:text-white/50">
        Never run
      </span>
    );
  }
  const styles: Record<string, string> = {
    pass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    fail: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    error: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.error}`}>
      {status === "pass" ? "Passing" : status === "fail" ? "Failing" : "Error"}
    </span>
  );
}

export function TestSuiteBoard({
  initialTestCases,
  initialCiSnapshots,
  initialRecentRuns,
}: {
  initialTestCases: SerializedTestCase[];
  initialCiSnapshots: SerializedCiSnapshot[];
  initialRecentRuns: SerializedRunBatch[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedCategory, setSelectedCategory] = useState(TEST_CATEGORIES[0].key);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ mode: "create" | "edit"; category: string; testCase: SerializedTestCase | null } | null>(
    null
  );
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ciDispatching, setCiDispatching] = useState(false);

  const category = TEST_CATEGORIES.find((c) => c.key === selectedCategory)!;
  const testCasesInCategory = useMemo(
    () => initialTestCases.filter((tc) => tc.category === selectedCategory),
    [initialTestCases, selectedCategory]
  );
  const ciSnapshot = initialCiSnapshots.find((s) => s.category === selectedCategory) ?? null;
  const recentRunsInCategory = initialRecentRuns.filter((r) => r.scope === selectedCategory || r.scope === "all");

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runIds(ids: string[], scope: string) {
    if (ids.length === 0) return;
    setRunning(true);
    setFeedback(null);
    startTransition(async () => {
      const result = await runTestCases(ids, scope);
      setRunning(false);
      if (result.error) setFeedback(result.error);
      else setFeedback(`Ran ${result.results.length} test case(s): ${result.passCount} passed, ${result.failCount} failed.`);
      router.refresh();
    });
  }

  function runWholeCategory() {
    if (testCasesInCategory.length === 0) return;
    setRunning(true);
    setFeedback(null);
    startTransition(async () => {
      const result = await runCategory(selectedCategory);
      setRunning(false);
      if (result.error) setFeedback(result.error);
      else setFeedback(`Ran ${result.results.length} test case(s): ${result.passCount} passed, ${result.failCount} failed.`);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTestCase(id);
      if (result.error) setFeedback(result.error);
      router.refresh();
    });
  }

  function handleDispatchCi() {
    setCiDispatching(true);
    setFeedback(null);
    startTransition(async () => {
      const result = await dispatchCiRun();
      setCiDispatching(false);
      setFeedback(result.error ?? result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-56 sm:flex-col sm:overflow-visible">
        {TEST_CATEGORIES.map((c) => {
          const active = c.key === selectedCategory;
          const count =
            c.mode === "custom" ? initialTestCases.filter((tc) => tc.category === c.key).length : undefined;
          return (
            <button
              key={c.key}
              onClick={() => {
                setSelectedCategory(c.key);
                setSelectedIds(new Set());
                setFeedback(null);
              }}
              className={`flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap ${
                active
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <span>{c.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20" : "bg-black/10 dark:bg-white/10"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{category.label}</h2>
            <p className="text-sm text-black/50 dark:text-white/50">{category.description}</p>
          </div>
          {category.mode === "custom" && (
            <button
              onClick={() => setModal({ mode: "create", category: category.key, testCase: null })}
              className="flex shrink-0 items-center gap-1 rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black"
            >
              <Plus size={14} /> Add Test Case
            </button>
          )}
        </div>

        {feedback && (
          <div className="mb-3 rounded-md border border-black/10 bg-black/[0.03] px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.03]">
            {feedback}
          </div>
        )}

        {category.mode === "manual" && (
          <div className="rounded-lg border border-dashed border-black/15 p-6 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
            This category intentionally never runs from the live app — it throws real traffic at the app on
            purpose, and running that against production risks degrading it for real tenants. Run it from a
            CLI script (<code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">scripts/loadtest/</code>)
            against a staging or local target instead.
          </div>
        )}

        {category.mode === "code" && (
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            {ciSnapshot ? (
              <div>
                <div className="flex items-center gap-2">
                  <StatusPill status={ciSnapshot.status} />
                  <span className="text-sm">
                    {ciSnapshot.passCount}/{ciSnapshot.totalCount} passed
                  </span>
                </div>
                <p className="mt-2 text-xs text-black/50 dark:text-white/50">
                  Last updated {new Date(ciSnapshot.updatedAt).toLocaleString()}
                  {ciSnapshot.commitSha && ` · commit ${ciSnapshot.commitSha.slice(0, 7)}`}
                </p>
                {ciSnapshot.runUrl && (
                  <a
                    href={ciSnapshot.runUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View CI run →
                  </a>
                )}
                {ciSnapshot.details && ciSnapshot.details.length > 0 && (
                  <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-xs">
                    {ciSnapshot.details.map((d, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className={d.status === "passed" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                          {d.status === "passed" ? "✓" : "✗"}
                        </span>
                        <span className="truncate">{d.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-sm text-black/50 dark:text-white/50">
                No CI run has reported results for this category yet. Push to main, or trigger one below.
              </p>
            )}
            <button
              onClick={handleDispatchCi}
              disabled={ciDispatching}
              className="mt-4 flex items-center gap-1 rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
            >
              <RefreshCw size={14} className={ciDispatching ? "animate-spin" : ""} /> Trigger CI run
            </button>
          </div>
        )}

        {category.mode === "custom" && (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={() => runIds([...selectedIds], selectedCategory)}
                disabled={running || selectedIds.size === 0}
                className="flex items-center gap-1 rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/10"
              >
                <Play size={14} /> Run Selected ({selectedIds.size})
              </button>
              <button
                onClick={runWholeCategory}
                disabled={running || testCasesInCategory.length === 0}
                className="flex items-center gap-1 rounded-md bg-black px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black"
              >
                <Play size={14} /> Run All in {category.label}
              </button>
            </div>

            {testCasesInCategory.length === 0 ? (
              <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-sm text-black/50 dark:border-white/15 dark:text-white/50">
                No {category.label.toLowerCase()} test cases yet. Add one to get started.
              </p>
            ) : (
              <ul className="divide-y divide-black/5 rounded-lg border border-black/10 dark:divide-white/5 dark:border-white/10">
                {testCasesInCategory.map((tc) => (
                  <li key={tc.id} className="flex items-start gap-3 p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tc.id)}
                      onChange={() => toggleSelected(tc.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{tc.name}</span>
                        <StatusPill status={tc.lastRunStatus} />
                      </div>
                      {tc.description && <p className="text-xs text-black/50 dark:text-white/50">{tc.description}</p>}
                      {tc.lastRunMessage && (
                        <p className="mt-1 truncate text-xs text-black/40 dark:text-white/40" title={tc.lastRunMessage}>
                          {tc.lastRunMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => runIds([tc.id], selectedCategory)}
                        disabled={running}
                        title="Run this test case"
                        className="rounded-md p-1.5 hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
                      >
                        <Play size={14} />
                      </button>
                      <button
                        onClick={() => setModal({ mode: "edit", category: category.key, testCase: tc })}
                        title="Edit"
                        className="rounded-md p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <Pencil size={14} />
                      </button>
                      <ConfirmButton
                        onConfirm={() => handleDelete(tc.id)}
                        confirmText={`Delete test case "${tc.name}"?`}
                        label="Delete"
                        className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {recentRunsInCategory.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-1 text-xs font-semibold tracking-wide text-black/40 uppercase dark:text-white/40">
                  Recent runs
                </h3>
                <ul className="space-y-1 text-xs text-black/60 dark:text-white/60">
                  {recentRunsInCategory.map((r) => (
                    <li key={r.id}>
                      {new Date(r.startedAt).toLocaleString()} — {r.passCount} passed, {r.failCount} failed
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {modal && (
        <TestCaseModal
          mode={modal.mode}
          category={modal.category}
          testCase={modal.testCase}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TestCaseModal({
  mode,
  category,
  testCase,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  category: string;
  testCase: SerializedTestCase | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const kind = category === "sanity" ? "sanity" : "api";
  const [name, setName] = useState(testCase?.name ?? "");
  const [description, setDescription] = useState(testCase?.description ?? "");
  const [path, setPath] = useState(kind === "api" ? ((testCase?.definition as { path?: string })?.path ?? "/api/health") : "");
  const [expectedStatus, setExpectedStatus] = useState(
    kind === "api" ? ((testCase?.definition as { expectedStatus?: number })?.expectedStatus ?? 200) : 200
  );
  const [bodyContains, setBodyContains] = useState(
    kind === "api" ? ((testCase?.definition as { bodyContains?: string })?.bodyContains ?? "") : ""
  );
  const [model, setModel] = useState(
    kind === "sanity" ? ((testCase?.definition as { model?: string })?.model ?? SANITY_MODELS[0]) : SANITY_MODELS[0]
  );
  const [filterField, setFilterField] = useState(
    kind === "sanity" ? ((testCase?.definition as { filterField?: string })?.filterField ?? "") : ""
  );
  const [filterEquals, setFilterEquals] = useState(
    kind === "sanity" ? ((testCase?.definition as { filterEquals?: string })?.filterEquals ?? "") : ""
  );
  const [min, setMin] = useState(kind === "sanity" ? ((testCase?.definition as { min?: number })?.min ?? 0) : 0);
  const [max, setMax] = useState(kind === "sanity" ? ((testCase?.definition as { max?: number })?.max ?? 1000000) : 1000000);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const definition =
      kind === "api" ? { path, expectedStatus: Number(expectedStatus), bodyContains: bodyContains || undefined } : { model, filterField: filterField || undefined, filterEquals: filterEquals || undefined, min: Number(min), max: Number(max) };
    const input: TestCaseInput = { category: category as TestCaseInput["category"], kind, name, description: description || undefined, definition } as TestCaseInput;
    const result = mode === "create" ? await createTestCase(input) : await updateTestCase(testCase!.id, input);
    setSaving(false);
    if (result.error) setError(result.error);
    else onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 dark:bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? `New ${kind === "api" ? "API" : "Sanity"} Test Case` : `Edit ${testCase?.name}`}
          </h2>
          <button onClick={onClose} className="text-xl leading-none text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white">
            ×
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
            />
          </div>

          {kind === "api" ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">
                  Path (same-origin, must start with /api/, GET only)
                </label>
                <input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/api/health"
                  className="w-full rounded-md border border-black/15 px-3 py-2 font-mono text-sm dark:border-white/15 dark:bg-transparent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">Expected status code</label>
                <input
                  type="number"
                  value={expectedStatus}
                  onChange={(e) => setExpectedStatus(Number(e.target.value))}
                  className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">
                  Response body must contain (optional)
                </label>
                <input
                  value={bodyContains}
                  onChange={(e) => setBodyContains(e.target.value)}
                  className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">Model</label>
                <select
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setFilterField("");
                  }}
                  className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                >
                  {SANITY_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {SANITY_ALLOWED_FIELDS[model]?.length > 0 && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">Filter field (optional)</label>
                    <select
                      value={filterField}
                      onChange={(e) => setFilterField(e.target.value)}
                      className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                    >
                      <option value="">None (count all)</option>
                      {SANITY_ALLOWED_FIELDS[model].map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  {filterField && (
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">Equals</label>
                      <input
                        value={filterEquals}
                        onChange={(e) => setFilterEquals(e.target.value)}
                        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                      />
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">Min count</label>
                  <input
                    type="number"
                    value={min}
                    onChange={(e) => setMin(Number(e.target.value))}
                    className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-black/60 dark:text-white/60">Max count</label>
                  <input
                    type="number"
                    value={max}
                    onChange={(e) => setMax(Number(e.target.value))}
                    className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {saving ? "Saving…" : mode === "create" ? "Add Test Case" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
