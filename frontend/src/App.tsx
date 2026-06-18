import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import Login from "./components/Login";
import { Session } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import { FaUserCircle } from "react-icons/fa";

import NavigationRail from "./components/layout/NavigationRail";
import StoryboardGenerator from "./components/storyboard/StoryboardGenerator";
import HistoryPanel from "./components/history/HistoryPanel";
import ElementLibrary from "./components/library/ElementLibrary";
import SaveComponentModal from "./components/editor/SaveComponentModal";

import { generateCode } from "./generateCode";
import SettingsDialog from "./components/settings/SettingsDialog";
import { AppState, AestheticMode, CodeGenerationParams, EditorTheme, Settings, GenerationScope } from "./types";
import { useFullProjectStore } from "./store/full-project-store";
import { IS_RUNNING_ON_CLOUD } from "./config";
import { PicoBadge } from "./components/messages/PicoBadge";
import { OnboardingNote } from "./components/messages/OnboardingNote";
import { usePersistedState } from "./hooks/usePersistedState";
import TermsOfServiceDialog from "./components/TermsOfServiceDialog";
import { USER_CLOSE_WEB_SOCKET_CODE } from "./constants";
import { extractHistory } from "./components/history/utils";
import { Stack } from "./lib/stacks";
import { CodeGenerationModel } from "./lib/models";
import useBrowserTabIndicator from "./hooks/useBrowserTabIndicator";
import { useAppStore } from "./store/app-store";
import { useProjectStore } from "./store/project-store";
import Sidebar from "./components/sidebar/Sidebar";
import PreviewPane from "./components/preview/PreviewPane";
import { GenerationSettings } from "./components/settings/GenerationSettings";
import { Commit } from "./components/commits/types";
import { createCommit } from "./components/commits/utils";

// ── Storyboard meta panel (sidebar panel shown when a storyboard is active) ──
function StoryboardMetaPanel({
  title,
  notes,
  onTitleChange,
  onNotesChange,
}: {
  title: string;
  notes: string;
  onTitleChange: (t: string) => void;
  onNotesChange: (n: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(notes);

  return (
    <div className="rounded-xl bg-stone-900/50 border border-stone-800 px-3 py-2.5 space-y-2">
      {/* Title */}
      {editingTitle ? (
        <div className="space-y-1.5">
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onTitleChange(titleDraft.trim() || title); setEditingTitle(false); }
              if (e.key === "Escape") { setTitleDraft(title); setEditingTitle(false); }
            }}
            onBlur={() => { onTitleChange(titleDraft.trim() || title); setEditingTitle(false); }}
            className="w-full rounded border border-emerald-500 bg-stone-800 px-2 py-1 text-sm font-bold text-white focus:outline-none"
          />
        </div>
      ) : (
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => { setTitleDraft(title); setEditingTitle(true); }}
          title="Click to rename"
        >
          <span className="text-sm font-bold text-white truncate flex-1">{title}</span>
          <svg className="w-3 h-3 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
      )}
      <p className="text-[10px] text-emerald-400/60 font-mono">✎ Click title to rename</p>

      {/* Notes */}
      {editingNotes ? (
        <div className="space-y-1.5">
          <textarea
            autoFocus
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={3}
            placeholder="Add notes…"
            className="w-full rounded border border-stone-600 bg-stone-800 px-2 py-1.5 text-xs text-white placeholder-stone-600 focus:border-emerald-500 focus:outline-none resize-none"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => { onNotesChange(notesDraft); setEditingNotes(false); }}
              className="flex-1 rounded py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-500 font-semibold transition"
            >Save</button>
            <button
              onClick={() => { setNotesDraft(notes); setEditingNotes(false); }}
              className="flex-1 rounded py-1 text-xs bg-stone-700 text-stone-300 hover:bg-stone-600 transition"
            >Cancel</button>
          </div>
        </div>
      ) : (
        <div
          className="cursor-pointer"
          onClick={() => { setNotesDraft(notes); setEditingNotes(true); }}
          title="Click to add notes"
        >
          {notes ? (
            <p className="text-xs text-stone-400 leading-relaxed line-clamp-3">{notes}</p>
          ) : (
            <p className="text-xs text-stone-600 italic hover:text-stone-500 transition-colors">+ Add notes…</p>
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [restoredStoryboard, setRestoredStoryboard] = useState<any | null>(null);
  const [storyboardResetKey, setStoryboardResetKey] = useState(0);
  const [activeStoryboardTitle, setActiveStoryboardTitle] = useState<string | null>(null);
  const [activeStoryboardNotes, setActiveStoryboardNotes] = useState<string>("");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  // Save dialog (shown when user saves a blank canvas for the first time)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogTitle, setSaveDialogTitle] = useState("");
  const [saveDialogNotes, setSaveDialogNotes] = useState("");
  // Expand panel: "history" | "library" | null
  const [expandedPanel, setExpandedPanel] = useState<"history" | "library" | null>(null);
  const [showBlankCanvasDialog, setShowBlankCanvasDialog] = useState(false);
  // Title/notes loaded from history — used to sync the sidebar ProjectInfoCard
  const [loadedProjectTitle, setLoadedProjectTitle] = useState<string | null>(null);
  const [loadedProjectNotes, setLoadedProjectNotes] = useState<string | null>(null);
  // Pending save metadata (title + notes) — written by dialog, read by saveFullProjectState
  const pendingSaveMetaRef = useRef<{ title: string; notes: string } | null>(null);

  // Shared iframe ref — passed to PreviewPane and ElementLibrary so
  // "Insert into Canvas" can target the live preview directly.
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  // Tracks the Supabase row id for the CURRENT single-page project.
  // null = no row yet (project has not been saved). Once set, subsequent saves
  // UPDATE this row instead of inserting a new one, preventing history duplication.
  // Cleared on reset() and restored when loading from history.
  const spDbRowIdRef = useRef<number | null>(null);

  const {
    inputMode, setInputMode,
    isImportedFromCode, setIsImportedFromCode,
    referenceImages, setReferenceImages,
    initialPrompt, setInitialPrompt,
    head, commits,
    addCommit, removeCommit, setHead,
    appendCommitCode, setCommitCode,
    resetCommits, resetHead,
    updateVariantStatus, resizeVariants,
    appendExecutionConsole, resetExecutionConsoles,
  } = useProjectStore();

  const {
    disableInSelectAndEditMode,
    setUpdateInstruction,
    updateImages, setUpdateImages,
    appState, setAppState,
    setInteractiveMode,
    isInspectMode, setInspectMode,
    propsPanelOpen,
    sidebarCollapsed, setSidebarCollapsed,
    hadInteractiveEdits, setHadInteractiveEdits,
  } = useAppStore();

  const [settings, setSettings] = usePersistedState<Settings>(
    {
      openAiApiKey: null,
      openAiBaseURL: null,
      anthropicApiKey: null,
      screenshotOneApiKey: null,
      isImageGenerationEnabled: true,
      editorTheme: EditorTheme.COBALT,
      generatedCodeConfig: Stack.HTML_TAILWIND,
      codeGenerationModel: CodeGenerationModel.CLAUDE_4_5_SONNET_2025_09_29,
      isTermOfServiceAccepted: false,
      aestheticMode: AestheticMode.HIGH_FI,
      generationScope: "single_page" as GenerationScope,
    },
    "setting"
  );

  const wsRef = useRef<WebSocket>(null);
  const lastProjectSaveSignatureRef = useRef<string>("");
  const activeProjectSaveRef = useRef(false);


  useBrowserTabIndicator(appState === AppState.CODING);

  // On every page load, reset gaming storyboard mode so the app always opens
  // on the normal generation settings page rather than restoring storyboard state.
  useEffect(() => {
    setSettings((p) => ({
      ...p,
      aestheticMode: p.aestheticMode === AestheticMode.GAMING_STORYBOARD
        ? AestheticMode.HIGH_FI
        : p.aestheticMode,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 閳光偓閳光偓 Auth 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCheckingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // 鈹€鈹€ Interactive-edit save relay 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  // PreviewComponent dispatches 'designer:save-project' after committing layout
  // changes to the Zustand store. We listen here and persist to Supabase so the
  // change survives a page reload and appears in history.
  useEffect(() => {
    const handler = () => { void saveFullProjectState(); };
    window.addEventListener("designer:save-project", handler);
    return () => window.removeEventListener("designer:save-project", handler);
  // saveFullProjectState closes over `session` — re-register when session changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ─── Save dialog trigger ──────────────────────────────────────────────────────
  // Dispatched by Sidebar when user hits Save Layout on a blank canvas.
  useEffect(() => {
    const handler = () => {
      setSaveDialogTitle("My Project");
      setSaveDialogNotes("");
      setSaveDialogOpen(true);
    };
    window.addEventListener("designer:request-save-dialog", handler);
    return () => window.removeEventListener("designer:request-save-dialog", handler);
  }, []);

  // PreviewComponent dispatches 'fp:layout-changed' when the visual editor
  // modifies a full-project screen (drag/resize/text edit + save, or auto-capture
  // on screen switch). We persist the updated FP store to Supabase here.
  useEffect(() => {
    const handler = () => { void saveFPScreensToSupabase(); };
    window.addEventListener("fp:layout-changed", handler);
    return () => window.removeEventListener("fp:layout-changed", handler);
  // saveFPScreensToSupabase closes over `session` — re-register when session changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Migration guards
  useEffect(() => {
    if (!settings.generatedCodeConfig)
      setSettings((p) => ({ ...p, generatedCodeConfig: Stack.HTML_TAILWIND }));
  }, [settings.generatedCodeConfig, setSettings]);

  useEffect(() => {
    if (!settings.aestheticMode)
      setSettings((p) => ({ ...p, aestheticMode: AestheticMode.HIGH_FI }));
    // Migrate old "full_project" aestheticMode (from previous implementation) to new scope system
    if ((settings.aestheticMode as string) === "full_project") {
      setSettings((p) => ({
        ...p,
        aestheticMode: AestheticMode.HIGH_FI,
        generationScope: "full_project" as GenerationScope,
      }));
    } else {
      // If persisted aestheticMode is unrecognised, reset to HIGH_FI
      const known = Object.values(AestheticMode) as string[];
      if (settings.aestheticMode && !known.includes(settings.aestheticMode))
        setSettings((p) => ({ ...p, aestheticMode: AestheticMode.HIGH_FI }));
    }
  }, [settings.aestheticMode, setSettings]);

  useEffect(() => {
    const validScopes: GenerationScope[] = ["single_page", "full_project"];
    if (!settings.generationScope || !validScopes.includes(settings.generationScope))
      setSettings((p) => ({ ...p, generationScope: "single_page" as GenerationScope }));
    // Gaming Storyboard + Full Project is not a valid combo — fall back to High-Fi
    if (
      settings.generationScope === "full_project" &&
      settings.aestheticMode === AestheticMode.GAMING_STORYBOARD
    ) {
      setSettings((p) => ({ ...p, aestheticMode: AestheticMode.HIGH_FI }));
    }
  }, [settings.generationScope, settings.aestheticMode, setSettings]);

  // 閳光偓閳光偓 Core helpers 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  const reset = () => {
    setAppState(AppState.INITIAL);
    setUpdateInstruction("");
    setUpdateImages([]);
    disableInSelectAndEditMode();
    resetExecutionConsoles();
    resetCommits();
    resetHead();
    setInputMode("image");
    setReferenceImages([]);
    setIsImportedFromCode(false);
    spDbRowIdRef.current = null;   // new project — no existing row to update
    setLoadedProjectTitle(null);
    setLoadedProjectNotes(null);
    useFullProjectStore.getState().reset();
    // Reset storyboard local state by remounting StoryboardGenerator
    setStoryboardResetKey((k) => k + 1);
    setRestoredStoryboard(null);
    setActiveStoryboardTitle(null);
    setActiveStoryboardNotes("");
    // Always return to the normal input form — reset scope and aesthetic mode
    setSettings((p) => ({
      ...p,
      aestheticMode: AestheticMode.HIGH_FI,
      generationScope: "single_page" as GenerationScope,
    }));
  };

  const regenerate = () => {
    // Full Project mode: no commits — regenerate from stored initial prompt
    if (useFullProjectStore.getState().isActive) {
      const prompt = initialPrompt || useFullProjectStore.getState().projectName;
      if (prompt) {
        doCreateFromText(prompt);
      } else {
        toast.error("No prompt available to regenerate.");
      }
      return;
    }

    if (head === null) {
      toast.error("No current version set.");
      throw new Error("Regenerate called with no head");
    }
    const currentCommit = commits[head];
    if (currentCommit.type !== "ai_create") {
      toast.error("Only the first version can be regenerated.");
      return;
    }
    if (inputMode === "image" || inputMode === "video") {
      doCreate(referenceImages, inputMode);
    } else {
      doCreateFromText(initialPrompt);
    }
  };

  const cancelCodeGeneration = () => wsRef.current?.close?.(USER_CLOSE_WEB_SOCKET_CODE);

  const cancelCodeGenerationAndReset = (commit: Commit) => {
    if (commit.type === "ai_create") {
      reset();
    } else {
      removeCommit(commit.hash);
      if (commit.parentHash) setHead(commit.parentHash);
      else throw new Error("Parent commit not found");
      setAppState(AppState.CODE_READY);
    }
  };

  /** Get the HTML of the current active variant for the library */
  const getCurrentCode = (): string => {
    if (head === null || !commits[head]) return "";
    return commits[head].variants[commits[head].selectedVariantIndex]?.code ?? "";
  };

  // 閳光偓閳光偓 DB save 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓

  /**
   * Save Full Project (multi-screen) state to Supabase history.
   *
   * First call  → INSERT and store the returned row id in the FP store.
   * Later calls → UPDATE that same row so the project always has exactly
   *               ONE entry in the history list.
   */
  const saveFPScreensToSupabase = async () => {
    if (!session?.user?.id) return;
    const fpState = useFullProjectStore.getState();
    if (!fpState.isActive) return;
    const hasContent = fpState.screens.some((s) => s.html.trim().length > 0);
    if (!hasContent) return;

    const completedCount = fpState.screens.filter(
      (s) => s.status === "complete" && s.html.trim().length > 0
    ).length;

    const stateToSave = {
      fullProject: {
        projectName: fpState.projectName,
        initialPrompt: useProjectStore.getState().initialPrompt || fpState.projectName,
        screens: fpState.screens.map((s) => ({
          id: s.id,
          name: s.name,
          html: s.html,
          // Persist originalHtml/mobileHtml so the Reset button works across page reloads.
          // Without these, loading from DB leaves originalHtml=undefined and the reset guard
          // (s.originalHtml ?) is falsy — making Reset appear to do nothing.
          originalHtml:         s.originalHtml         ?? "",
          mobileHtml:           s.mobileHtml           ?? "",
          originalMobileHtml:   s.originalMobileHtml   ?? "",
          status: s.status,
        })),
        activeScreenId: fpState.activeScreenId,
      },
    };

    // Encode type + count in prompt so the history list can detect FP items
    // without loading project_state (which can be many MB of HTML).
    const prompt = `[Full Project: ${completedCount} screens] ${fpState.projectName || "Unnamed Project"}`;

    try {
      if (fpState.dbRowId === null) {
        // ── First save: INSERT ────────────────────────────────────────────────
        const { data, error } = await supabase
          .from("generations")
          .insert({ user_id: session.user.id, project_state: stateToSave, prompt })
          .select("id")
          .maybeSingle();

        if (error) {
          console.error("[FP SAVE] insert failed:", error);
          return;
        }
        if (data?.id) {
          useFullProjectStore.getState().setDbRowId(data.id);
          setHistoryRefreshKey((k) => k + 1);
        }
      } else {
        // ── Subsequent saves: UPDATE the same row ─────────────────────────────
        const { error } = await supabase
          .from("generations")
          .update({ project_state: stateToSave, prompt })
          .eq("id", fpState.dbRowId)
          .eq("user_id", session.user.id);

        if (error) {
          console.error("[FP SAVE] update failed:", error);
          return;
        }
        setHistoryRefreshKey((k) => k + 1);
      }
    } catch (e) {
      console.error("[FP SAVE] unexpected error:", e);
    }
  };

  const saveFullProjectState = async (attempt = 1) => {
    // FP mode has its own upsert logic — never INSERT a single-page row while FP is active
    if (useFullProjectStore.getState().isActive) return;
    if (!session?.user?.id) return;
    if (activeProjectSaveRef.current && attempt === 1) return;

    const fullState = useProjectStore.getState();
    const stateToSave = {
      commits: fullState.commits,
      head: fullState.head,
      referenceImages: fullState.referenceImages,
      inputMode: fullState.inputMode,
      initialPrompt: fullState.initialPrompt,
    };
    const saveSignature = JSON.stringify(stateToSave);
    if (attempt === 1 && saveSignature === lastProjectSaveSignatureRef.current) return;
    activeProjectSaveRef.current = true;
    // Consume any pending save metadata (title + notes from the save dialog)
    const saveMeta = pendingSaveMetaRef.current;
    pendingSaveMetaRef.current = null;
    let displayPrompt = "Imported from code";
    if (saveMeta?.title?.trim()) displayPrompt = saveMeta.title.trim();
    else if (fullState.initialPrompt?.trim()) displayPrompt = fullState.initialPrompt;
    else if (fullState.inputMode === "image" && fullState.referenceImages.length > 0)
      displayPrompt = `Image Generation ${new Date().toLocaleTimeString()}`;
    // Extra columns available if they exist in the DB
    const extraCols: Record<string, string> = {};
    if (saveMeta?.title?.trim()) extraCols.title = saveMeta.title.trim();
    if (saveMeta?.notes?.trim()) extraCols.notes = saveMeta.notes.trim();
    try {
      if (spDbRowIdRef.current !== null) {
        // ── Existing project row: UPDATE in place (no new history entry) ──────
        const { error: updateError } = await supabase
          .from("generations")
          .update({ project_state: stateToSave, prompt: displayPrompt, ...extraCols })
          .eq("id", spDbRowIdRef.current)
          .eq("user_id", session.user.id);
        if (updateError) {
          console.error("[DB SAVE] Update failed:", updateError);
          if (attempt < 4) {
            setTimeout(() => saveFullProjectState(attempt + 1), 1500);
          } else {
            toast.error("Save failed - check console for details.");
          }
          return;
        }
        if (saveMeta?.title) toast.success(`Saved as "${saveMeta.title}"`);
        setHistoryRefreshKey((k) => k + 1);
      } else {
        // ── New project: INSERT and remember the row id for future updates ────
        const { data: inserted, error: insertError } = await supabase
          .from("generations")
          .insert({ user_id: session.user.id, project_state: stateToSave, prompt: displayPrompt, ...extraCols })
          .select("id")
          .maybeSingle();
        if (insertError) {
          console.error("[DB SAVE] Insert failed:", insertError);
          if (attempt < 4) {
            setTimeout(() => saveFullProjectState(attempt + 1), 1500);
          } else {
            toast.error("Save failed - check console for details.");
          }
          return;
        }
        if (inserted?.id) {
          spDbRowIdRef.current = inserted.id;
        }
        if (saveMeta?.title) toast.success(`Saved as "${saveMeta.title}"`);
        setHistoryRefreshKey((k) => k + 1);
      }
      lastProjectSaveSignatureRef.current = saveSignature;
      if (!saveMeta?.title) toast.success("Layout saved");
    } catch (e) {
      console.error("[DB SAVE]", e);
      toast.error("Save failed - unexpected error.");
    } finally {
      activeProjectSaveRef.current = false;
    }
  };

  // 閳光偓閳光偓 Aesthetic system prompt prefix 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  function buildAestheticPrefix(): string {
    // ── Full Project scope ────────────────────────────────────────────────────
    if (settings.generationScope === "full_project") {
      const styleGuide =
        settings.aestheticMode === AestheticMode.WIREFRAME
          ? "Use LOW-FIDELITY WIREFRAME style: grayscale palette, dashed borders, simple placeholder boxes, readable labels on every region. No gradients or polished visuals."
          : "Use HIGH-FIDELITY PRODUCT UI style: polished gradients, modern shadows, real content, accessible contrast, icons, production-ready typography and spacing.";

      return (
        "You are generating a COMPLETE MULTI-PAGE WEB APPLICATION as a single standalone HTML file.\n\n" +

        "STEP 1 — IDENTIFY ALL PAGES: Analyse the user's description and list every page/module the system must have. " +
        "For example, a flight booking system needs: Home, Login, Register, Search Flights, Flight Results, Flight Details, Seat Selection, Passenger Details, Payment, Booking Confirmation, My Bookings, and a User Profile page. " +
        "An e-commerce system needs: Home, Product Listing, Product Detail, Shopping Cart, Checkout, Order Confirmation, Order History, Login, Register, User Profile. " +
        "Always generate at minimum 6 pages for any system.\n\n" +

        "STEP 2 — REQUIRED HTML STRUCTURE: Every page section MUST follow this exact pattern:\n" +
        '  <section id="page-{pageid}" data-page-name="{Human Readable Page Name}" style="display:block"> ... </section>\n' +
        "Rules:\n" +
        "• The FIRST page (home or login) MUST have style=\"display:block\" so it is visible on initial load.\n" +
        "• ALL other pages MUST have style=\"display:none\" initially.\n" +
        "• id must be lowercase hyphenated: page-login, page-dashboard, page-search-flights, page-payment, etc.\n" +
        "• data-page-name must be the human-readable name: 'Login', 'Dashboard', 'Search Flights', 'Payment', etc.\n\n" +

        "STEP 3 — NAVIGATION SCRIPT: Include this JavaScript to handle page switching:\n" +
        "<script>\n" +
        "function showPage(pageId) {\n" +
        "  document.querySelectorAll('[data-page-name]').forEach(p => p.style.display = 'none');\n" +
        "  var el = document.getElementById(pageId);\n" +
        "  if (el) el.style.display = 'block';\n" +
        "  window.location.hash = pageId;\n" +
        "}\n" +
        "window.addEventListener('hashchange', function() {\n" +
        "  var id = window.location.hash.slice(1);\n" +
        "  if (id) showPage(id);\n" +
        "});\n" +
        "</script>\n\n" +

        "STEP 4 — NAVIGATION BAR: Include a persistent top navigation bar or sidebar with links to ALL pages using href='#{page-id}'.\n\n" +

        "STEP 5 — FULL UI FOR EVERY PAGE: Each page must have a complete realistic UI with: proper forms, data tables, cards, charts where relevant, realistic placeholder data, real copy (not lorem ipsum), and interactive elements.\n\n" +

        styleGuide + "\n\n" +

        "Return ONLY the complete standalone HTML document. No markdown fences, no explanations, no comments outside HTML.\n\n"
      );
    }

    // ── Single Page scope ─────────────────────────────────────────────────────
    if (settings.aestheticMode === AestheticMode.WIREFRAME) {
      return (
        "Generate a LOW-FIDELITY WIREFRAME, not a final product UI. " +
        "The result must be a complete standalone HTML document that visibly renders in an iframe. " +
        "Use only grayscale colors, dashed or simple borders, simple boxes, placeholder image frames, and plain sans-serif text. " +
        "Every important screen area must still contain readable words: headings, button labels, nav labels, form labels, helper text, table headers, card titles, and placeholder captions. " +
        "Do not output empty unlabeled rectangles; label boxes with their intended content or role. " +
        "Avoid gradients, decorative imagery, heavy shadows, brand colors, and polished marketing styling. " +
        "Focus on layout, hierarchy, spacing, screen regions, and editable component blocks.\n\n"
      );
    }

    return (
      "Generate a HIGH-FIDELITY FINAL PRODUCT USER INTERFACE, not a wireframe. " +
      "The result must be a complete standalone HTML document that visibly renders in an iframe. " +
      "Use real-looking content, polished visual hierarchy, production-ready spacing, modern typography, accessible contrast, rich but controlled colors, icons, shadows, and responsive layout. " +
      "Do not label the output as wireframe, do not use gray placeholder boxes unless the product truly needs placeholders, and do not leave the screen visually empty. " +
      "Return the final UI markup only.\n\n"
    );
  }

  // 閳光偓閳光偓 Code generation 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  function doGenerateCode(params: CodeGenerationParams) {
    resetExecutionConsoles();
    setAppState(AppState.CODING);

    const enriched: CodeGenerationParams = {
      ...params,
      prompt: {
        ...params.prompt,
        text: buildAestheticPrefix() + (params.prompt.text ?? ""),
      },
    };

    const updatedParams = { ...enriched, ...settings, userId: session?.user.id };

    const desiredVariantCount = params.variantCount ?? 4;
    const previewFallbackCode =
      params.generationType === "update" && head && commits[head]
        ? commits[head].variants[commits[head].selectedVariantIndex]?.code ?? ""
        : "";
    const hasReceivedFirstChunk = new Set<number>();
    const base = {
      variants: Array(desiredVariantCount)
        .fill(null)
        .map(() => ({ code: previewFallbackCode })),
    };
    const commitInput =
      params.generationType === "create"
        ? { ...base, type: "ai_create" as const, parentHash: null, inputs: params.prompt }
        : { ...base, type: "ai_edit" as const, parentHash: head,
            inputs: params.history ? params.history[params.history.length - 1] : { text: "", images: [] } };

    const commit = createCommit(commitInput);
    addCommit(commit);
    setHead(commit.hash);

    generateCode(wsRef, updatedParams, {
      onChange: (token, vi) => {
        if (!hasReceivedFirstChunk.has(vi)) {
          hasReceivedFirstChunk.add(vi);
          setCommitCode(commit.hash, vi, token);
          return;
        }
        appendCommitCode(commit.hash, vi, token);
      },
      onSetCode:        (code, vi)  => setCommitCode(commit.hash, vi, code),
      onStatusUpdate:   (line, vi)  => appendExecutionConsole(vi, line),
      onVariantComplete:(vi)        => updateVariantStatus(commit.hash, vi, "complete"),
      onVariantError:   (vi, err)   => updateVariantStatus(commit.hash, vi, "error", err),
      onVariantCount:   (count)     => resizeVariants(commit.hash, count),
      onCancel:         ()          => cancelCodeGenerationAndReset(commit),
      onComplete: () => {
        requestAnimationFrame(() => {
          setAppState(AppState.CODE_READY);
        });
      
        setTimeout(() => {
          saveFullProjectState(1);
        }, 1000);
      },
    });
  }

  // ── Visily-like multi-phase Full Project generation ──────────────────────
  // Phase 1: LLM → JSON plan (list of screens)
  // Phase 2: Per-screen LLM call → standalone HTML
  // Phase 3: Stored in useFullProjectStore
  // Phase 4: ScreenNavigator in sidebar + PreviewPane reads active screen
  async function doGenerateFullProject(text: string) {
    const fp = useFullProjectStore;

    // ── Bootstrap ───────────────────────────────────────────────────────────
    resetCommits();
    resetHead();
    resetExecutionConsoles();
    setInputMode("text");
    setInitialPrompt(text);
    setAppState(AppState.CODING);   // must come before startPlanning so Sidebar renders
    fp.getState().startPlanning(text);

    const baseParams = {
      ...settings,
      // Keep generationScope as "full_project" (from settings) so the backend's
      // PostProcessingMiddleware skips save_to_supabase for per-screen calls.
      // The frontend handles the single project row via saveFPScreensToSupabase().
      generationType: "create" as const,
      inputMode: "text" as const,
      variantCount: 1,
      userId: session?.user.id,
    };

    /** Wrap a single generateCode WebSocket call in a Promise. */
    function runGeneration(
      promptText: string,
      onChunk: (c: string) => void,
      onFinal: (c: string) => void
    ): Promise<void> {
      return new Promise((resolve, reject) => {
        generateCode(
          wsRef,
          { ...baseParams, prompt: { text: promptText, images: [] } },
          {
            onChange:        (chunk, _vi) => onChunk(chunk),
            onSetCode:       (code, _vi)  => onFinal(code),
            onStatusUpdate:  ()           => {},
            onVariantComplete: ()         => {},
            onVariantError:  (_vi, err)   => reject(new Error(err)),
            onVariantCount:  ()           => {},
            onCancel:        ()           => reject(new Error("__cancelled__")),
            onComplete:      ()           => resolve(),
          }
        );
      });
    }

    // ── Phase 1: Generate project plan (JSON) ────────────────────────────────
    const planningPrompt =
      `You are a UI project architect. The user wants to build: "${text}"\n\n` +
      `Output ONLY a valid JSON object — no markdown fences, no explanation:\n` +
      `{\n` +
      `  "projectName": "Human-friendly project name",\n` +
      `  "screens": [\n` +
      `    { "id": "login", "name": "Login" },\n` +
      `    { "id": "register", "name": "Register" }\n` +
      `  ]\n` +
      `}\n\n` +
      `Rules:\n` +
      `- Include 6–12 screens covering ALL pages the system truly needs\n` +
      `- IDs must be lowercase hyphenated (e.g. "forgot-password", "order-history")\n` +
      `- Names must be human-readable title case (e.g. "Forgot Password", "Order History")\n` +
      `- Cover every essential page for a complete production system — don't skip anything`;

    let planRaw = "";
    try {
      await runGeneration(
        planningPrompt,
        (chunk) => { planRaw += chunk; },
        (code)  => { planRaw = code; }
      );
    } catch (err: any) {
      if (err.message === "__cancelled__") {
        // Cancelled during planning — nothing to save yet
        fp.getState().reset();
        setAppState(AppState.INITIAL);
        return;
      }
      console.warn("[FullProject] Planning call failed — using fallback plan:", err);
    }

    // Parse the JSON plan, with a generic fallback if parsing fails
    let plan: { projectName: string; screens: Array<{ id: string; name: string }> };
    try {
      const cleaned = planRaw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON object found");
      const parsed = JSON.parse(match[0]);
      if (!parsed.screens || !Array.isArray(parsed.screens) || parsed.screens.length === 0)
        throw new Error("Screens array missing or empty");
      plan = parsed;
    } catch (parseErr) {
      console.warn("[FullProject] Plan JSON parse failed, using fallback:", parseErr, "Raw:", planRaw);
      // Generic fallback — better than crashing
      plan = {
        projectName: text.slice(0, 60) || "App",
        screens: [
          { id: "login",     name: "Login" },
          { id: "register",  name: "Register" },
          { id: "dashboard", name: "Dashboard" },
          { id: "profile",   name: "Profile" },
          { id: "settings",  name: "Settings" },
        ],
      };
    }

    fp.getState().setPlan(plan.projectName, plan.screens);

    // ── Phase 2: Generate each screen individually ───────────────────────────
    const aestheticGuide =
      settings.aestheticMode === AestheticMode.WIREFRAME
        ? "Style: LOW-FIDELITY WIREFRAME — grayscale, dashed borders, simple placeholder boxes, readable labels on every region. No gradients or polished visuals."
        : "Style: HIGH-FIDELITY PRODUCT UI — polished gradients, modern shadows, production-ready typography, icons, accessible contrast, realistic placeholder content.";

    const allScreenNames = plan.screens.map((s) => s.name).join(", ");

    for (const screen of plan.screens) {
      // Mark as generating and make it the active (visible) screen
      fp.getState().setScreenStatus(screen.id, "generating");
      fp.getState().setActiveScreen(screen.id);

      const otherScreens = plan.screens
        .filter((s) => s.id !== screen.id)
        .map((s) => s.name)
        .join(", ");

      const screenPrompt =
        `Generate the "${screen.name}" page for "${plan.projectName}" (${text}).\n\n` +
        `${aestheticGuide}\n\n` +
        `This page: "${screen.name}"\n` +
        `All pages in the project: ${allScreenNames}\n` +
        `Other pages (reference only, no real navigation needed): ${otherScreens}\n\n` +
        `Requirements:\n` +
        `- Complete standalone HTML document (<!DOCTYPE html><html><head>…<body>…</body></html>)\n` +
        `- Full realistic UI specifically for the "${screen.name}" page\n` +
        `- Include a navigation header or sidebar listing the other page names as non-functional labels\n` +
        `- Realistic placeholder data and copy (no lorem ipsum)\n` +
        `- All relevant UI elements for this page (forms, tables, cards, charts as appropriate)\n` +
        `- Use Tailwind CSS via CDN (https://cdn.tailwindcss.com) for styling\n\n` +
        `Return ONLY the complete HTML document. No markdown fences, no explanation.`;

      try {
        await runGeneration(
          screenPrompt,
          (chunk) => fp.getState().appendScreenHtml(screen.id, chunk),
          (code)  => fp.getState().setScreenHtml(screen.id, code)
        );
        fp.getState().setScreenStatus(screen.id, "complete");
      } catch (err: any) {
        if (err.message === "__cancelled__") {
          // Mark the in-progress screen as cancelled, keep what's done
          fp.getState().setScreenStatus(screen.id, "error");
          const completedCount = fp.getState().screens.filter((s) => s.status === "complete").length;
          if (completedCount > 0) {
            // Preserve completed screens — save first (sets dbRowId), then show UI
            const firstDone = fp.getState().screens.find((s) => s.status === "complete");
            if (firstDone) fp.getState().setActiveScreen(firstDone.id);
            await saveFPScreensToSupabase();
            setAppState(AppState.CODE_READY);
            toast.success(`Cancelled — ${completedCount} screen(s) saved to history`);
          } else {
            fp.getState().reset();
            setAppState(AppState.INITIAL);
          }
          return;
        }
        fp.getState().setScreenStatus(screen.id, "error");
        console.error(`[FullProject] Screen "${screen.name}" failed:`, err);
        // Continue generating remaining screens instead of aborting
      }
    }

    // ── Done ────────────────────────────────────────────────────────────────
    // Ensure the active screen is set to the first completed one
    const firstComplete = fp.getState().screens.find((s) => s.status === "complete");
    if (firstComplete) fp.getState().setActiveScreen(firstComplete.id);

    // Save first so dbRowId is set before the user can trigger an edit
    await saveFPScreensToSupabase();
    setAppState(AppState.CODE_READY);
    toast.success(`${plan.projectName} — all screens generated`);
  }

  // ── Per-screen regeneration (triggered by ScreenNavigator ↺ button) ──────────
  async function doRegenerateScreen(screenId: string, screenName: string) {
    const fp = useFullProjectStore;
    const fpState = fp.getState();
    const allScreens = fpState.screens;
    const projectName = fpState.projectName;
    const allScreenNames = allScreens.map((s) => s.name).join(", ");
    const otherScreens = allScreens
      .filter((s) => s.id !== screenId)
      .map((s) => s.name)
      .join(", ");

    const aestheticGuide =
      settings.aestheticMode === AestheticMode.WIREFRAME
        ? "Style: LOW-FIDELITY WIREFRAME — grayscale, dashed borders, simple placeholder boxes, readable labels on every region. No gradients or polished visuals."
        : "Style: HIGH-FIDELITY PRODUCT UI — polished gradients, modern shadows, production-ready typography, icons, accessible contrast, realistic placeholder content.";

    const screenPrompt =
      `Generate the "${screenName}" page for "${projectName}".\n\n` +
      `${aestheticGuide}\n\n` +
      `This page: "${screenName}"\n` +
      `All pages in the project: ${allScreenNames}\n` +
      `Other pages (reference only, no real navigation needed): ${otherScreens}\n\n` +
      `Requirements:\n` +
      `- Complete standalone HTML document (<!DOCTYPE html><html><head>…<body>…</body></html>)\n` +
      `- Full realistic UI specifically for the "${screenName}" page\n` +
      `- Include a navigation header or sidebar listing the other page names as non-functional labels\n` +
      `- Realistic placeholder data and copy (no lorem ipsum)\n` +
      `- All relevant UI elements for this page (forms, tables, cards, charts as appropriate)\n` +
      `- Use Tailwind CSS via CDN (https://cdn.tailwindcss.com) for styling\n\n` +
      `Return ONLY the complete HTML document. No markdown fences, no explanation.`;

    fp.getState().setScreenStatus(screenId, "generating");
    fp.getState().setActiveScreen(screenId);
    setInteractiveMode(false);  // exit editor before regenerating so re-injection is clean
    setAppState(AppState.CODING);

    let streamBuffer = "";
    let succeeded = true;

    const regenParams = {
      ...settings,
      generationScope: "full_project" as const,
      generationType: "create" as const,
      inputMode: "text" as const,
      variantCount: 1,
      userId: session?.user.id,
      prompt: { text: screenPrompt, images: [] as string[] },
    };

    await new Promise<void>((resolve, reject) => {
      generateCode(
        wsRef,
        regenParams,
        {
          onChange: (chunk, _vi) => {
            streamBuffer += chunk;
            fp.getState().setScreenHtml(screenId, streamBuffer);
          },
          onSetCode: (code, _vi) => {
            streamBuffer = code;
            fp.getState().setScreenHtml(screenId, code);
          },
          onStatusUpdate: () => {},
          onVariantComplete: () => {},
          onVariantError: (_vi, err) => {
            fp.getState().setScreenStatus(screenId, "error");
            toast.error(`Regeneration failed: ${err}`);
            setAppState(AppState.CODE_READY);
            succeeded = false;
            reject(new Error(err));
          },
          onVariantCount: () => {},
          onCancel: () => {
            fp.getState().setScreenStatus(screenId, "error");
            setAppState(AppState.CODE_READY);
            succeeded = false;
            reject(new Error("__cancelled__"));
          },
          onComplete: () => resolve(),
        }
      );
    }).catch((err: Error) => {
      if (err.message !== "__cancelled__") {
        console.error(`[FP] Regenerate screen "${screenName}" failed:`, err);
      }
    });

    if (!succeeded) return;
    fp.getState().setScreenStatus(screenId, "complete");

    // After regeneration, reset mobileHtml to the freshly generated desktop HTML so both
    // views reflect the new content.  Desktop and mobile then diverge independently as the
    // user makes device-specific edits — they are NEVER silently shared after this point.
    const regeneratedHtml = fp.getState().screens.find((s) => s.id === screenId)?.html ?? streamBuffer;
    if (regeneratedHtml.trim()) {
      useFullProjectStore.setState((state) => ({
        screens: state.screens.map((s) =>
          s.id === screenId
            ? { ...s, mobileHtml: regeneratedHtml, originalMobileHtml: regeneratedHtml }
            : s
        ),
      }));
    }

    await saveFPScreensToSupabase();
    setAppState(AppState.CODE_READY);
    toast.success(`"${screenName}" regenerated`);
  }

  // Stable ref so the event listener always calls the latest doRegenerateScreen
  const doRegenerateScreenRef = useRef(doRegenerateScreen);
  doRegenerateScreenRef.current = doRegenerateScreen;

  useEffect(() => {
    const handler = (e: Event) => {
      const { screenId, screenName } = (e as CustomEvent<{ screenId: string; screenName: string }>).detail;
      void doRegenerateScreenRef.current(screenId, screenName);
    };
    window.addEventListener("fp:regenerate-screen", handler);
    return () => window.removeEventListener("fp:regenerate-screen", handler);
  }, []);

  function doCreate(images: string[], mode: "image" | "video") {

    // ONLY clear generation state
    setAppState(AppState.INITIAL);
    resetExecutionConsoles();

    setReferenceImages(images);
    setInputMode(mode);

    if (images.length > 0) {
      doGenerateCode({
        generationType: "create",
        inputMode: mode,
        prompt: { text: "", images: [images[0]] },
        // Full Project: 1 variant only — simultaneous multi-page generation is too large
        ...(settings.generationScope === "full_project" ? { variantCount: 1 } : {}),
      });
    }
  }

  function doCreateFromText(text: string) {
    // Full Project scope → multi-phase Visily-like generation
    if (settings.generationScope === "full_project") {
      void doGenerateFullProject(text);
      return;
    }

    // Single page scope — existing flow
    setAppState(AppState.INITIAL);
    resetExecutionConsoles();
    setInputMode("text");
    setInitialPrompt(text);

    doGenerateCode({
      generationType: "create",
      inputMode: "text",
      prompt: { text, images: [] },
    });
  }

  async function doUpdate(updateInstruction: string, selectedElement?: HTMLElement) {
    if (!updateInstruction.trim()) {
      toast.error("Please include instructions for AI on what to update.");
      return;
    }

    // ── Full Project: AI-edit the currently active screen ─────────────────────
    const fpState = useFullProjectStore.getState();
    if (fpState.isActive && fpState.activeScreenId) {
      const activeScreen = fpState.screens.find((s) => s.id === fpState.activeScreenId);
      if (!activeScreen || !activeScreen.html.trim()) {
        toast.error("No screen selected to update.");
        return;
      }

      const capturedImages = updateImages;  // capture before clearing
      setUpdateInstruction("");
      setUpdateImages([]);

      // ── Element-only surgical update ──────────────────────────────────────────
      // When a specific element is selected, only regenerate that element and
      // surgically replace it in the page — avoiding whole-page regeneration.
      if (selectedElement) {
        const marker = `dsr-update-${Date.now()}`;
        selectedElement.setAttribute("data-dsr-update-target", marker);
        const elementHtml = selectedElement.outerHTML;

        // Snapshot the live iframe DOM so the marker is included.
        const livePageHtml =
          previewIframeRef.current?.contentDocument?.documentElement?.outerHTML
          ?? activeScreen.html;

        const elementPrompt =
          `You are editing a single HTML element. Return ONLY the updated element's outer HTML — no surrounding tags, no explanation, no markdown fences.\n\n` +
          `Instruction: ${updateInstruction}\n\n` +
          `ELEMENT:\n${elementHtml}`;

        setAppState(AppState.CODING);
        let newElementHtml = "";

        generateCode(wsRef, {
          ...settings,
          generationScope: "full_project" as const,
          generationType: "create" as const,
          inputMode: "text" as const,
          variantCount: 1,
          prompt: { text: elementPrompt, images: capturedImages },
        }, {
          onChange:        (chunk, _vi) => { newElementHtml += chunk; },
          onSetCode:       (code,  _vi) => { newElementHtml = code; },
          onStatusUpdate:  () => {},
          onVariantComplete: () => {},
          onVariantCount:  () => {},
          onVariantError: (_vi, err) => {
            selectedElement.removeAttribute("data-dsr-update-target");
            toast.error(`Element update failed: ${err}`);
            setAppState(AppState.CODE_READY);
          },
          onCancel: () => {
            selectedElement.removeAttribute("data-dsr-update-target");
            setAppState(AppState.CODE_READY);
          },
          onComplete: () => {
            // Strip any accidental markdown fences from the AI response
            let clean = newElementHtml.trim()
              .replace(/^```html?\s*/i, "").replace(/```\s*$/, "").trim();

            try {
              const parser = new DOMParser();
              const doc2 = parser.parseFromString(livePageHtml, "text/html");
              const targetEl = doc2.querySelector(`[data-dsr-update-target="${marker}"]`);
              if (targetEl && clean) {
                const tmp = doc2.createElement("div");
                tmp.innerHTML = clean;
                const newEl = tmp.firstElementChild;
                if (newEl) {
                  newEl.removeAttribute("data-dsr-update-target");
                  targetEl.parentNode?.replaceChild(newEl, targetEl);
                } else {
                  targetEl.removeAttribute("data-dsr-update-target");
                }
                const updatedHtml = `<!DOCTYPE html>\n${doc2.documentElement.outerHTML}`;
                useFullProjectStore.getState().setScreenHtml(activeScreen.id, updatedHtml);
              } else {
                selectedElement.removeAttribute("data-dsr-update-target");
              }
            } catch {
              selectedElement.removeAttribute("data-dsr-update-target");
              toast.error("Could not apply element update.");
            }

            setAppState(AppState.CODE_READY);
            toast.success("Element updated");
            void saveFPScreensToSupabase();
          },
        });
        return;
      }

      // ── Whole-screen update (no selected element) ─────────────────────────────
      const savedHtml = activeScreen.html;
      const updatePromptText =
        `Update this HTML page. Instruction: ${updateInstruction}\n\n` +
        `Return ONLY the complete updated HTML document, no markdown fences, no explanation.\n\n` +
        `CURRENT HTML:\n${activeScreen.html.slice(0, 28000)}`;

      setAppState(AppState.CODING);
      useFullProjectStore.getState().setScreenStatus(activeScreen.id, "generating");
      let streamBuffer = "";

      generateCode(
        wsRef,
        {
          ...settings,
          generationScope: "full_project" as const,
          generationType: "create" as const,
          inputMode: "text" as const,
          variantCount: 1,
          prompt: { text: updatePromptText, images: capturedImages },
        },
        {
          onChange: (chunk, _vi) => {
            streamBuffer += chunk;
            useFullProjectStore.getState().setScreenHtml(activeScreen.id, streamBuffer);
          },
          onSetCode: (code, _vi) => {
            streamBuffer = code;
            useFullProjectStore.getState().setScreenHtml(activeScreen.id, code);
          },
          onStatusUpdate: () => {},
          onVariantComplete: () => {},
          onVariantError: (_vi, err) => {
            useFullProjectStore.getState().setScreenStatus(activeScreen.id, "error");
            toast.error(`Update failed: ${err}`);
            setAppState(AppState.CODE_READY);
          },
          onVariantCount: () => {},
          onCancel: () => {
            useFullProjectStore.getState().setScreenHtml(activeScreen.id, savedHtml);
            useFullProjectStore.getState().setScreenStatus(activeScreen.id, "complete");
            setAppState(AppState.CODE_READY);
          },
          onComplete: () => {
            useFullProjectStore.getState().setScreenStatus(activeScreen.id, "complete");
            setAppState(AppState.CODE_READY);
            toast.success(`${activeScreen.name} updated`);
            void saveFPScreensToSupabase();
          },
        }
      );
      return;
    }

    // ── Single page: existing flow ─────────────────────────────────────────────
    if (head === null) {
      toast.error("No current version set.");
      throw new Error("Update called with no head");
    }
    let historyTree;
    try { historyTree = extractHistory(head, commits); }
    catch { toast.error("Version history invalid."); throw new Error("Invalid version history"); }

    let instruction = updateInstruction;
    if (selectedElement)
      instruction =
        `Update ONLY the following element and nothing else. Keep all other HTML content, structure, and styles EXACTLY the same. ` +
        `Instruction: ${updateInstruction}\n\nTARGET ELEMENT:\n${selectedElement.outerHTML}`;

    doGenerateCode({
      generationType: "update",
      inputMode,
      prompt: inputMode === "text"
        ? { text: initialPrompt, images: [] }
        : { text: "", images: [referenceImages[0]] },
      history: [...historyTree, { text: instruction, images: updateImages }],
      isImportedFromCode,
    });
    setUpdateInstruction("");
    setUpdateImages([]);
  }

  function summarizeWireframeForPrompt(html: string): string {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const usefulTags = new Set([
        "header", "nav", "main", "section", "article", "aside", "footer",
        "div", "form", "label", "input", "textarea", "select", "button",
        "h1", "h2", "h3", "h4", "p", "span", "a", "ul", "ol", "li",
        "table", "thead", "tbody", "tr", "th", "td", "img"
      ]);
      const lines: string[] = [];
      const walk = (element: Element, depth = 0) => {
        if (lines.length > 180 || depth > 5) return;
        const tag = element.tagName.toLowerCase();
        if (!usefulTags.has(tag)) return;

        const text = (element.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 90);
        const role =
          element.getAttribute("aria-label") ||
          element.getAttribute("placeholder") ||
          element.getAttribute("alt") ||
          "";
        const classHint = (element.getAttribute("class") || "")
          .split(/\s+/)
          .filter((item) =>
            /grid|flex|col|row|card|sidebar|nav|button|input|modal|table|hero|header|footer|panel|section/i.test(item)
          )
          .slice(0, 6)
          .join(" ");

        lines.push(
          `${"  ".repeat(depth)}- ${tag}${role ? ` (${role})` : ""}${classHint ? ` [${classHint}]` : ""}${text ? `: ${text}` : ""}`
        );

        Array.from(element.children).slice(0, 10).forEach((child) => walk(child, depth + 1));
      };

      Array.from(doc.body.children).slice(0, 30).forEach((child) => walk(child, 0));
      const summary = lines.join("\n").slice(0, 12000);
      return summary || "Single-screen wireframe layout with unlabeled regions. Add complete readable UI copy.";
    } catch {
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/data:[^'")\s]+/gi, "[asset]")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 12000);
    }
  }

  async function doTransformFPScreenToHighFi(screenId: string, screenName: string, wireframeHtml: string) {
    const fp = useFullProjectStore;
    const fpState = fp.getState();
    const layoutSummary = summarizeWireframeForPrompt(wireframeHtml);
    const otherScreenNames = fpState.screens
      .filter((s) => s.id !== screenId)
      .map((s) => s.name)
      .join(", ");

    const transformPrompt =
      `Transform this wireframe into a polished high-fidelity product UI for the "${screenName}" page of "${fpState.projectName}".\n\n` +
      `Wireframe layout summary:\n${layoutSummary}\n\n` +
      `Requirements:\n` +
      `- Complete standalone HTML document (<!DOCTYPE html><html><head>...</head><body>...</body></html>)\n` +
      `- Polished final product UI: gradients, modern shadows, real readable copy, icons, accessible contrast\n` +
      `- Preserve the same layout, hierarchy, and user flow from the wireframe\n` +
      `- Use Tailwind CSS via CDN (https://cdn.tailwindcss.com) for styling\n` +
      (otherScreenNames ? `- Include navigation referencing the other pages: ${otherScreenNames}\n` : "") +
      `\nReturn ONLY the complete HTML document. No markdown fences, no explanation.`;

    fp.getState().setScreenStatus(screenId, "generating");
    fp.getState().setActiveScreen(screenId);
    setInteractiveMode(false);
    setAppState(AppState.CODING);

    let streamBuffer = "";
    let succeeded = true;

    const transformParams = {
      ...settings,
      generationScope: "full_project" as const,
      generationType: "create" as const,
      inputMode: "text" as const,
      variantCount: 1,
      userId: session?.user.id,
      prompt: { text: transformPrompt, images: [] as string[] },
    };

    await new Promise<void>((resolve, reject) => {
      generateCode(
        wsRef,
        transformParams,
        {
          onChange: (chunk, _vi) => {
            streamBuffer += chunk;
            fp.getState().setScreenHtml(screenId, streamBuffer);
          },
          onSetCode: (code, _vi) => {
            streamBuffer = code;
            fp.getState().setScreenHtml(screenId, code);
          },
          onStatusUpdate: () => {},
          onVariantComplete: () => {},
          onVariantError: (_vi, err) => {
            fp.getState().setScreenStatus(screenId, "error");
            toast.error(`Transform failed: ${err}`);
            setAppState(AppState.CODE_READY);
            succeeded = false;
            reject(new Error(err));
          },
          onVariantCount: () => {},
          onCancel: () => {
            fp.getState().setScreenStatus(screenId, "error");
            setAppState(AppState.CODE_READY);
            succeeded = false;
            reject(new Error("__cancelled__"));
          },
          onComplete: () => resolve(),
        }
      );
    }).catch((err: Error) => {
      if (err.message !== "__cancelled__") {
        console.error(`[FP] Transform screen "${screenName}" failed:`, err);
      }
    });

    if (!succeeded) return;
    fp.getState().setScreenStatus(screenId, "complete");
    await saveFPScreensToSupabase();
    setAppState(AppState.CODE_READY);
    toast.success(`"${screenName}" transformed to high-fidelity UI`);
  }

  function transformWireframeToHighFi() {
    // FP mode: transform the active screen to high-fi
    const fpState = useFullProjectStore.getState();
    if (fpState.isActive) {
      const activeScreen = fpState.screens.find((s) => s.id === fpState.activeScreenId);
      if (!activeScreen || !activeScreen.html.trim()) {
        toast.error("No wireframe screen is ready to transform. Generate the project first.");
        return;
      }
      void doTransformFPScreenToHighFi(activeScreen.id, activeScreen.name, activeScreen.html);
      return;
    }

    // Single-page mode: existing logic
    if (head === null || !commits[head]) {
      toast.error("No wireframe is ready to transform.");
      return;
    }

    const currentCommit = commits[head];
    const currentCode =
      currentCommit.variants[currentCommit.selectedVariantIndex]?.code ?? "";

    if (!currentCode.trim()) {
      toast.error("No wireframe code found to transform.");
      return;
    }

    setSettings((previous) => ({ ...previous, aestheticMode: AestheticMode.HIGH_FI }));
    const layoutSummary = summarizeWireframeForPrompt(currentCode);
    const transformPromptText = `Transform this low-fidelity wireframe layout summary into a polished final product UI.

Wireframe layout summary:

${layoutSummary}

Create a complete standalone HTML page.

Preserve the same layout, hierarchy and user flow.

Add:
- final visual design
- real readable copy
- typography
- spacing
- colors
- cards
- icons where useful
- accessible contrast

Return COMPLETE standalone HTML only.`;

    doGenerateCode({
      generationType: "create",
      inputMode: "text",
      prompt: {
        text: transformPromptText,
        images: [],
      },
      variantCount: 1,
    });
  }

  const handleTermDialogOpenChange = (open: boolean) =>
    setSettings((s) => ({ ...s, isTermOfServiceAccepted: !open }));

  function setStack(stack: Stack) {
    setSettings((p) => ({ ...p, generatedCodeConfig: stack }));
  }

  function importFromCode(code: string, stack: Stack) {
    reset();
    setIsImportedFromCode(true);
    setStack(stack);
    const commit = createCommit({ type: "code_create", parentHash: null, variants: [{ code }], inputs: null });
    addCommit(commit);
    setHead(commit.hash);
    setAppState(AppState.CODE_READY);
  }

  function loadFullProject(projectState: any, rowId?: number, title?: string, notes?: string) {
    reset();

    // ── Restore a multi-screen Full Project saved by saveFPScreensToSupabase ──
    if (projectState?.fullProject) {
      const fp = projectState.fullProject;
      useFullProjectStore.setState({
        isActive: true,
        projectName: title?.trim() || fp.projectName || "Project",
        projectNotes: notes?.trim() || "",
        planStatus: "ready" as const,
        // Normalise screens loaded from DB: fill in any fields absent from older saves.
        // originalHtml/originalMobileHtml were added later — fall back to html so the
        // Reset button has a valid target even when loading a pre-fix DB row.
        screens: (fp.screens || []).map((s: any) => ({
          ...s,
          originalHtml:       s.originalHtml       ?? s.html ?? "",
          mobileHtml:         s.mobileHtml         ?? s.html ?? "",
          originalMobileHtml: s.originalMobileHtml ?? s.originalHtml ?? s.html ?? "",
        })),
        activeScreenId:
          fp.activeScreenId ||
          (fp.screens?.find((s: any) => s.status === "complete")?.id ?? fp.screens?.[0]?.id ?? null),
        generationError: null,
        dbRowId: rowId ?? null,
      });
      // Restore the original prompt so the Regenerate button works
      if (fp.initialPrompt || fp.projectName) {
        setInitialPrompt(fp.initialPrompt || fp.projectName);
      }
      setAppState(AppState.CODE_READY);
      return;
    }

    // ── Restore single-page commit state ──────────────────────────────────────
    useProjectStore.setState({
      commits:         projectState.commits,
      head:            projectState.head,
      referenceImages: projectState.referenceImages || [],
      inputMode:       projectState.inputMode || "text",
      initialPrompt:   projectState.initialPrompt || "",
    });
    // Track the loaded row so subsequent saves UPDATE this row instead of
    // inserting a new one (prevents history duplication on re-edit).
    spDbRowIdRef.current = rowId ?? null;
    // Sync title/notes to the sidebar ProjectInfoCard
    setLoadedProjectTitle(title ?? null);
    setLoadedProjectNotes(notes ?? null);
    setAppState(AppState.CODE_READY);
  }

  // 閳光偓閳光偓 Render 閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓閳光偓
  if (checkingAuth) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-stone-950 text-stone-400 font-mono text-sm">
        Loading WireUIframe...
      </div>
    );
  }

  if (!session) return <Login onLoginSuccess={() => {}} />;

  const panelBase  = "fixed top-0 bottom-0 z-50 transition-all duration-300 ease-in-out border-r border-stone-800 shadow-2xl";
  const panelOpen  = "left-16 translate-x-0 opacity-100 pointer-events-auto";
  const panelClose = "left-16 -translate-x-full opacity-0 pointer-events-none";

  return (
    <div className="flex h-screen overflow-hidden bg-stone-950 text-stone-300">
      {IS_RUNNING_ON_CLOUD && <PicoBadge />}
      {IS_RUNNING_ON_CLOUD && (
        <TermsOfServiceDialog
          open={!settings.isTermOfServiceAccepted}
          onOpenChange={handleTermDialogOpenChange}
        />
      )}

      {/* 1. Navigation Rail */}
      <NavigationRail
        activeMenu={activeMenu}
        setActiveMenu={(id) => { setActiveMenu(id); setExpandedPanel(null); }}
        onLogout={() => supabase.auth.signOut()}
        onSettingsClick={() => { setExpandedPanel(null); setIsSettingsOpen(true); }}
        onNewProject={() => { setExpandedPanel(null); reset(); }}
        onDashboard={() => {
          setExpandedPanel(null);
          // Only ask if user has actual AI-generated content (not just a blank canvas import)
          // or unsaved interactive edits
          if ((head !== null && !isImportedFromCode) || hadInteractiveEdits) {
            setShowBlankCanvasDialog(true);
          } else {
            const blankHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"><\/script></head><body class="bg-white min-h-screen"></body></html>`;
            importFromCode(blankHtml, settings.generatedCodeConfig);
            setActiveMenu(null);
          }
        }}
      />

      <SettingsDialog settings={settings} setSettings={setSettings} open={isSettingsOpen} setOpen={setIsSettingsOpen} />

      {/* 2. History slide-out */}
      <div className={`${panelBase} w-80 bg-stone-950 ${activeMenu === "history" ? panelOpen : panelClose}`}>
        <HistoryPanel
          session={session}
          onClose={() => setActiveMenu(null)}
          onExpand={() => { setActiveMenu(null); setExpandedPanel("history"); }}
          refreshTrigger={historyRefreshKey}
          onLoadState={(projectState, code, rowId, title, notes) => {
            if (projectState) loadFullProject(projectState, rowId, title, notes);
            else if (code) importFromCode(code, settings.generatedCodeConfig);
            setActiveMenu(null);
          }}
          onLoadStoryboard={(storyboard) => {
            setRestoredStoryboard(storyboard);
            setActiveStoryboardTitle(storyboard.title ?? "Storyboard");
            setActiveStoryboardNotes("");
            setSettings((p) => ({ ...p, aestheticMode: AestheticMode.GAMING_STORYBOARD }));
            setAppState(AppState.INITIAL);
            setActiveMenu(null);
          }}
        />
      </div>

      {/* 3. Element Library slide-out */}
      <div className={`${panelBase} w-80 bg-stone-950 ${activeMenu === "library" ? panelOpen : panelClose}`}>
        <ElementLibrary
          onClose={() => setActiveMenu(null)}
          onExpand={() => { setActiveMenu(null); setExpandedPanel("library"); }}
          getCurrentCode={getCurrentCode}
          iframeRef={previewIframeRef}
        />
      </div>

      {/* 3b. Dashboard slide-out — REMOVED (dashboard now opens blank canvas directly) */}
      {false && <div className={`${panelBase} w-96 bg-stone-950 ${activeMenu === "dashboard" ? panelOpen : panelClose}`}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-stone-800 p-4 shrink-0">
            <div>
              <h2 className="text-sm font-bold text-white">Dashboard</h2>
              <p className="text-[10px] font-mono text-stone-500">Start a new project or pick a template</p>
            </div>
            <button onClick={() => setActiveMenu(null)} className="rounded p-1 text-stone-500 hover:bg-stone-800 hover:text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Quick-start options */}
            <div>
              <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-stone-500">Quick Start</p>
              <div className="space-y-2">
                {[
                  { icon: "✦", label: "Blank Canvas", sub: "Start from scratch with a clean page", action: () => { reset(); setActiveMenu(null); } },
                  { icon: "🖼", label: "From Screenshot", sub: "Upload a design screenshot to clone", action: () => { reset(); setActiveMenu(null); } },
                  { icon: "✍️", label: "From Description", sub: "Describe your UI and let AI build it", action: () => { reset(); setActiveMenu(null); } },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="w-full text-left rounded-xl border border-stone-800 bg-stone-900/40 p-4 hover:border-amber-500/40 hover:bg-stone-800 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">{item.label}</p>
                        <p className="text-[11px] text-stone-500">{item.sub}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent projects hint */}
            <div>
              <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-stone-500">Recent Projects</p>
              <div className="rounded-xl border border-stone-800 bg-stone-900/20 p-6 text-center">
                <p className="text-xs text-stone-500 font-mono">Open History to see your recent projects</p>
                <button
                  onClick={() => setActiveMenu("history")}
                  className="mt-3 rounded-lg border border-stone-700 bg-stone-800 px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-700 hover:text-white transition"
                >
                  Browse History →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>}

      {/* Save Component Modal — listens for iframe postMessage events */}
      <SaveComponentModal />

      {/* Blank Canvas — unsaved changes confirmation dialog */}
      {showBlankCanvasDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">Open Blank Canvas?</h3>
            <p className="text-xs text-stone-400 mb-5">
              You have unsaved changes. Do you want to save your current project before opening a blank canvas?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  // Save then open blank canvas
                  window.dispatchEvent(new CustomEvent("designer:request-save-dialog"));
                  setShowBlankCanvasDialog(false);
                }}
                className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
              >
                💾 Save first
              </button>
              <button
                onClick={() => {
                  // Discard and open blank canvas
                  window.dispatchEvent(new CustomEvent("designer:discard-edits"));
                  setHadInteractiveEdits(false);
                  setInteractiveMode(false);
                  const blankHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"><\/script></head><body class="bg-white min-h-screen"></body></html>`;
                  importFromCode(blankHtml, settings.generatedCodeConfig);
                  setShowBlankCanvasDialog(false);
                  setActiveMenu(null);
                }}
                className="w-full rounded-lg bg-stone-700 px-3 py-2 text-xs font-bold text-stone-200 hover:bg-stone-600 transition-colors"
              >
                Don&apos;t Save — open blank canvas
              </button>
              <button
                onClick={() => setShowBlankCanvasDialog(false)}
                className="w-full rounded-lg border border-stone-700 px-3 py-2 text-xs font-bold text-stone-400 hover:bg-stone-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Layout dialog (blank canvas — lets user name + add notes) */}
      {saveDialogOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-96 rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">Save Project</h3>
            <p className="text-xs text-stone-400 mb-4">Name your project and add optional notes before saving.</p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block mb-1">Project Name</label>
                <input
                  autoFocus
                  value={saveDialogTitle}
                  onChange={(e) => setSaveDialogTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      pendingSaveMetaRef.current = { title: saveDialogTitle, notes: saveDialogNotes };
                      setSaveDialogOpen(false);
                      window.dispatchEvent(new CustomEvent("designer:request-save"));
                    }
                  }}
                  placeholder="My Project"
                  className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-stone-400 uppercase tracking-wider block mb-1">Notes (optional)</label>
                <textarea
                  value={saveDialogNotes}
                  onChange={(e) => setSaveDialogNotes(e.target.value)}
                  placeholder="Describe this design…"
                  rows={3}
                  className="w-full rounded-lg border border-stone-600 bg-stone-800 px-3 py-2 text-sm text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  pendingSaveMetaRef.current = { title: saveDialogTitle, notes: saveDialogNotes };
                  setSaveDialogOpen(false);
                  window.dispatchEvent(new CustomEvent("designer:request-save"));
                }}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-stone-950 hover:bg-amber-400 transition"
              >
                💾 Save
              </button>
              <button
                onClick={() => setSaveDialogOpen(false)}
                className="flex-1 rounded-lg border border-stone-700 bg-stone-800 px-4 py-2 text-sm font-semibold text-stone-300 hover:bg-stone-700 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded panel overlay (History or Element Library full-screen)
          left-16 preserves the NavigationRail; HistoryPanel provides its own header */}
      {expandedPanel && (
        <div className="fixed inset-y-0 left-16 right-0 z-[200] bg-stone-950 flex flex-col">
          <div className="flex-1 overflow-hidden">
            {expandedPanel === "history" && (
              <HistoryPanel
                session={session}
                onClose={() => setExpandedPanel(null)}
                refreshTrigger={historyRefreshKey}
                onLoadState={(projectState, code, rowId, title, notes) => {
                  if (projectState) loadFullProject(projectState, rowId, title, notes);
                  else if (code) importFromCode(code, settings.generatedCodeConfig);
                  setActiveMenu(null);
                  setExpandedPanel(null);
                }}
                onLoadStoryboard={(storyboard) => {
                  setRestoredStoryboard(storyboard);
                  setActiveStoryboardTitle(storyboard.title ?? "Storyboard");
                  setActiveStoryboardNotes("");
                  setSettings((p) => ({ ...p, aestheticMode: AestheticMode.GAMING_STORYBOARD }));
                  setAppState(AppState.INITIAL);
                  setActiveMenu(null);
                  setExpandedPanel(null);
                }}
                isExpanded
              />
            )}
            {expandedPanel === "library" && (
              <ElementLibrary
                onClose={() => setExpandedPanel(null)}
                getCurrentCode={getCurrentCode}
                iframeRef={previewIframeRef}
                isExpanded
              />
            )}
          </div>
        </div>
      )}

      {/* Floating sidebar toggle tab — sits on the boundary between sidebar and preview */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        className={`fixed top-1/2 -translate-y-1/2 z-[70] transition-all duration-200
          w-5 h-12 bg-white rounded-r-full shadow-lg
          flex items-center justify-center
          text-stone-600 hover:text-stone-900 hover:bg-stone-100
          border border-l-0 border-stone-200
          ${sidebarCollapsed ? 'left-16' : 'left-[28rem]'}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          {sidebarCollapsed
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          }
        </svg>
      </button>

      {/* 4. Main Sidebar */}
      <div className={`lg:fixed lg:left-16 lg:inset-y-0 lg:z-40 lg:flex lg:w-96 lg:flex-col border-r border-stone-800 bg-stone-950 select-none transition-transform duration-200 ${sidebarCollapsed ? 'lg:-translate-x-full' : ''}`}>
        <div className="flex grow flex-col overflow-y-auto">

          {/* Sidebar header */}
          <div className="px-4 py-4 border-b border-stone-800 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded bg-stone-900 border border-stone-700 flex items-center justify-center text-amber-500 font-mono text-sm shadow">
                {"[ ]"}
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-white font-sans">WireUIframe</h1>
                <p className="text-[10px] text-stone-500 font-mono">TEXT & IMAGE TO WIREFRAME/UI</p>
              </div>
            </div>
            <div className="text-xs text-stone-600 font-mono flex items-center gap-1.5">
              <FaUserCircle className="h-3.5 w-3.5" />
              <span className="truncate max-w-[110px]">{session.user.email}</span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {IS_RUNNING_ON_CLOUD && !settings.openAiApiKey && <OnboardingNote />}

            {/* Initial state: full generation settings panel */}
            {appState === AppState.INITIAL && settings.aestheticMode !== "gaming_storyboard" && (
              <GenerationSettings
                settings={settings}
                setSettings={setSettings}
                doCreateFromText={doCreateFromText}
                doCreate={doCreate}
              />
            )}

            {/* Gaming Storyboard mode — storyboard generator fills the main area;
                show a minimal guide panel in the sidebar instead of the full settings form */}
            {appState === AppState.INITIAL && settings.aestheticMode === "gaming_storyboard" && (
              <div className="space-y-4">
                {/* Mode badge */}
                <div className="flex items-center gap-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40 px-3 py-2.5">
                  <span className="text-xl">🎮</span>
                  <div>
                    <p className="text-sm font-bold text-emerald-300">Game Storyboard Mode</p>
                    <p className="text-[11px] text-emerald-500/80 font-mono leading-snug mt-0.5">
                      {activeStoryboardTitle ? "Active storyboard" : "Describe your game scenario on the right"}
                    </p>
                  </div>
                </div>

                {/* When a storyboard is active: show title + notes */}
                {activeStoryboardTitle ? (
                  <StoryboardMetaPanel
                    title={activeStoryboardTitle}
                    notes={activeStoryboardNotes}
                    onTitleChange={setActiveStoryboardTitle}
                    onNotesChange={setActiveStoryboardNotes}
                  />
                ) : (
                  /* Quick guide — shown before any storyboard is generated */
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">How it works</p>
                    {[
                      { icon: "✍️", text: "Describe your game idea, mechanics, and story in the main area" },
                      { icon: "⚡", text: "Claude generates a sequential storyboard of gameplay scenes" },
                      { icon: "🎨", text: "Each scene has a sketch space and editable metadata" },
                      { icon: "💾", text: "Save your storyboard to history for later editing" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 rounded-lg bg-stone-900/40 px-3 py-2 border border-stone-800">
                        <span className="text-base leading-none mt-0.5 shrink-0">{item.icon}</span>
                        <p className="text-xs text-stone-400 leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Switch mode hint */}
                <div className="rounded-lg border border-stone-800 bg-stone-900/30 px-3 py-2.5">
                  <p className="text-[10px] text-stone-500 font-mono leading-relaxed">
                    To switch back to UI generation mode, open{" "}
                    <span className="text-amber-400">Settings</span> and change the Aesthetic.
                  </p>
                </div>
              </div>
            )}

            {/* Coding / ready state: update sidebar */}
            {(appState === AppState.CODING || appState === AppState.CODE_READY) && (
              <Sidebar
                doUpdate={doUpdate}
                transformWireframeToHighFi={transformWireframeToHighFi}
                regenerate={regenerate}
                cancelCodeGeneration={cancelCodeGeneration}
                externalTitle={loadedProjectTitle}
                externalNotes={loadedProjectNotes}
                onInspect={() => {
                  const entering = !isInspectMode;
                  setInspectMode(entering);
                  if (entering) {
                    setInteractiveMode(false); // ensure interactive edit is off
                    toast("Click any element to inspect its properties", { icon: "🔍" });
                  }
                }}
                onTitleNotesChange={async (title, notes) => {
                  if (!spDbRowIdRef.current || !session?.user?.id) return;
                  const { error } = await supabase
                    .from("generations")
                    .update({ title, notes })
                    .eq("id", spDbRowIdRef.current)
                    .eq("user_id", session.user.id);
                  if (error) { console.error("[SIDEBAR TITLE/NOTES] update failed:", error); return; }
                  setHistoryRefreshKey((k) => k + 1);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* 5. Preview pane */}
      <main className={`flex-1 overflow-hidden min-w-0 transition-all duration-200 ${sidebarCollapsed ? 'pl-16' : 'lg:pl-[28rem]'} ${propsPanelOpen ? 'pr-[285px]' : ''}`}>
        {settings.aestheticMode === AestheticMode.GAMING_STORYBOARD && appState === AppState.INITIAL ? (
          // Gaming Storyboard mode — full-width storyboard generator
          <div className="h-full overflow-y-auto">
            <StoryboardGenerator
              key={storyboardResetKey}
              settings={settings}
              userId={session?.user?.id ?? null}
              initialStoryboard={restoredStoryboard}
              onClearInitial={() => setRestoredStoryboard(null)}
              onGenerated={() => setHistoryRefreshKey((k) => k + 1)}
              onStoryboardActive={(t) => setActiveStoryboardTitle(t)}
            />
          </div>
        ) : (
          <>
            {appState === AppState.INITIAL && (
              // Empty state — generation is handled from the sidebar form
              <div className="flex h-full items-center justify-center text-stone-700">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded border-2 border-dashed border-stone-800 flex items-center justify-center text-amber-500/40 font-mono text-2xl">
                    {"[ ]"}
                  </div>
                  <p className="text-sm font-mono text-stone-600">Fill in the sidebar and press Generate</p>
                  <p className="text-xs text-stone-700">Text prompt · screenshot · or both</p>
                </div>
              </div>
            )}
            {(appState === AppState.CODING || appState === AppState.CODE_READY) && (
              <PreviewPane doUpdate={doUpdate} reset={reset} settings={settings} iframeRef={previewIframeRef} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;



