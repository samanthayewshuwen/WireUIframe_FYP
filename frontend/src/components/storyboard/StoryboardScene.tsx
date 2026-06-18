import { useState, useRef, useEffect } from "react";
import { HTTP_BACKEND_URL } from "../../config";

export interface Scene {
  id: number;
  title: string;
  environment: string;
  playerPosition: string;
  playerAction: string;
  elements: string[];
  outcome: string;
  description: string;
  aiSvg?: string;
  drawSketch?: string; // persisted canvas data URL — saved to DB on Save button press
}

interface Props {
  scene: Scene;
  sceneIndex: number; // 1-based positional number shown in header
  onUpdate: (updated: Scene) => void;
  anthropicApiKey?: string | null;
  boardId?: string; // unique per storyboard — namespaces localStorage keys
}

// ─── Hand-draw canvas ───────────────────────────────────────────────────────
function SketchCanvas({
  sceneId,
  boardId,
  initialDrawing,
}: {
  sceneId: number;
  boardId?: string;
  initialDrawing?: string; // data URL from DB — used when localStorage has nothing
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [drawMode, setDrawMode] = useState<"pen" | "eraser">("pen");
  const [canUndo, setCanUndo] = useState(false);
  // Canvas undo stack — each entry is a full pixel snapshot taken before a stroke
  const undoStackRef = useRef<ImageData[]>([]);

  // Namespace by boardId so different storyboards never share the same drawing
  const storageKey = boardId
    ? `storyboard_sketch_${boardId}_${sceneId}`
    : `storyboard_sketch_${sceneId}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Priority: localStorage (most recent strokes this session) →
    //           DB data (initialDrawing, restored from Supabase) → blank
    const fromStorage = localStorage.getItem(storageKey);
    const src = fromStorage ?? initialDrawing ?? null;

    if (src) {
      if (!fromStorage && initialDrawing) {
        localStorage.setItem(storageKey, initialDrawing);
      }
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = src;
    } else {
      ctx.fillStyle = "#fafaf9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, initialDrawing]);

  // Ctrl+Z keyboard handler (only when canvas has pointer focus)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        undoStroke();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSnapshot = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current = [...undoStackRef.current.slice(-30), snap]; // keep last 30
    setCanUndo(true);
  };

  const undoStroke = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || undoStackRef.current.length === 0) return;
    const snap = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setCanUndo(undoStackRef.current.length > 0);
    ctx.putImageData(snap, 0, 0);
    saveToDisk();
  };

  const saveToDisk = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    localStorage.setItem(storageKey, canvas.toDataURL());
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    saveSnapshot(); // snapshot BEFORE the stroke for undo
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    const pos = getPos(e);
    if (!pos || !lastPos.current) return;

    if (drawMode === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 16;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 1.5;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    // Reset composite op after erasing
    ctx.globalCompositeOperation = "source-over";
    lastPos.current = pos;
  };

  const endDraw = () => {
    isDrawing.current = false;
    lastPos.current = null;
    saveToDisk();
  };

  const clearCanvas = () => {
    saveSnapshot(); // allow undo of clear
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    localStorage.removeItem(storageKey);
  };

  return (
    <div className="space-y-1.5">
      {/* Tool bar */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setDrawMode("pen")}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
            drawMode === "pen"
              ? "bg-stone-800 text-white border border-stone-600"
              : "text-stone-400 hover:text-stone-600 border border-transparent"
          }`}
        >
          ✏ Pen
        </button>
        <button
          onClick={() => setDrawMode("eraser")}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
            drawMode === "eraser"
              ? "bg-amber-100 text-amber-700 border border-amber-300"
              : "text-stone-400 hover:text-stone-600 border border-transparent"
          }`}
        >
          ◻ Erase
        </button>
        <button
          onClick={undoStroke}
          disabled={!canUndo}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono
            text-stone-400 hover:text-stone-700 border border-transparent hover:border-stone-300
            disabled:opacity-30 transition-colors"
          title="Undo last stroke (Ctrl+Z)"
        >
          ↩ Undo
        </button>
        <button
          onClick={clearCanvas}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono
            text-stone-400 hover:text-red-500 border border-transparent hover:border-red-300 transition-colors"
          title="Clear all drawing"
        >
          ✕ Clear
        </button>
      </div>

      {/* Canvas — draggable=false prevents the parent scene card drag from hijacking drawing */}
      <canvas
        ref={canvasRef}
        width={320}
        height={180}
        draggable={false}
        className={`w-full border border-stone-300 rounded touch-none ${
          drawMode === "eraser" ? "cursor-cell" : "cursor-crosshair"
        }`}
        style={{ background: "#fafaf9" }}
        onMouseDown={(e) => { e.stopPropagation(); startDraw(e); }}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={(e) => { e.stopPropagation(); startDraw(e); }}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}

// ─── AI animated sketch panel ────────────────────────────────────────────────
function AiSketchPanel({
  scene,
  boardId,
  anthropicApiKey,
  onSvgChange,
}: {
  scene: Scene;
  boardId?: string;
  anthropicApiKey?: string | null;
  onSvgChange: (svg: string | null) => void;
}) {
  const storageKey = boardId
    ? `storyboard_aisvg_${boardId}_${scene.id}`
    : `storyboard_aisvg_${scene.id}`;

  const [svg, setSvg] = useState<string | null>(
    () => scene.aiSvg ?? localStorage.getItem(storageKey)
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayKey, setReplayKey] = useState(0);

  // Sync if scene.aiSvg was restored from Supabase history
  useEffect(() => {
    if (scene.aiSvg !== undefined && scene.aiSvg !== svg) {
      setSvg(scene.aiSvg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.aiSvg]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${HTTP_BACKEND_URL}/api/storyboard/sketch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene_id: scene.id,
          title: scene.title,
          environment: scene.environment,
          player_position: scene.playerPosition,
          player_action: scene.playerAction,
          elements: scene.elements,
          outcome: scene.outcome,
          description: scene.description,
          anthropic_api_key: anthropicApiKey ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Server error ${res.status}`);
      }
      const data = await res.json();
      const svgString: string = data.svg;
      localStorage.setItem(storageKey, svgString);
      setSvg(svgString);
      setReplayKey((k) => k + 1);
      onSvgChange(svgString);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const clear = () => {
    localStorage.removeItem(storageKey);
    setSvg(null);
    setError(null);
    onSvgChange(null);
  };

  const replay = () => setReplayKey((k) => k + 1);

  if (generating) {
    return (
      <div className="w-full border border-stone-300 rounded bg-stone-50 flex flex-col items-center
        justify-center gap-2" style={{ aspectRatio: "16/9" }}>
        <svg className="w-5 h-5 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-[9px] text-stone-400 font-mono">generating sketch…</span>
      </div>
    );
  }

  if (svg) {
    return (
      <div className="relative group/ai">
        <div
          key={replayKey}
          className="w-full border border-stone-300 rounded bg-stone-50 overflow-hidden"
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{ lineHeight: 0 }}
        />
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/ai:opacity-100 transition-opacity">
          <button onClick={replay}
            className="bg-white/90 border border-stone-300 rounded px-1.5 py-0.5 text-[9px]
              text-stone-500 hover:text-emerald-600 hover:border-emerald-400" title="Replay">↺</button>
          <button onClick={generate}
            className="bg-white/90 border border-stone-300 rounded px-1.5 py-0.5 text-[9px]
              text-stone-500 hover:text-emerald-600 hover:border-emerald-400" title="Regenerate">✦ redo</button>
          <button onClick={clear}
            className="bg-white/90 border border-stone-300 rounded px-1.5 py-0.5 text-[9px]
              text-stone-500 hover:text-red-500 hover:border-red-300" title="Clear">clear</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full border border-dashed border-stone-300 rounded bg-stone-50 flex flex-col
      items-center justify-center gap-2 p-3" style={{ aspectRatio: "16/9" }}>
      {error && (
        <p className="text-[9px] text-red-400 font-mono text-center max-w-[200px] leading-snug">{error}</p>
      )}
      <button onClick={generate}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500
          text-white text-[10px] font-medium transition-colors">
        <span className="text-[11px]">✦</span>
        Generate AI Sketch
      </button>
      <p className="text-[8px] text-stone-400 font-mono text-center">
        Claude draws an animated scene sketch
      </p>
    </div>
  );
}

// ─── Scene card ──────────────────────────────────────────────────────────────
export default function StoryboardScene({ scene, sceneIndex, onUpdate, anthropicApiKey, boardId }: Props) {
  const [editing, setEditing] = useState<keyof Scene | null>(null);
  const [draft, setDraft] = useState("");
  const [sketchTab, setSketchTab] = useState<"draw" | "ai">("draw");

  const startEdit = (field: keyof Scene) => {
    const val = scene[field];
    setDraft(Array.isArray(val) ? val.join(", ") : String(val));
    setEditing(field);
  };

  const commitEdit = () => {
    if (!editing) return;
    if (editing === "elements") {
      onUpdate({ ...scene, elements: draft.split(",").map((s) => s.trim()).filter(Boolean) });
    } else if (editing === "id") {
      // not editable
    } else {
      onUpdate({ ...scene, [editing]: draft });
    }
    setEditing(null);
  };

  const editableText = (field: keyof Scene, label: string, className = "") => {
    const val = scene[field];
    const display = Array.isArray(val) ? val.join(", ") : String(val);
    if (editing === field) {
      return (
        <textarea autoFocus
          className={`w-full bg-emerald-50 border border-emerald-400 rounded px-1.5 py-1 text-[10px]
            text-stone-800 resize-none outline-none ${className}`}
          value={draft} rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); } }}
        />
      );
    }
    return (
      <div className={`group/field cursor-text ${className}`} onClick={() => startEdit(field)}
        title={`Click to edit ${label}`}>
        <span className="text-[10px] text-stone-500 font-mono uppercase tracking-wide mr-1">{label}:</span>
        <span className="text-[10px] text-stone-700 group-hover/field:underline group-hover/field:decoration-dashed">
          {display || <em className="text-stone-400">—</em>}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-white border border-stone-300 rounded-lg overflow-hidden flex flex-col shadow-sm">
      <div className="bg-stone-100 border-b border-stone-200 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* Drag handle */}
          <span className="text-stone-400 cursor-grab active:cursor-grabbing select-none text-base leading-none" title="Drag to reorder">⠿</span>
          <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">Scene {sceneIndex}</span>
        </div>
        {editing === "title" ? (
          <input autoFocus
            className="flex-1 ml-2 bg-emerald-50 border border-emerald-400 rounded px-1.5 text-xs
              font-medium text-stone-800 outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); }}
          />
        ) : (
          <span className="flex-1 ml-2 text-xs font-medium text-stone-700 cursor-text hover:underline
            hover:decoration-dashed truncate"
            onClick={() => startEdit("title")} title="Click to edit title">
            {scene.title}
          </span>
        )}
      </div>

      <div className="p-2 bg-stone-50">
        <div className="flex gap-1 mb-2">
          <button onClick={() => setSketchTab("draw")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
              sketchTab === "draw"
                ? "bg-stone-200 text-stone-700 font-semibold"
                : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
            }`}>
            ✏ Draw
          </button>
          <button onClick={() => setSketchTab("ai")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono transition-colors ${
              sketchTab === "ai"
                ? "bg-emerald-100 text-emerald-700 font-semibold"
                : "text-stone-400 hover:text-stone-600 hover:bg-stone-100"
            }`}>
            ✦ AI Sketch
          </button>
        </div>

        {sketchTab === "draw" ? (
          <SketchCanvas
            sceneId={scene.id}
            boardId={boardId}
            initialDrawing={scene.drawSketch}
          />
        ) : (
          <AiSketchPanel
            scene={scene}
            boardId={boardId}
            anthropicApiKey={anthropicApiKey}
            onSvgChange={(svg) => onUpdate({ ...scene, aiSvg: svg ?? undefined })}
          />
        )}
      </div>

      <div className="px-3 py-2 space-y-1 flex-1">
        {editableText("description", "scene")}
        {editableText("playerAction", "action")}
        {editableText("environment", "env")}
        {editableText("outcome", "outcome")}
        {editableText("elements", "elements")}
      </div>
    </div>
  );
}
