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
  // VR/AR-specific fields
  viewType?: "gods_eye" | "player_pov" | "rear_pov" | "ar_overlay" | "triplet";
  fovZone?: "primary" | "secondary" | "tertiary";
  trigger?: string;
  audioSpatial?: string;
  haptics?: string;
  transition?: string;
  branchingPaths?: string[];
  // Triplet format — per-panel SVGs
  aiSvgGodsEye?: string;
  aiSvgFrontPov?: string;
  aiSvgRearPov?: string;
}

interface Props {
  scene: Scene;
  sceneIndex: number; // 1-based positional number shown in header
  onUpdate: (updated: Scene) => void;
  anthropicApiKey?: string | null;
  boardId?: string; // unique per storyboard — namespaces localStorage keys
  storyboardType?: string; // "standard" | "vr" | "ar" | "mixed" — controls VR/AR section visibility
}

// ─── View type badge ────────────────────────────────────────────────────────
const VIEW_TYPE_META: Record<
  NonNullable<Scene["viewType"]>,
  { label: string; color: string; title: string }
> = {
  gods_eye: {
    label: "⊙ God's Eye",
    color: "bg-violet-100 text-violet-700 border-violet-300",
    title: "Top-down 360° circle view showing the full arena, bifurcated front/rear",
  },
  player_pov: {
    label: "◈ Front POV",
    color: "bg-sky-100 text-sky-700 border-sky-300",
    title: "First-person curved panel — what the player sees looking forward",
  },
  rear_pov: {
    label: "◈ Rear POV",
    color: "bg-indigo-100 text-indigo-700 border-indigo-300",
    title: "First-person curved panel — what the player sees looking behind",
  },
  ar_overlay: {
    label: "◧ AR Overlay",
    color: "bg-amber-100 text-amber-700 border-amber-300",
    title: "AR scene — virtual elements over the real world",
  },
  triplet: {
    label: "⊞ Triplet",
    color: "bg-violet-100 text-violet-700 border-violet-300",
    title: "God's Eye + Front POV + Rear POV — full 360° storyboard panel",
  },
};

const FOV_ZONE_COLOR: Record<NonNullable<Scene["fovZone"]>, string> = {
  primary: "text-emerald-700 bg-emerald-50 border-emerald-200",
  secondary: "text-amber-700 bg-amber-50 border-amber-200",
  tertiary: "text-stone-600 bg-stone-100 border-stone-300",
};

// ─── Hand-draw canvas ───────────────────────────────────────────────────────
function SketchCanvas({
  sceneId,
  boardId,
  initialDrawing,
}: {
  sceneId: number;
  boardId?: string;
  initialDrawing?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [drawMode, setDrawMode] = useState<"pen" | "eraser">("pen");
  const [canUndo, setCanUndo] = useState(false);
  const undoStackRef = useRef<ImageData[]>([]);

  const storageKey = boardId
    ? `storyboard_sketch_${boardId}_${sceneId}`
    : `storyboard_sketch_${sceneId}`;

  // Fixed resolution — all scene canvases the same size
  const canvasWidth = 480;
  const canvasHeight = 256;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
    undoStackRef.current = [...undoStackRef.current.slice(-30), snap];
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
    saveSnapshot();
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
    ctx.globalCompositeOperation = "source-over";
    lastPos.current = pos;
  };

  const endDraw = () => {
    isDrawing.current = false;
    lastPos.current = null;
    saveToDisk();
  };

  const clearCanvas = () => {
    saveSnapshot();
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

      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        draggable={false}
        className={`w-full h-64 border border-stone-300 rounded touch-none ${
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

// ─── Single panel sketch (reusable inside triplet) ───────────────────────────
function SinglePanelSketch({
  label,
  viewType,
  svg,
  generating,
  error,
  onGenerate,
  onClear,
}: {
  label: string;
  viewType: string;
  svg: string | null;
  generating: boolean;
  error: string | null;
  onGenerate: () => void;
  onClear: () => void;
}) {
  const [replayKey, setReplayKey] = useState(0);
  const isSquare = viewType === "gods_eye";

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[8px] font-mono text-stone-500 uppercase tracking-wide text-center">{label}</span>

      {generating ? (
        <div
          className="border border-stone-300 rounded bg-stone-50 flex items-center justify-center"
          style={{ aspectRatio: isSquare ? "1/1" : "16/9" }}
        >
          <svg className="w-4 h-4 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      ) : svg ? (
        <div className="relative group/panel">
          <div
            key={replayKey}
            className="border border-stone-300 rounded bg-stone-50 overflow-hidden"
            dangerouslySetInnerHTML={{ __html: svg }}
            style={{ lineHeight: 0, aspectRatio: isSquare ? "1/1" : "16/9" }}
          />
          <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover/panel:opacity-100 transition-opacity">
            <button onClick={() => setReplayKey((k) => k + 1)}
              className="bg-white/90 border border-stone-300 rounded px-1 py-0.5 text-[8px] text-stone-500 hover:text-emerald-600">↺</button>
            <button onClick={onGenerate}
              className="bg-white/90 border border-stone-300 rounded px-1 py-0.5 text-[8px] text-stone-500 hover:text-emerald-600">✦</button>
            <button onClick={onClear}
              className="bg-white/90 border border-stone-300 rounded px-1 py-0.5 text-[8px] text-stone-500 hover:text-red-500">✕</button>
          </div>
        </div>
      ) : (
        <div
          className="border border-dashed border-stone-300 rounded bg-stone-50 flex flex-col items-center justify-center gap-1"
          style={{ aspectRatio: isSquare ? "1/1" : "16/9" }}
        >
          {error && <p className="text-[8px] text-red-400 font-mono text-center px-1 leading-tight">{error}</p>}
          <button onClick={onGenerate}
            className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-medium">
            <span>✦</span> Generate
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Triplet sketch panel (God's Eye + Front POV + Rear POV) ─────────────────
function TripletSketchPanel({
  scene,
  boardId,
  anthropicApiKey,
  onUpdate,
}: {
  scene: Scene;
  boardId?: string;
  anthropicApiKey?: string | null;
  onUpdate: (updated: Scene) => void;
}) {
  const keyPrefix = boardId ? `storyboard_triplet_${boardId}_${scene.id}` : `storyboard_triplet_${scene.id}`;

  const [svgGodsEye, setSvgGodsEye] = useState<string | null>(
    () => scene.aiSvgGodsEye ?? localStorage.getItem(`${keyPrefix}_ge`) ?? null
  );
  const [svgFront, setSvgFront] = useState<string | null>(
    () => scene.aiSvgFrontPov ?? localStorage.getItem(`${keyPrefix}_fp`) ?? null
  );
  const [svgRear, setSvgRear] = useState<string | null>(
    () => scene.aiSvgRearPov ?? localStorage.getItem(`${keyPrefix}_rp`) ?? null
  );

  const [genGe, setGenGe] = useState(false);
  const [genFp, setGenFp] = useState(false);
  const [genRp, setGenRp] = useState(false);
  const [errGe, setErrGe] = useState<string | null>(null);
  const [errFp, setErrFp] = useState<string | null>(null);
  const [errRp, setErrRp] = useState<string | null>(null);

  const generatePanel = async (
    viewType: "gods_eye" | "player_pov" | "rear_pov",
    setGen: (v: boolean) => void,
    setErr: (v: string | null) => void,
    setSvg: (v: string | null) => void,
    storageKey: string,
    updateField: keyof Scene,
  ) => {
    setGen(true);
    setErr(null);
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
          view_type: viewType,
          fov_zone: scene.fovZone ?? null,
          trigger: scene.trigger ?? null,
          audio_spatial: scene.audioSpatial ?? null,
          haptics: scene.haptics ?? null,
          transition: scene.transition ?? null,
          branching_paths: scene.branchingPaths ?? [],
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
      onUpdate({ ...scene, [updateField]: svgString });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGen(false);
    }
  };

  const genAll = async () => {
    await generatePanel("gods_eye", setGenGe, setErrGe, setSvgGodsEye, `${keyPrefix}_ge`, "aiSvgGodsEye");
    await generatePanel("player_pov", setGenFp, setErrFp, setSvgFront, `${keyPrefix}_fp`, "aiSvgFrontPov");
    await generatePanel("rear_pov", setGenRp, setErrRp, setSvgRear, `${keyPrefix}_rp`, "aiSvgRearPov");
  };

  const anyGenerating = genGe || genFp || genRp;
  const allDone = svgGodsEye && svgFront && svgRear;

  return (
    <div className="flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-mono text-stone-400 uppercase tracking-wide">
          Triplet panels: God's Eye · Front POV · Rear POV
        </span>
        {!allDone && (
          <button
            onClick={genAll}
            disabled={anyGenerating}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500
              text-white text-[9px] font-medium disabled:opacity-40 transition-colors"
          >
            <span>✦</span> {anyGenerating ? "generating…" : "Generate all 3"}
          </button>
        )}
      </div>

      {/* Three panels side by side */}
      <div className="grid grid-cols-3 gap-1.5">
        <SinglePanelSketch
          label="① God's Eye"
          viewType="gods_eye"
          svg={svgGodsEye}
          generating={genGe}
          error={errGe}
          onGenerate={() => generatePanel("gods_eye", setGenGe, setErrGe, setSvgGodsEye, `${keyPrefix}_ge`, "aiSvgGodsEye")}
          onClear={() => { localStorage.removeItem(`${keyPrefix}_ge`); setSvgGodsEye(null); onUpdate({ ...scene, aiSvgGodsEye: undefined }); }}
        />
        <SinglePanelSketch
          label="② Front POV"
          viewType="player_pov"
          svg={svgFront}
          generating={genFp}
          error={errFp}
          onGenerate={() => generatePanel("player_pov", setGenFp, setErrFp, setSvgFront, `${keyPrefix}_fp`, "aiSvgFrontPov")}
          onClear={() => { localStorage.removeItem(`${keyPrefix}_fp`); setSvgFront(null); onUpdate({ ...scene, aiSvgFrontPov: undefined }); }}
        />
        <SinglePanelSketch
          label="③ Rear POV"
          viewType="rear_pov"
          svg={svgRear}
          generating={genRp}
          error={errRp}
          onGenerate={() => generatePanel("rear_pov", setGenRp, setErrRp, setSvgRear, `${keyPrefix}_rp`, "aiSvgRearPov")}
          onClear={() => { localStorage.removeItem(`${keyPrefix}_rp`); setSvgRear(null); onUpdate({ ...scene, aiSvgRearPov: undefined }); }}
        />
      </div>

      {allDone && (
        <p className="text-[8px] font-mono text-stone-400 text-center">
          Hover any panel to replay · ✦ to regenerate · ✕ to clear
        </p>
      )}
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

  useEffect(() => {
    if (scene.aiSvg !== undefined && scene.aiSvg !== svg) {
      setSvg(scene.aiSvg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.aiSvg]);

  const viewType = scene.viewType ?? "standard";

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
          // VR/AR fields
          view_type: viewType,
          fov_zone: scene.fovZone ?? null,
          trigger: scene.trigger ?? null,
          audio_spatial: scene.audioSpatial ?? null,
          haptics: scene.haptics ?? null,
          transition: scene.transition ?? null,
          branching_paths: scene.branchingPaths ?? [],
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
      <div className="w-full h-64 border border-stone-300 rounded bg-stone-50 flex flex-col items-center justify-center gap-2">
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
          className="w-full h-64 border border-stone-300 rounded bg-stone-50 overflow-hidden"
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

  // View-type hint for empty state
  const viewHint =
    viewType === "gods_eye"
      ? "Top-down 360° circle map"
      : viewType === "player_pov"
      ? "Curved first-person VR panel"
      : viewType === "ar_overlay"
      ? "AR overlay with real-world sketch"
      : "Claude draws an animated scene sketch";

  return (
    <div className="w-full h-64 border border-dashed border-stone-300 rounded bg-stone-50 flex flex-col items-center justify-center gap-2 p-3">
      {error && (
        <p className="text-[9px] text-red-400 font-mono text-center max-w-[200px] leading-snug">{error}</p>
      )}
      <button onClick={generate}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500
          text-white text-[10px] font-medium transition-colors">
        <span className="text-[11px]">✦</span>
        Generate AI Sketch
      </button>
      <p className="text-[8px] text-stone-400 font-mono text-center">{viewHint}</p>
    </div>
  );
}

// ─── Scene card ──────────────────────────────────────────────────────────────
export default function StoryboardScene({ scene, sceneIndex, onUpdate, anthropicApiKey, boardId, storyboardType }: Props) {
  const [editing, setEditing] = useState<keyof Scene | null>(null);
  const [draft, setDraft] = useState("");
  const [sketchTab, setSketchTab] = useState<"draw" | "ai">("draw");

  const startEdit = (field: keyof Scene) => {
    const val = scene[field];
    setDraft(Array.isArray(val) ? val.join(", ") : String(val ?? ""));
    setEditing(field);
  };

  const commitEdit = () => {
    if (!editing) return;
    if (editing === "elements") {
      onUpdate({ ...scene, elements: draft.split(",").map((s) => s.trim()).filter(Boolean) });
    } else if (editing === "branchingPaths") {
      onUpdate({ ...scene, branchingPaths: draft.split(",").map((s) => s.trim()).filter(Boolean) });
    } else if (editing === "id") {
      // not editable
    } else {
      onUpdate({ ...scene, [editing]: draft });
    }
    setEditing(null);
  };

  const editableText = (field: keyof Scene, label: string, className = "") => {
    const val = scene[field];
    const display = Array.isArray(val) ? val.join(", ") : String(val ?? "");
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

  // Inline-editable VR/AR field row (always shown for VR/AR storyboards, even when empty)
  const editableVrField = (field: keyof Scene, label: string, icon: string, placeholder: string) => {
    const val = scene[field];
    const display = Array.isArray(val) ? val.join(", ") : String(val ?? "");
    if (editing === field) {
      return (
        <div className="flex gap-1.5 items-start">
          <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wide shrink-0 w-20 pt-1">
            {icon} {label}
          </span>
          <input autoFocus
            className="flex-1 bg-emerald-50 border border-emerald-400 rounded px-1.5 py-0.5
              text-[10px] text-stone-800 outline-none"
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
          />
        </div>
      );
    }
    return (
      <div className="flex gap-1.5 items-start group/vr cursor-text" onClick={() => startEdit(field)}
        title={`Click to edit ${label}`}>
        <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wide shrink-0 w-20">
          {icon} {label}
        </span>
        <span className="text-[9px] text-stone-600 group-hover/vr:underline group-hover/vr:decoration-dashed leading-snug min-w-0 break-words">
          {display || <em className="text-stone-400 not-italic">{placeholder}</em>}
        </span>
      </div>
    );
  };

  const viewMeta = scene.viewType ? VIEW_TYPE_META[scene.viewType] : null;
  // Show VR/AR section whenever the scene has a viewType OR the whole storyboard is VR/AR
  const isVrAr = Boolean(scene.viewType) || ["vr", "ar", "mixed"].includes(storyboardType ?? "");

  return (
    <div className="bg-white border border-stone-300 rounded-lg overflow-hidden flex flex-col shadow-sm">
      {/* Header */}
      <div className="bg-stone-100 border-b border-stone-200 px-3 py-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-stone-400 cursor-grab active:cursor-grabbing select-none text-base leading-none" title="Drag to reorder">⠿</span>
          <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest shrink-0">Scene {sceneIndex}</span>
          {viewMeta && (
            <span
              className={`text-[8px] font-mono px-1.5 py-0.5 rounded border ${viewMeta.color} shrink-0`}
              title={viewMeta.title}
            >
              {viewMeta.label}
            </span>
          )}
        </div>
        {editing === "title" ? (
          <input autoFocus
            className="flex-1 ml-1 bg-emerald-50 border border-emerald-400 rounded px-1.5 text-xs
              font-medium text-stone-800 outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); }}
          />
        ) : (
          <span className="flex-1 ml-1 text-xs font-medium text-stone-700 cursor-text hover:underline
            hover:decoration-dashed truncate"
            onClick={() => startEdit("title")} title="Click to edit title">
            {scene.title}
          </span>
        )}
      </div>

      {/* Sketch area */}
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
          {isVrAr && (
            <span className="ml-auto text-[8px] font-mono text-stone-400 self-center">
              {scene.viewType === "triplet"
                ? "3 panels"
                : scene.viewType === "gods_eye"
                ? "360° circle"
                : scene.viewType === "player_pov"
                ? "front POV"
                : scene.viewType === "rear_pov"
                ? "rear POV"
                : "AR frame"}
            </span>
          )}
        </div>

        {scene.viewType === "triplet" && sketchTab === "ai" ? (
          <TripletSketchPanel
            scene={scene}
            boardId={boardId}
            anthropicApiKey={anthropicApiKey}
            onUpdate={onUpdate}
          />
        ) : sketchTab === "draw" ? (
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

      {/* Metadata */}
      <div className="px-3 py-2 space-y-1 flex-1">
        {editableText("description", "scene")}
        {editableText("playerAction", "action")}
        {editableText("environment", "env")}
        {editableText("outcome", "outcome")}
        {editableText("elements", "elements")}

        {/* VR/AR-specific metadata — always shown for VR/AR storyboards, all fields editable */}
        {isVrAr && (
          <div className="mt-2 pt-2 border-t border-stone-200 space-y-1">
            {/* FOV Zone — pill selector */}
            <div className="flex gap-1.5 items-center">
              <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wide shrink-0 w-20">
                ◎ FOV zone
              </span>
              <div className="flex gap-1">
                {(["primary", "secondary", "tertiary"] as NonNullable<Scene["fovZone"]>[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => onUpdate({ ...scene, fovZone: z })}
                    className={`text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                      scene.fovZone === z
                        ? FOV_ZONE_COLOR[z]
                        : "text-stone-400 border-stone-200 hover:border-stone-400"
                    }`}
                  >
                    {z.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {editableVrField("trigger",     "trigger",    "⊕", "e.g. gaze, grab, proximity…")}
            {editableVrField("audioSpatial","audio",      "◉", "e.g. footsteps from rear-left…")}
            {editableVrField("haptics",     "haptics",    "⌫", "e.g. light pulse on grab…")}
            {editableVrField("transition",  "transition", "→", "e.g. fade, teleport, portal…")}

            {/* Branching paths — editable comma-separated */}
            {editing === "branchingPaths" ? (
              <div className="flex gap-1.5 items-start">
                <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wide shrink-0 w-20 pt-1">
                  ⑂ branches
                </span>
                <input autoFocus
                  className="flex-1 bg-emerald-50 border border-emerald-400 rounded px-1.5 py-0.5
                    text-[10px] text-stone-800 outline-none"
                  value={draft}
                  placeholder="Path A, Path B (comma-separated)"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(null); }}
                />
              </div>
            ) : (
              <div className="flex gap-1.5 items-start group/br cursor-text"
                onClick={() => startEdit("branchingPaths")}
                title="Click to edit branching paths">
                <span className="text-[9px] font-mono text-stone-400 uppercase tracking-wide shrink-0 w-20">
                  ⑂ branches
                </span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  {scene.branchingPaths && scene.branchingPaths.length > 0 ? (
                    scene.branchingPaths.map((path, i) => (
                      <div key={i} className="flex gap-1 items-start">
                        <span className="text-[8px] text-stone-400 shrink-0 font-mono">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <span className="text-[9px] text-stone-600 leading-snug group-hover/br:underline group-hover/br:decoration-dashed">
                          {path}
                        </span>
                      </div>
                    ))
                  ) : (
                    <em className="text-[9px] text-stone-400 not-italic group-hover/br:underline group-hover/br:decoration-dashed">
                      Add branching paths…
                    </em>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
