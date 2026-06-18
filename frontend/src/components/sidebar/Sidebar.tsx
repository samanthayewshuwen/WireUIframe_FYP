import classNames from "classnames";
import toast from "react-hot-toast";
import { useCallback, useEffect, useRef, useState } from "react";
// useRef is used in both ProjectInfoCard and Sidebar
import { AppState } from "../../types";
import { useAppStore } from "../../store/app-store";
import { useProjectStore } from "../../store/project-store";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import CodePreview from "../preview/CodePreview";
import HistoryDisplay from "../history/HistoryDisplay";
import KeyboardShortcutBadge from "../core/KeyboardShortcutBadge";
import SelectAndEditModeToggleButton from "../select-and-edit/SelectAndEditModeToggleButton";
import UpdateImageUpload, { UpdateImagePreview } from "../UpdateImageUpload";
import Variants from "../variants/Variants";
import { useFullProjectStore } from "../../store/full-project-store";

// ── Project info card (shown at top of sidebar when a project is active) ─────
interface ProjectInfoCardProps {
  onTitleNotesChange?: (title: string, notes: string) => void;
}

function ProjectInfoCard({ onTitleNotesChange }: ProjectInfoCardProps) {
  const { initialPrompt, inputMode } = useProjectStore();
  const [notesValue, setNotesValue] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Derive a display title from the prompt/mode (fallback when no custom title)
  const derivedTitle = initialPrompt?.trim()
    ? initialPrompt.length > 80
      ? initialPrompt.slice(0, 80) + "…"
      : initialPrompt
    : inputMode === "image"
    ? "Image Generation"
    : inputMode === "video"
    ? "Video Generation"
    : "Untitled Project";

  const displayTitle = customTitle ?? derivedTitle;

  function startEditTitle() {
    setTitleDraft(displayTitle);
    setEditingTitle(true);
    setTimeout(() => { titleInputRef.current?.focus(); titleInputRef.current?.select(); }, 20);
  }

  function commitTitle() {
    const trimmed = titleDraft.trim();
    const newTitle = trimmed || displayTitle;
    if (trimmed) setCustomTitle(trimmed);
    setEditingTitle(false);
    onTitleNotesChange?.(newTitle, savedNotes);
  }

  return (
    <div className="rounded-xl bg-stone-900/50 border border-stone-800 px-3 py-2.5 mb-3">
      <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider mb-1">Project</p>

      {/* Editable title */}
      {editingTitle ? (
        <input
          ref={titleInputRef}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
            if (e.key === "Escape") setEditingTitle(false);
          }}
          onBlur={commitTitle}
          className="w-full rounded border border-amber-500 bg-stone-800 px-2 py-1 text-sm font-bold text-white focus:outline-none"
        />
      ) : (
        <div
          className="flex items-center gap-1.5 cursor-pointer group"
          onClick={startEditTitle}
          title="Click to rename"
        >
          <span className="text-sm font-semibold text-white leading-snug flex-1 truncate">{displayTitle}</span>
          <svg className="w-3 h-3 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
      )}
      {!editingTitle && (
        <p className="text-[10px] text-amber-400/60 font-mono mt-0.5">✎ Click to rename</p>
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
            className="w-full rounded border border-stone-600 bg-stone-800 px-2 py-1.5 text-xs text-white placeholder-stone-600 focus:border-amber-500 focus:outline-none resize-none"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => { setSavedNotes(notesValue); setEditingNotes(false); onTitleNotesChange?.(displayTitle, notesValue); }}
              className="flex-1 rounded py-1 text-xs bg-amber-600 text-white hover:bg-amber-500 font-semibold transition"
            >Save</button>
            <button
              onClick={() => { setNotesValue(savedNotes); setEditingNotes(false); }}
              className="flex-1 rounded py-1 text-xs bg-stone-700 text-stone-300 hover:bg-stone-600 transition"
            >Cancel</button>
          </div>
        </div>
      ) : (
        <div
          className="mt-1.5 cursor-pointer group"
          onClick={() => { setNotesValue(savedNotes); setEditingNotes(true); }}
          title="Click to add notes"
        >
          {savedNotes ? (
            <p className="text-xs text-stone-400 leading-relaxed group-hover:text-stone-300 transition-colors line-clamp-3">
              {savedNotes}
            </p>
          ) : (
            <p className="text-xs text-stone-600 italic group-hover:text-stone-500 transition-colors">
              + Add notes…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const MAX_UPDATE_IMAGES = 4;
const MAX_UPDATE_IMAGE_BYTES = 5 * 1024 * 1024;

interface SidebarProps {
  doUpdate: (instruction: string) => void;
  transformWireframeToHighFi: () => void;
  regenerate: () => void;
  cancelCodeGeneration: () => void;
  onInspect?: () => void;
  onTitleNotesChange?: (title: string, notes: string) => void;
}

function Sidebar({
  doUpdate,
  transformWireframeToHighFi,
  regenerate,
  cancelCodeGeneration,
  onInspect,
  onTitleNotesChange,
}: SidebarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const {
    appState,
    updateInstruction,
    setUpdateInstruction,
    updateImages,
    setUpdateImages,
    isInteractiveMode,
    setInteractiveMode,
    isInspectMode,
    hadInteractiveEdits,
    setHadInteractiveEdits,
  } = useAppStore();

  const [showExitDialog, setShowExitDialog] = useState(false);

  const { inputMode, referenceImages, head, commits, isImportedFromCode } = useProjectStore();

  const viewedCode =
    head && commits[head]
      ? commits[head].variants[commits[head].selectedVariantIndex].code
      : "";

  const selectedVariant =
    head && commits[head]
      ? commits[head].variants[commits[head].selectedVariantIndex]
      : null;

  const isSelectedVariantComplete = selectedVariant?.status === "complete";
  const isSelectedVariantError = selectedVariant?.status === "error";
  const selectedVariantErrorMessage = selectedVariant?.errorMessage;

  const fileToDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(event.dataTransfer.files);
      const files = droppedFiles.filter((file) =>
        ["image/png", "image/jpeg"].includes(file.type) && file.size <= MAX_UPDATE_IMAGE_BYTES
      );

      if (files.length === 0) {
        toast.error("Drop PNG/JPEG images under 5MB.");
        return;
      }

      if (updateImages.length + files.length > MAX_UPDATE_IMAGES) {
        toast.error(`You can attach up to ${MAX_UPDATE_IMAGES} update images.`);
        return;
      }

      try {
        const newImages = await Promise.all(files.map(fileToDataURL));
        setUpdateImages((previous) => [...previous, ...newImages].slice(0, MAX_UPDATE_IMAGES));
      } catch (error) {
        toast.error("Error reading dropped files.");
        console.error("Error reading dropped files:", error);
      }
    },
    [setUpdateImages, updateImages.length]
  );

  useEffect(() => {
    if ((appState === AppState.CODE_READY || isSelectedVariantComplete) && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [appState, isSelectedVariantComplete]);

  useEffect(() => {
    setIsErrorExpanded(false);
  }, [head, commits[head || ""]?.selectedVariantIndex]);

  const isFPActive = useFullProjectStore((s) => s.isActive);

  return (
    <>
      {/* Project info card — only shown in single-page mode; FP mode has its own card in ScreenNavigator */}
      {!isFPActive && <ProjectInfoCard onTitleNotesChange={onTitleNotesChange} />}

      <Variants />

      {appState === AppState.CODING && !isSelectedVariantComplete && (
        <div className="flex flex-col">
          {inputMode === "video" && (
            <div className="mt-1 mb-4 border-l-4 border-yellow-500 bg-yellow-100 p-2 text-xs text-yellow-700">
              Code generation from videos can take 3-4 minutes. We do multiple passes to get the best result.
            </div>
          )}

          <CodePreview code={viewedCode} />

          <Button onClick={cancelCodeGeneration} className="w-full py-2.5 text-sm dark:bg-gray-700 dark:text-white">
            Cancel All Generations
          </Button>
        </div>
      )}

      {isSelectedVariantError && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-3">
          <div className="text-sm text-red-800">
            <div className="mb-1 font-medium">This option failed to generate because</div>
            {selectedVariantErrorMessage && (
              <div className="mb-2">
                <div className="break-words rounded border border-red-300 bg-red-100 px-2 py-1 font-mono text-xs text-red-700">
                  {selectedVariantErrorMessage.length > 200 && !isErrorExpanded
                    ? `${selectedVariantErrorMessage.slice(0, 200)}...`
                    : selectedVariantErrorMessage}
                </div>
                {selectedVariantErrorMessage.length > 200 && (
                  <button
                    onClick={() => setIsErrorExpanded(!isErrorExpanded)}
                    className="mt-1 text-xs text-red-600 underline hover:text-red-800"
                  >
                    {isErrorExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}
            <div>Switch to another option above to make updates.</div>
          </div>
        </div>
      )}

      {(appState === AppState.CODE_READY || isSelectedVariantComplete) && !isSelectedVariantError && (
        <div
          onDragEnter={() => setIsDragging(true)}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsDragging(false);
            }
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="relative grid w-full gap-2">
            <UpdateImagePreview updateImages={updateImages} setUpdateImages={setUpdateImages} />
            <Textarea
              ref={textareaRef}
              placeholder="Tell the AI what to change..."
              onChange={(event) => setUpdateInstruction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  doUpdate(updateInstruction);
                }
              }}
              value={updateInstruction}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={() => doUpdate(updateInstruction)} className="update-btn flex-1 py-2.5 text-sm font-semibold dark:bg-gray-700 dark:text-white">
                Update <KeyboardShortcutBadge letter="enter" />
              </Button>
              <UpdateImageUpload updateImages={updateImages} setUpdateImages={setUpdateImages} />
            </div>

            {isDragging && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-blue-400 bg-blue-50/90 dark:border-blue-600 dark:bg-gray-800/90">
                <p className="font-medium text-blue-600 dark:text-blue-400">Drop images here</p>
              </div>
            )}
          </div>

          {/* ── Action Buttons ── */}
          <div className="mt-3 space-y-2">
            {/* Row 1: Inspect + Regenerate */}
            <div className="grid grid-cols-2 gap-2">
              {onInspect && (
                <button
                  onClick={onInspect}
                  title={isInspectMode ? "Exit inspect mode" : "Click any element to inspect its properties"}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                    isInspectMode
                      ? "border-amber-500 bg-amber-500 text-stone-950 hover:bg-amber-400"
                      : "border-stone-600 bg-stone-800 text-stone-200 hover:bg-stone-700 hover:text-white"
                  }`}
                >
                  🔍 {isInspectMode ? "Inspect ON" : "Inspect"}
                </button>
              )}
              <button
                onClick={regenerate}
                className="regenerate-btn flex items-center justify-center gap-2 rounded-xl border border-stone-600 bg-stone-800 px-3 py-2.5 text-sm font-semibold text-stone-200 hover:bg-stone-700 hover:text-white transition-all"
              >
                ↺ Regenerate
              </button>
            </div>

            {/* Row 2: Transform to Product UI */}
            <button
              onClick={transformWireframeToHighFi}
              title="Convert a wireframe into a polished final product UI"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition-all"
            >
              ✦ Transform to Product UI
            </button>

            {/* Row 3: Select & Edit + Interactive Edit */}
            <div className="grid grid-cols-2 gap-2">
              <SelectAndEditModeToggleButton />
              <button
                onClick={() => {
                  if (isInteractiveMode) {
                    if (hadInteractiveEdits) {
                      setShowExitDialog(true);
                    } else {
                      setInteractiveMode(false);
                    }
                  } else {
                    useAppStore.getState().setInspectMode(false);
                    setInteractiveMode(true);
                  }
                }}
                title="Toggle drag-and-drop editor: drag, resize, style elements"
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                  isInteractiveMode
                    ? "border-amber-500 bg-amber-500 text-stone-950 hover:bg-amber-400"
                    : "border-stone-600 bg-stone-800 text-stone-200 hover:bg-stone-700 hover:text-white"
                }`}
              >
                ✎ {isInteractiveMode ? "Edit Mode ON" : "Interactive Edit"}
              </button>
            </div>

            {/* Row 4: Save Layout (only when in interactive mode) */}
            {isInteractiveMode && (
              <button
                onClick={() => {
                  if (isImportedFromCode) {
                    window.dispatchEvent(new CustomEvent("designer:request-save-dialog"));
                  } else {
                    window.dispatchEvent(new CustomEvent("designer:request-save"));
                  }
                  setHadInteractiveEdits(false);
                }}
                title="Save your current layout — drag positions, resizes, and all edits"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 transition-all"
              >
                💾 Save Layout
              </button>
            )}
          </div>

          {/* Unsaved changes dialog */}
          {showExitDialog && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="rounded-xl border border-stone-700 bg-stone-900 p-6 shadow-2xl w-80">
                <h3 className="text-base font-bold text-white mb-2">Unsaved Changes</h3>
                <p className="text-sm text-stone-400 mb-5">You have unsaved edits. Do you want to save before exiting?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("designer:request-save"));
                      setHadInteractiveEdits(false);
                      setShowExitDialog(false);
                      setInteractiveMode(false);
                    }}
                    className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 transition-colors"
                  >
                    💾 Save
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("designer:clear-dom-sync-timer"));
                      window.dispatchEvent(new CustomEvent("designer:discard-edits"));
                      setHadInteractiveEdits(false);
                      setShowExitDialog(false);
                      setInteractiveMode(false);
                    }}
                    className="flex-1 rounded-lg bg-stone-700 px-3 py-2.5 text-sm font-bold text-stone-200 hover:bg-stone-600 transition-colors"
                  >
                    Don&apos;t Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex gap-x-2">
        {referenceImages.length > 0 && (
          <div className="flex flex-col">
            <div className={classNames({ "scanning relative": appState === AppState.CODING })}>
              {inputMode === "image" && (
                <img className="w-[340px] rounded-md border border-gray-200" src={referenceImages[0]} alt="Reference" />
              )}
              {inputMode === "video" && (
                <video muted autoPlay loop className="w-[340px] rounded-md border border-gray-200" src={referenceImages[0]} />
              )}
            </div>
            <div className="mt-1 text-center text-sm uppercase text-gray-400">
              {inputMode === "video" ? "Original Video" : "Original Screenshot"}
            </div>
          </div>
        )}
      </div>

      <HistoryDisplay shouldDisableReverts={appState === AppState.CODING || isInteractiveMode} />
    </>
  );
}

export default Sidebar;


