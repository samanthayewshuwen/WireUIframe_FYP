import { useRef, useState } from "react";
import { useFullProjectStore, ScreenStatus } from "../../store/full-project-store";
import { useAppStore } from "../../store/app-store";
import toast from "react-hot-toast";
import Spinner from "../core/Spinner";

// Icon mapping — match screen name against patterns in priority order
const PAGE_ICONS: [RegExp, string][] = [
  [/login|sign.?in|auth/i, "🔑"],
  [/register|sign.?up|creat.account/i, "📝"],
  [/dashboard|home|overview|main|landing/i, "🏠"],
  [/search|find|discover|explore/i, "🔍"],
  [/flight|ticket|travel|trip/i, "✈️"],
  [/seat|class|cabin/i, "💺"],
  [/passenger|travell?er|guest/i, "👤"],
  [/payment|checkout|pay|billing|invoice/i, "💳"],
  [/confirm|success|receipt|completed/i, "✅"],
  [/booking|reservation|my.booking/i, "📋"],
  [/profile|account|my.account/i, "⚙️"],
  [/product|item|catalog|listing|shop/i, "📦"],
  [/cart|basket/i, "🛒"],
  [/order|purchase|history/i, "📄"],
  [/report|analytics|chart|stats|insight/i, "📊"],
  [/message|chat|notification|inbox/i, "💬"],
  [/help|faq|support|contact/i, "❓"],
  [/admin|manage|control|setting/i, "🔧"],
  [/map|location|address/i, "📍"],
  [/user|member|staff|team/i, "👥"],
];

function getIcon(name: string): string {
  for (const [pattern, icon] of PAGE_ICONS) {
    if (pattern.test(name)) return icon;
  }
  return "📄";
}

function StatusDot({ status }: { status: ScreenStatus }) {
  if (status === "complete")
    return <span className="text-emerald-400 text-sm leading-none font-bold">✓</span>;
  if (status === "generating")
    return (
      <span className="inline-flex items-center justify-center" style={{ transform: "scale(0.65)", transformOrigin: "center" }}>
        <Spinner />
      </span>
    );
  if (status === "error")
    return <span className="text-red-400 text-sm leading-none font-bold">✕</span>;
  return <span className="w-2 h-2 rounded-full bg-stone-700 inline-block" />;
}

export default function ScreenNavigator() {
  const {
    screens,
    activeScreenId,
    planStatus,
    projectName,
    projectNotes,
    setProjectName,
    setProjectNotes,
    setActiveScreen,
    addBlankScreen,
    deleteScreen,
    renameScreen,
  } = useFullProjectStore();

  const { setInteractiveMode } = useAppStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Project title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Project notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  function startRename(screenId: string, currentName: string) {
    setRenamingId(screenId);
    setRenameValue(currentName);
    setTimeout(() => { renameInputRef.current?.focus(); renameInputRef.current?.select(); }, 30);
  }

  function commitRename() {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameScreen(renamingId, trimmed);
      toast.success(`Renamed to "${trimmed}"`);
    }
    setRenamingId(null);
  }

  function startEditTitle() {
    setTitleValue(projectName);
    setEditingTitle(true);
    setTimeout(() => { titleInputRef.current?.focus(); titleInputRef.current?.select(); }, 30);
  }

  function commitTitle() {
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== projectName) {
      setProjectName(trimmed);
      toast.success("Project renamed");
      // Sync updated title to Supabase + refresh history via the existing save pipeline
      window.dispatchEvent(new CustomEvent("fp:layout-changed"));
    }
    setEditingTitle(false);
  }

  function startEditNotes() {
    setNotesValue(projectNotes);
    setEditingNotes(true);
  }

  function commitNotes() {
    setProjectNotes(notesValue);
    setEditingNotes(false);
    // Sync updated notes to Supabase + refresh history via the existing save pipeline
    window.dispatchEvent(new CustomEvent("fp:layout-changed"));
  }

  function handleAddBlankScreen() {
    const name = `Page ${screens.length + 1}`;
    addBlankScreen(name);
    toast.success(`Added "${name}"`);
  }

  function handleDeleteScreen(e: React.MouseEvent, screenId: string, screenName: string) {
    e.stopPropagation();
    if (screens.length <= 1) {
      toast.error("Cannot delete the last page");
      return;
    }
    deleteScreen(screenId);
    toast.success(`Deleted "${screenName}"`);
  }

  function handleRegenerateScreen(e: React.MouseEvent, screenId: string, screenName: string) {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("fp:regenerate-screen", { detail: { screenId, screenName } })
    );
  }

  // ── Planning phase ────────────────────────────────────────────────────────
  if (planStatus === "planning") {
    return (
      <div className="mt-2 mb-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-950/30 border border-violet-800/40">
          <div style={{ transform: "scale(0.75)", transformOrigin: "left center" }}>
            <Spinner />
          </div>
          <span className="text-sm text-violet-300 font-mono">Planning project structure…</span>
        </div>
      </div>
    );
  }

  if (screens.length === 0) return null;

  const completed = screens.filter((s) => s.status === "complete").length;
  const total = screens.length;
  const allDone = completed === total;

  return (
    <div className="mt-2 mb-3 space-y-3">

      {/* ── Project Title (editable) ────────────────────────────────────────── */}
      <div className="rounded-xl bg-stone-900/50 border border-stone-800 px-3 py-2.5">
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
              if (e.key === "Escape") setEditingTitle(false);
            }}
            onBlur={commitTitle}
            className="w-full rounded border border-violet-500 bg-stone-800 px-2 py-1 text-sm font-bold text-white focus:outline-none"
          />
        ) : (
          <div
            className="group flex items-start gap-2 cursor-pointer"
            onClick={startEditTitle}
            title="Click to rename project"
          >
            <svg className="w-4 h-4 mt-0.5 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white truncate">{projectName || "Full Project"}</span>
                <svg className="w-3 h-3 text-violet-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <p className="text-[10px] text-violet-400/70 font-mono mt-0.5">✎ Click to rename · {total} pages</p>
            </div>
          </div>
        )}

        {/* Notes section */}
        {editingNotes ? (
          <div className="mt-2 space-y-1.5">
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              rows={3}
              placeholder="Add notes or description…"
              autoFocus
              className="w-full rounded border border-stone-600 bg-stone-800 px-2 py-1.5 text-xs text-white placeholder-stone-600 focus:border-violet-500 focus:outline-none resize-none"
            />
            <div className="flex gap-1.5">
              <button
                onClick={commitNotes}
                className="flex-1 rounded py-1 text-xs bg-violet-600 text-white hover:bg-violet-500 font-semibold transition"
              >Save</button>
              <button
                onClick={() => setEditingNotes(false)}
                className="flex-1 rounded py-1 text-xs bg-stone-700 text-stone-300 hover:bg-stone-600 transition"
              >Cancel</button>
            </div>
          </div>
        ) : (
          <div
            className="mt-2 cursor-pointer group"
            onClick={startEditNotes}
            title="Click to add/edit notes"
          >
            {projectNotes ? (
              <p className="text-xs text-stone-400 leading-relaxed group-hover:text-stone-300 transition-colors line-clamp-3">
                {projectNotes}
              </p>
            ) : (
              <p className="text-xs text-stone-600 italic group-hover:text-stone-500 transition-colors">
                + Add notes or description…
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1 px-0.5">
          <span className="text-xs font-mono text-stone-500">{completed}/{total} screens</span>
          {allDone && <span className="text-xs font-mono text-emerald-400">All done ✓</span>}
        </div>
        <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${allDone ? "bg-emerald-500" : "bg-violet-500"}`}
            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* ── Screen list ────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {screens.map((screen, idx) => {
          const isActive = screen.id === activeScreenId;
          const isClickable = screen.status === "complete" || screen.status === "generating";
          const isRenaming = renamingId === screen.id;

          return (
            <div key={screen.id} className="group relative">
              <div
                onClick={() => {
                  if (isRenaming) return;
                  if (!isClickable) return;
                  setInteractiveMode(false);
                  setActiveScreen(screen.id);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 cursor-pointer select-none ${
                  isActive
                    ? "bg-violet-900/40 border border-violet-700/50 text-white"
                    : isClickable
                    ? "hover:bg-stone-900/60 border border-transparent text-stone-300 hover:border-stone-800"
                    : "border border-transparent text-stone-600 cursor-default"
                }`}
              >
                {/* Index badge */}
                <span className={`shrink-0 w-6 h-6 rounded-lg text-xs font-mono flex items-center justify-center leading-none font-bold ${
                  isActive ? "bg-violet-600 text-white" : "bg-stone-800 text-stone-400"
                }`}>
                  {idx + 1}
                </span>

                {/* Page icon */}
                <span className="text-base leading-none shrink-0">{getIcon(screen.name)}</span>

                {/* Screen name — double-click to rename */}
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                      if (e.key === "Escape") setRenamingId(null);
                      e.stopPropagation();
                    }}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 rounded border border-violet-500 bg-stone-800 px-2 py-0.5 text-sm text-white focus:outline-none"
                  />
                ) : (
                  <span
                    className="text-sm truncate flex-1 font-medium font-sans"
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(screen.id, screen.name); }}
                    title="Double-click to rename"
                  >
                    {screen.name}
                  </span>
                )}

                {/* Status indicator */}
                <span className="shrink-0 flex items-center h-5">
                  <StatusDot status={screen.status} />
                </span>

                {/* Viewing / Live badge */}
                {isActive && screen.status === "complete" && (
                  <span className="shrink-0 text-[9px] font-mono bg-violet-800/60 text-violet-300 border border-violet-700/40 px-1.5 py-0.5 rounded leading-none">
                    VIEWING
                  </span>
                )}
                {isActive && screen.status === "generating" && (
                  <span className="shrink-0 text-[9px] font-mono bg-amber-900/40 text-amber-400 border border-amber-700/40 px-1.5 py-0.5 rounded leading-none">
                    LIVE
                  </span>
                )}
              </div>

              {/* Action buttons — rename + regenerate + delete, visible on hover */}
              {screen.status === "complete" && !isRenaming && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); startRename(screen.id, screen.name); }}
                    title="Rename this page"
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-stone-700 hover:bg-amber-600 text-stone-300 hover:text-white transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleRegenerateScreen(e, screen.id, screen.name)}
                    title={`Regenerate "${screen.name}"`}
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-700/80 hover:bg-violet-600 text-white text-base font-bold transition-colors"
                  >
                    ↺
                  </button>
                  <button
                    onClick={(e) => handleDeleteScreen(e, screen.id, screen.name)}
                    title={`Delete "${screen.name}"`}
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-900/80 hover:bg-red-700 text-red-300 hover:text-white text-base font-bold transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add Page button ─────────────────────────────────────────────────── */}
      <button
        onClick={handleAddBlankScreen}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-stone-700 bg-stone-900/30 px-3 py-3 text-sm font-semibold text-stone-400 hover:border-violet-600 hover:bg-violet-950/20 hover:text-violet-300 transition-all"
      >
        <span className="text-base leading-none">＋</span>
        <span>Add Page</span>
      </button>

      {/* ── Rename hint ─────────────────────────────────────────────────────── */}
      <p className="px-1 text-xs text-stone-600 font-mono">Double-click a page name to rename</p>

      {/* ── All done message ───────────────────────────────────────────────── */}
      {allDone && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-800/30">
          <span className="text-emerald-400 text-sm">✓</span>
          <span className="text-xs font-mono text-emerald-400">All {total} screens generated</span>
        </div>
      )}
    </div>
  );
}
