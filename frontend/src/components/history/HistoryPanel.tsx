import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";

// List query fetches metadata only — NOT `project_state` or code (can be many MB).
// Those are fetched on-demand when the user clicks an item.
interface Generation {
  id: number;
  created_at: string;
  prompt?: string;
  title?: string;
  notes?: string; // optional — requires `notes TEXT` column in generations table
  aesthetic_mode?: string;
}

interface Props {
  session: any;
  onLoadState: (projectState: any, code: string | undefined, rowId?: number, title?: string, notes?: string) => void;
  onLoadStoryboard: (storyboard: any) => void;
  onClose: () => void;
  onExpand?: () => void;
  isExpanded?: boolean;
  refreshTrigger?: number;
}

/** Parse "[Full Project: N screens] Project Name" prompt format. */
function parseFPPrompt(prompt: string | undefined): { isFP: boolean; screenCount: number; projectName: string } {
  if (!prompt) return { isFP: false, screenCount: 0, projectName: "" };
  const m = prompt.match(/^\[Full Project(?:: (\d+) screens)?\]\s*(.*)$/i);
  if (!m) return { isFP: false, screenCount: 0, projectName: "" };
  return {
    isFP: true,
    screenCount: m[1] ? parseInt(m[1], 10) : 0,
    projectName: m[2]?.trim() || "Full Project",
  };
}

function StoryboardIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 4H4a1 1 0 00-1 1v14a1 1 0 001 1h16a1 1 0 001-1V5a1 1 0 00-1-1h-3M9 4h6M9 9h6M9 13h4" />
    </svg>
  );
}

function FullProjectIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
    </svg>
  );
}

interface DeleteConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}

function DeleteConfirm({ onConfirm, onCancel, deleting }: DeleteConfirmProps) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2">
      <span className="text-xs text-red-400 font-medium flex-1">Delete this entry?</span>
      <button
        onClick={onConfirm}
        disabled={deleting}
        className="rounded-md px-3 py-1 text-xs font-semibold bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 transition"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
      <button
        onClick={onCancel}
        disabled={deleting}
        className="rounded-md px-3 py-1 text-xs font-semibold bg-stone-700 text-stone-300 hover:bg-stone-600 disabled:opacity-50 transition"
      >
        Cancel
      </button>
    </div>
  );
}

interface InlineEditProps {
  value: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  placeholder?: string;
}

function InlineEdit({ value, onSave, onCancel, placeholder }: InlineEditProps) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onSave(v.trim() || value); }
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 rounded border border-stone-600 bg-stone-800 px-2 py-0.5 text-xs text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none min-w-0"
      />
      <button
        onClick={() => onSave(v.trim() || value)}
        className="rounded px-1.5 py-0.5 text-[10px] bg-amber-600 text-white hover:bg-amber-500 font-mono transition"
      >✓</button>
      <button
        onClick={onCancel}
        className="rounded px-1.5 py-0.5 text-[10px] bg-stone-700 text-stone-300 hover:bg-stone-600 font-mono transition"
      >✕</button>
    </div>
  );
}

interface NotesEditorProps {
  value: string;
  onSave: (val: string) => void;
  onCancel: () => void;
}

function NotesEditor({ value, onSave, onCancel }: NotesEditorProps) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
      <textarea
        ref={ref}
        value={v}
        onChange={(e) => setV(e.target.value)}
        rows={3}
        placeholder="Add notes or details…"
        className="w-full rounded border border-stone-600 bg-stone-800 px-2 py-1.5 text-xs text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none resize-none"
      />
      <div className="flex gap-1.5">
        <button
          onClick={() => onSave(v)}
          className="flex-1 rounded py-1 text-[10px] bg-amber-600 text-white hover:bg-amber-500 font-mono transition"
        >Save</button>
        <button
          onClick={onCancel}
          className="flex-1 rounded py-1 text-[10px] bg-stone-700 text-stone-300 hover:bg-stone-600 font-mono transition"
        >Cancel</button>
      </div>
    </div>
  );
}

export default function HistoryPanel({ session, onLoadState, onLoadStoryboard, onClose, onExpand, isExpanded, refreshTrigger }: Props) {
  const [history, setHistory] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [notesId, setNotesId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (session?.user?.id) fetchHistory();
  }, [session?.user?.id, refreshTrigger]);

  const fetchHistory = async () => {
    if (!session?.user?.id) return;
    setLoading(true);

    // Select metadata columns — project_state / code are fetched on demand.
    const { data, error } = await supabase
      .from("generations")
      .select("id, created_at, prompt, title, notes, aesthetic_mode")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("History load error:", error);
      toast.error("Failed to load history");
    } else {
      setHistory(data || []);
    }

    setLoading(false);
  };

  const handleLoad = async (item: Generation, displayLabel: string) => {
    setLoadingItemId(item.id);
    try {
      // Fetch the full row on demand — acceptable for a single row click
      const { data: codeRow, error: codeErr } = await supabase
        .from("generations")
        .select("*")
        .eq("id", item.id)
        .maybeSingle();

      if (codeErr) console.error("Code fetch error:", codeErr);

      const raw = codeRow?.code || codeRow?.generated_code || "";

      if (item.aesthetic_mode === "gaming_storyboard") {
        if (!raw) {
          toast.error("Storyboard data not found.");
          return;
        }
        try {
          const storyboard = JSON.parse(raw);
          onLoadStoryboard({ ...storyboard, _dbId: item.id });
          toast.success(`Loaded: ${displayLabel}`);
        } catch {
          toast.error("Could not parse storyboard data.");
        }
        return;
      }

      // project_state is in the full row (codeRow), not the list item
      if (codeRow?.project_state || raw) {
        onLoadState(codeRow?.project_state, raw || "", item.id, item.title, item.notes);
        toast.success(`Loaded: ${displayLabel}`);
      } else {
        toast.error("This history item has no content.");
      }
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!session?.user?.id) return;
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("generations")
        .delete()
        .eq("id", id)
        .eq("user_id", session.user.id);
      if (error) {
        console.error("Delete error:", error);
        toast.error("Failed to delete history entry");
      } else {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        toast.success("History entry deleted");
      }
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleRename = async (id: number, newTitle: string) => {
    const { error } = await supabase
      .from("generations")
      .update({ title: newTitle })
      .eq("id", id);
    if (error) {
      toast.error("Failed to rename");
    } else {
      setHistory((prev) => prev.map((item) => item.id === id ? { ...item, title: newTitle } : item));
      toast.success("Renamed");
    }
    setRenamingId(null);
  };

  const handleSaveNotes = async (id: number, notes: string) => {
    try {
      const { error } = await supabase
        .from("generations")
        .update({ notes })
        .eq("id", id);
      if (error) {
        // Column may not exist yet — store locally only
        console.warn("Notes column not available:", error.message);
        setHistory((prev) => prev.map((item) => item.id === id ? { ...item, notes } : item));
        toast.success("Notes saved (local only — add a `notes TEXT` column to persist)");
      } else {
        setHistory((prev) => prev.map((item) => item.id === id ? { ...item, notes } : item));
        toast.success("Notes saved");
      }
    } catch (e) {
      console.error("Notes save error:", e);
    }
    setNotesId(null);
  };

  // Filter history based on search query
  const filteredHistory = searchQuery.trim()
    ? history.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          (item.title || "").toLowerCase().includes(q) ||
          (item.prompt || "").toLowerCase().includes(q) ||
          (item.notes || "").toLowerCase().includes(q)
        );
      })
    : history;

  return (
    <div className="flex h-full flex-col border-r border-stone-800 bg-stone-950 text-stone-300 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800 p-4 shrink-0">
        <h2 className="text-base font-bold font-mono uppercase tracking-wide text-white">History</h2>
        <div className="flex items-center gap-1">
          {!isExpanded && onExpand && (
            <button
              onClick={onExpand}
              className="rounded p-1 text-stone-500 hover:bg-stone-800 hover:text-white"
              title="Expand to full page"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-stone-500 hover:bg-stone-800 hover:text-white"
            title={isExpanded ? "Collapse history" : "Close history"}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-stone-800 shrink-0">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history…"
            className="w-full rounded border border-stone-700 bg-stone-900 pl-8 pr-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:border-amber-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* History list — always single-column, one row per entry */}
      <div className="flex-1 overflow-y-scroll p-2 space-y-2">
        {loading && (
          <p className="p-4 text-center text-sm text-stone-500 font-mono">Loading…</p>
        )}

        {!loading && history.length === 0 && (
          <p className="p-4 text-center text-sm text-stone-500 font-mono">No history yet.</p>
        )}

        {!loading && history.length > 0 && filteredHistory.length === 0 && (
          <p className="p-4 text-center text-sm text-stone-500 font-mono">No results for &quot;{searchQuery}&quot;</p>
        )}

        {filteredHistory.map((item) => {
          const versionNumber = history.length - history.indexOf(item);
          const isStoryboard = item.aesthetic_mode === "gaming_storyboard";
          const { isFP, screenCount, projectName } = parseFPPrompt(item.prompt);

          // Compute display label
          let label: string;
          if (item.title) {
            label = item.title;
          } else if (isFP) {
            label = projectName;
          } else {
            label = item.prompt?.slice(0, 60) || `Version #${versionNumber}`;
          }

          const date = new Date(item.created_at).toLocaleDateString(undefined, {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          });
          const isLoadingThis = loadingItemId === item.id;
          const isConfirmingDelete = confirmDeleteId === item.id;
          const isDeletingThis = deletingId === item.id;
          const isRenamingThis = renamingId === item.id;
          const isEditingNotesThis = notesId === item.id;

          const actionButtons = (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setRenamingId(isRenamingThis ? null : item.id); setNotesId(null); setConfirmDeleteId(null); }}
                disabled={loadingItemId !== null || isDeletingThis}
                className="rounded-md p-1.5 text-stone-500 hover:bg-stone-700 hover:text-amber-400 transition disabled:opacity-40"
                title="Rename"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setNotesId(isEditingNotesThis ? null : item.id); setRenamingId(null); setConfirmDeleteId(null); }}
                disabled={loadingItemId !== null || isDeletingThis}
                className="rounded-md p-1.5 text-stone-500 hover:bg-stone-700 hover:text-blue-400 transition disabled:opacity-40"
                title="Notes"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M9 16h4M7 4H4a1 1 0 00-1 1v14a1 1 0 001 1h16a1 1 0 001-1V5a1 1 0 00-1-1h-3l-2-2H9L7 4z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(isConfirmingDelete ? null : item.id); setRenamingId(null); setNotesId(null); }}
                disabled={loadingItemId !== null || isDeletingThis}
                className="rounded-md p-1.5 text-stone-500 hover:bg-stone-700 hover:text-red-400 transition disabled:opacity-40"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 011-1h4a1 1 0 011 1m-7 0H5m14 0h-2" />
                </svg>
              </button>
            </div>
          );

          if (isStoryboard) {
            return (
              <div key={item.id} className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 transition-all hover:border-emerald-700/60 hover:bg-emerald-900/20">
                {/* Top row: title + action buttons */}
                <div className="flex items-center gap-1 px-3 pt-2.5 pb-1">
                  <button
                    onClick={() => handleLoad(item, label)}
                    disabled={loadingItemId !== null || isDeletingThis}
                    className="flex-1 text-left disabled:opacity-60 min-w-0"
                  >
                    {isRenamingThis ? (
                      <InlineEdit value={item.title || label} onSave={(v) => handleRename(item.id, v)} onCancel={() => setRenamingId(null)} placeholder="Enter title…" />
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-emerald-500 shrink-0"><StoryboardIcon /></span>
                        <span className={`text-sm font-semibold text-emerald-300 ${isExpanded ? '' : 'truncate'}`}>{isLoadingThis ? "Loading…" : label}</span>
                        <span className="ml-1 text-[9px] font-mono text-emerald-500 bg-emerald-950/50 border border-emerald-800/40 px-1.5 py-0.5 rounded shrink-0">SB</span>
                      </div>
                    )}
                  </button>
                  {actionButtons}
                </div>
                {/* Bottom row: notes (small) + date */}
                {!isRenamingThis && (
                  <div className="flex items-center justify-between px-3 pb-2 gap-2">
                    <span className={`text-[10px] text-stone-500 italic truncate ${isExpanded ? 'max-w-none' : 'max-w-[160px]'}`}>
                      {item.notes || ""}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono shrink-0">{date}</span>
                  </div>
                )}
                {isEditingNotesThis && (
                  <div className="px-3 pb-3">
                    <NotesEditor value={item.notes || ""} onSave={(v) => handleSaveNotes(item.id, v)} onCancel={() => setNotesId(null)} />
                  </div>
                )}
                {isConfirmingDelete && (
                  <div className="px-3 pb-3">
                    <DeleteConfirm onConfirm={() => handleDelete(item.id)} onCancel={() => setConfirmDeleteId(null)} deleting={isDeletingThis} />
                  </div>
                )}
              </div>
            );
          }

          if (isFP) {
            return (
              <div key={item.id} className="rounded-lg border border-violet-800/40 bg-violet-950/20 transition-all hover:border-violet-700/60 hover:bg-violet-900/20">
                {/* Top row: title + action buttons */}
                <div className="flex items-center gap-1 px-3 pt-2.5 pb-1">
                  <button
                    onClick={() => handleLoad(item, label)}
                    disabled={loadingItemId !== null || isDeletingThis}
                    className="flex-1 text-left disabled:opacity-60 min-w-0"
                  >
                    {isRenamingThis ? (
                      <InlineEdit value={item.title || label} onSave={(v) => handleRename(item.id, v)} onCancel={() => setRenamingId(null)} placeholder="Enter title…" />
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-violet-400 shrink-0"><FullProjectIcon /></span>
                        <span className={`text-sm font-semibold text-violet-200 ${isExpanded ? '' : 'truncate'}`}>{isLoadingThis ? "Loading…" : label}</span>
                        {screenCount > 0 && (
                          <span className="text-[9px] font-mono text-violet-400 bg-violet-950/50 border border-violet-800/40 px-1.5 py-0.5 rounded shrink-0">{screenCount}p</span>
                        )}
                      </div>
                    )}
                  </button>
                  {actionButtons}
                </div>
                {/* Bottom row: notes (small) + date */}
                {!isRenamingThis && (
                  <div className="flex items-center justify-between px-3 pb-2 gap-2">
                    <span className={`text-[10px] text-stone-500 italic truncate ${isExpanded ? 'max-w-none' : 'max-w-[160px]'}`}>
                      {item.notes || ""}
                    </span>
                    <span className="text-[10px] text-stone-500 font-mono shrink-0">{date}</span>
                  </div>
                )}
                {isEditingNotesThis && (
                  <div className="px-3 pb-3">
                    <NotesEditor value={item.notes || ""} onSave={(v) => handleSaveNotes(item.id, v)} onCancel={() => setNotesId(null)} />
                  </div>
                )}
                {isConfirmingDelete && (
                  <div className="px-3 pb-3">
                    <DeleteConfirm onConfirm={() => handleDelete(item.id)} onCancel={() => setConfirmDeleteId(null)} deleting={isDeletingThis} />
                  </div>
                )}
              </div>
            );
          }

          // Single-page generation
          return (
            <div key={item.id} className="rounded-lg border border-stone-800 bg-stone-900/40 transition-all hover:border-stone-700 hover:bg-stone-900/70">
              {/* Top row: title + action buttons */}
              <div className="flex items-center gap-1 px-3 pt-2.5 pb-1">
                <button
                  onClick={() => handleLoad(item, label)}
                  disabled={loadingItemId !== null || isDeletingThis}
                  className="flex-1 text-left disabled:opacity-60 min-w-0"
                >
                  {isRenamingThis ? (
                    <InlineEdit value={item.title || label} onSave={(v) => handleRename(item.id, v)} onCancel={() => setRenamingId(null)} placeholder="Enter title…" />
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-500 shrink-0" />
                      <span className={`text-sm font-semibold text-stone-200 ${isExpanded ? '' : 'truncate'}`}>{isLoadingThis ? "Loading…" : label}</span>
                    </div>
                  )}
                </button>
                {actionButtons}
              </div>
              {/* Bottom row: notes (small) + date */}
              {!isRenamingThis && (
                <div className="flex items-center justify-between px-3 pb-2 gap-2">
                  <span className={`text-[10px] text-stone-500 italic truncate ${isExpanded ? 'max-w-none' : 'max-w-[160px]'}`}>
                    {item.notes || ""}
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono shrink-0">{date}</span>
                </div>
              )}
              {isEditingNotesThis && (
                <div className="px-3 pb-3">
                  <NotesEditor value={item.notes || ""} onSave={(v) => handleSaveNotes(item.id, v)} onCancel={() => setNotesId(null)} />
                </div>
              )}
              {isConfirmingDelete && (
                <div className="px-3 pb-3">
                  <DeleteConfirm onConfirm={() => handleDelete(item.id)} onCancel={() => setConfirmDeleteId(null)} deleting={isDeletingThis} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-stone-800 p-3">
        <button
          onClick={fetchHistory}
          className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-stone-400
            transition hover:bg-stone-800 hover:text-white border border-stone-800"
        >
          ↺ Refresh List
        </button>
      </div>
    </div>
  );
}
