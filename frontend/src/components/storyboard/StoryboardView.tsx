import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import toast from "react-hot-toast";
import StoryboardScene, { Scene } from "./StoryboardScene";

export interface Storyboard {
  title: string;
  genre: string;
  scenes: Scene[];
  boardId?: string; // stable unique ID — namespaces localStorage sketch keys
  _dbId?: number;  // internal: Supabase row id for UPDATE operations (not persisted in JSON)
}

interface Props {
  storyboard: Storyboard;
  onReset: () => void;
  anthropicApiKey?: string | null;
  onSave?: (current: Storyboard) => Promise<void>;
}

// ─── Export dropdown button ───────────────────────────────────────────────────
function ExportButton({
  label,
  disabled,
  options,
}: {
  label: string;
  disabled: boolean;
  options: { label: string; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono
          bg-stone-700 hover:bg-stone-600 text-stone-200 disabled:opacity-40 transition-colors"
      >
        ⬇ {label} ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-stone-800 border border-stone-700
          rounded-lg shadow-xl overflow-hidden min-w-[140px]">
          {options.map((opt) => (
            <button
              key={opt.label}
              onClick={() => { setOpen(false); opt.onClick(); }}
              className="w-full text-left px-3 py-2 text-[10px] font-mono text-stone-300
                hover:bg-stone-700 hover:text-white transition-colors"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── StoryboardView ──────────────────────────────────────────────────────────
export default function StoryboardView({ storyboard, onReset, anthropicApiKey, onSave }: Props) {
  const [scenes, setScenes] = useState<Scene[]>(storyboard.scenes);
  const [boardTitle, setBoardTitle] = useState(storyboard.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Drag-to-reorder
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  // Undo stack — each entry is a full snapshot of scenes before a mutation
  const [undoStack, setUndoStack] = useState<Scene[][]>([]);

  const pushUndo = (current: Scene[]) => {
    setUndoStack((prev) => [...prev.slice(-20), current]); // keep last 20 snapshots
  };

  const handleUndo = () => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setScenes(snapshot);
      return prev.slice(0, -1);
    });
  };

  const updateScene = (updated: Scene) => {
    pushUndo(scenes);
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const addScene = () => {
    pushUndo(scenes);
    const newId = Math.max(0, ...scenes.map((s) => s.id)) + 1;
    setScenes((prev) => [
      ...prev,
      {
        id: newId,
        title: `Scene ${newId}`,
        environment: "",
        playerPosition: "",
        playerAction: "",
        elements: [],
        outcome: "",
        description: "New scene — click any field to edit.",
      },
    ]);
  };

  const removeScene = (id: number) => {
    pushUndo(scenes);
    setScenes((prev) => prev.filter((s) => s.id !== id));
    setConfirmDeleteId(null);
  };

  // Track whether the current mousedown originated on the drag handle vs. canvas.
  // Canvas sets stopPropagation on mousedown, so the card's onMouseDown never fires
  // when the user starts drawing — leaving dragAllowedRef false.
  const dragAllowedRef = useRef(false);

  // Drag-to-reorder handlers
  const handleDragStart = (e: React.DragEvent, id: number) => {
    if (!dragAllowedRef.current) {
      e.preventDefault();
      return;
    }
    setDraggedId(id);
  };
  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (id !== draggedId) setDragOverId(id);
  };
  const handleDrop = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    pushUndo(scenes);
    setScenes((prev) => {
      const arr = [...prev];
      const fromIdx = arr.findIndex((s) => s.id === draggedId);
      const toIdx = arr.findIndex((s) => s.id === targetId);
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
    setDraggedId(null);
    setDragOverId(null);
  };
  const handleDragEnd = () => { setDraggedId(null); setDragOverId(null); };

  // Preserve boardId and _dbId so save correctly UPDATEs the existing row
  const currentStoryboard = (): Storyboard => ({
    title: boardTitle,
    genre: storyboard.genre,
    scenes,
    boardId: storyboard.boardId,
    _dbId: storyboard._dbId,
  });

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      const current = currentStoryboard();
      // Collect each scene's hand-drawn canvas from localStorage and embed it in the
      // scene JSON so it persists to the database under this storyboard's unique key.
      const scenesWithSketches = current.scenes.map((scene) => {
        const key = current.boardId
          ? `storyboard_sketch_${current.boardId}_${scene.id}`
          : `storyboard_sketch_${scene.id}`;
        const drawSketch = localStorage.getItem(key) ?? undefined;
        return { ...scene, drawSketch };
      });
      await onSave({ ...current, scenes: scenesWithSketches });
      toast.success("Storyboard saved!");
    } catch {
      toast.error("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Capture helpers ────────────────────────────────────────────────────────

  const captureElement = (el: HTMLElement, scale = 1.5) =>
    html2canvas(el, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

  const downloadCanvas = (canvas: HTMLCanvasElement, filename: string) => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const safeName = boardTitle.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");

  // Draw a dark title bar above a captured canvas and return the combined canvas
  const addTitleBar = (captured: HTMLCanvasElement, titleText: string): HTMLCanvasElement => {
    const BAR_H = 40;
    const out = document.createElement("canvas");
    out.width = captured.width;
    out.height = captured.height + BAR_H;
    const ctx = out.getContext("2d")!;
    // Title bar background
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(0, 0, out.width, BAR_H);
    // Title text
    const fontSize = Math.round(BAR_H * 0.38);
    ctx.fillStyle = "#e7e5e4";
    ctx.font = `600 ${fontSize}px ui-monospace, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(titleText, Math.round(BAR_H * 0.3), BAR_H / 2);
    // Scene image below
    ctx.drawImage(captured, 0, BAR_H);
    return out;
  };

  // ── PNG exports ────────────────────────────────────────────────────────────

  const handleDownloadAllPng = async () => {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      const canvas = await captureElement(boardRef.current);
      downloadCanvas(canvas, `${safeName}_storyboard.png`);
    } catch {
      toast.error("PNG export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPerScenePng = async () => {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      const cards = Array.from(
        boardRef.current.querySelectorAll<HTMLElement>("[data-scene-id]")
      );
      for (const card of cards) {
        const id = card.dataset.sceneId ?? "";
        const scene = scenes.find((s) => String(s.id) === id);
        const sceneLabel = scene
          ? `${boardTitle}  ·  Scene ${scene.id}: ${scene.title}`
          : `${boardTitle}  ·  Scene ${id}`;

        const captured = await captureElement(card, 2);
        const withTitle = addTitleBar(captured, sceneLabel);
        downloadCanvas(withTitle, `${safeName}_scene_${id}.png`);
        // Small delay so the browser doesn't block multiple sequential downloads
        await new Promise((r) => setTimeout(r, 350));
      }
    } catch {
      toast.error("PNG export failed.");
    } finally {
      setExporting(false);
    }
  };

  // ── PDF exports ────────────────────────────────────────────────────────────

  const openPrintWindow = (body: string, title: string) => {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup blocked — allow popups and retry."); return; }
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; font-family: monospace; }
    img { display: block; width: 100%; height: auto; max-height: 185mm; object-fit: contain; }
    .page { padding: 5mm; }
    .label { font-size: 11px; font-weight: 600; color: #1c1917; margin-bottom: 4px; letter-spacing: 0.01em; }
    .sublabel { font-size: 9px; color: #78716c; margin-bottom: 4px; }
    .break { page-break-after: always; }
    @page { margin: 0; size: A4 landscape; }
  </style>
</head>
<body>${body}
<script>window.onload=function(){window.print();setTimeout(function(){window.close();},1500);}</script>
</body></html>`);
    w.document.close();
  };

  const handleDownloadAllPdf = async () => {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      const canvas = await captureElement(boardRef.current, 1.5);
      const img = canvas.toDataURL("image/png");
      openPrintWindow(
        `<div class="page">
          <p class="label">${boardTitle}</p>
          <p class="sublabel">${storyboard.genre} · ${scenes.length} scenes</p>
          <img src="${img}"/>
        </div>`,
        `${boardTitle} – Storyboard`
      );
    } catch {
      toast.error("PDF export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPerScenePdf = async () => {
    if (!boardRef.current) return;
    setExporting(true);
    try {
      const cards = Array.from(
        boardRef.current.querySelectorAll<HTMLElement>("[data-scene-id]")
      );
      const pages: { id: string; sceneTitle: string; dataUrl: string }[] = [];
      for (const card of cards) {
        const id = card.dataset.sceneId ?? "";
        const scene = scenes.find((s) => String(s.id) === id);
        // Scale 1.0 keeps the image small enough to fit on one landscape A4 page
        const canvas = await captureElement(card, 1.0);
        pages.push({
          id,
          sceneTitle: scene?.title ?? "",
          dataUrl: canvas.toDataURL("image/png"),
        });
      }
      const body = pages
        .map(
          ({ id, sceneTitle, dataUrl }, i) =>
            `<div class="page${i < pages.length - 1 ? " break" : ""}">
              <p class="label">${boardTitle} — Scene ${id}${sceneTitle ? `: ${sceneTitle}` : ""}</p>
              <p class="sublabel">${storyboard.genre}</p>
              <img src="${dataUrl}"/>
            </div>`
        )
        .join("\n");
      openPrintWindow(body, `${boardTitle} – Storyboard`);
    } catch {
      toast.error("PDF export failed.");
    } finally {
      setExporting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Board header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">
            {storyboard.genre}
          </span>
          {editingTitle ? (
            <input
              autoFocus
              className="text-base font-semibold text-stone-800 bg-emerald-50 border border-emerald-400
                rounded px-2 py-0.5 outline-none"
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
            />
          ) : (
            <h2
              className="text-base font-semibold text-stone-800 cursor-text hover:underline
                hover:decoration-dashed"
              onClick={() => setEditingTitle(true)}
            >
              {boardTitle}
            </h2>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {/* Undo */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0 || saving || exporting}
            title="Undo last scene change"
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono
              bg-stone-700 hover:bg-stone-600 text-stone-200 disabled:opacity-30 transition-colors"
          >
            ↩ Undo
          </button>

          {/* Manual save */}
          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving || exporting}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono
                bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors"
              title="Save current edits to history"
            >
              {saving ? (
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : "↑"}
              {saving ? "Saving…" : "Save"}
            </button>
          )}

          {/* PNG dropdown */}
          <ExportButton
            label="PNG"
            disabled={saving || exporting}
            options={[
              { label: "All scenes (1 image)", onClick: handleDownloadAllPng },
              { label: "1 scene per file", onClick: handleDownloadPerScenePng },
            ]}
          />

          {/* PDF dropdown */}
          <ExportButton
            label="PDF"
            disabled={saving || exporting}
            options={[
              { label: "All scenes (1 page)", onClick: handleDownloadAllPdf },
              { label: "1 scene per page", onClick: handleDownloadPerScenePdf },
            ]}
          />

          {exporting && (
            <span className="text-[9px] font-mono text-stone-400 animate-pulse">exporting…</span>
          )}

          <button
            onClick={onReset}
            className="text-[10px] font-mono text-stone-400 hover:text-stone-600 border border-stone-300
              hover:border-stone-400 rounded px-2 py-1 transition-colors"
          >
            ← new scenario
          </button>
        </div>
      </div>

      {/* Scene grid — captured for export */}
      <div ref={boardRef} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 bg-stone-50 p-2 rounded-lg">
        {scenes.map((scene, index) => (
          <div
            key={scene.id}
            className={`relative group/card transition-all ${
              dragOverId === scene.id && draggedId !== scene.id
                ? "ring-2 ring-emerald-400 ring-offset-2 rounded-lg"
                : ""
            } ${draggedId === scene.id ? "opacity-50" : ""}`}
            data-scene-id={scene.id}
            draggable
            onMouseDown={() => { dragAllowedRef.current = true; }}
            onMouseUp={() => { dragAllowedRef.current = false; }}
            onDragStart={(e) => handleDragStart(e, scene.id)}
            onDragOver={(e) => handleDragOver(e, scene.id)}
            onDrop={() => handleDrop(scene.id)}
            onDragEnd={() => { dragAllowedRef.current = false; handleDragEnd(); }}
          >
            <StoryboardScene
              scene={scene}
              sceneIndex={index + 1}
              onUpdate={updateScene}
              anthropicApiKey={anthropicApiKey}
              boardId={storyboard.boardId}
            />

            {/* Delete button — shows confirmation inline */}
            {confirmDeleteId === scene.id ? (
              <div className="absolute -top-2 -right-2 flex gap-1 z-10">
                <button
                  onClick={() => removeScene(scene.id)}
                  className="flex items-center gap-0.5 rounded-full bg-red-600 text-white text-[9px]
                    font-bold px-2 py-0.5 shadow-lg hover:bg-red-500 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="w-5 h-5 rounded-full bg-stone-500 text-white text-[10px] flex items-center
                    justify-center hover:bg-stone-400 transition-colors shadow-sm"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(scene.id)}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white
                  text-[10px] items-center justify-center hidden group-hover/card:flex
                  hover:bg-red-600 shadow-sm z-10"
                title="Remove scene"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {/* Add scene */}
        <button
          onClick={addScene}
          className="border-2 border-dashed border-stone-300 rounded-lg flex flex-col items-center
            justify-center gap-2 min-h-[280px] text-stone-400 hover:border-emerald-400
            hover:text-emerald-500 transition-colors"
        >
          <span className="text-2xl">+</span>
          <span className="text-xs font-mono">add scene</span>
        </button>
      </div>

      <p className="text-[10px] text-stone-400 font-mono text-center">
        Click any field to edit · Draw or generate AI sketches · Use Save to persist edits · Hover a scene to remove
      </p>
    </div>
  );
}
