import { AestheticMode, AppState, GenerationScope, Settings } from "../../types";
import { useAppStore } from "../../store/app-store";

const GamepadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M7 4H4a1 1 0 00-1 1v14a1 1 0 001 1h16a1 1 0 001-1V5a1 1 0 00-1-1h-3M9 4h6M9 4V2m6 2V2M9 9h6M9 13h4" />
  </svg>
);

const LayersIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

interface Props {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

export default function AestheticModeSelector({ settings, setSettings }: Props) {
  const { appState } = useAppStore();
  const disabled = appState === AppState.CODING || appState === AppState.CODE_READY;
  const isFullProject = settings.generationScope === "full_project";

  return (
    <div className="space-y-3">

      {/* ── Generation Scope ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-400 block font-mono uppercase tracking-wide">
          Generation Scope
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={disabled}
            onClick={() => setSettings((p) => ({ ...p, generationScope: "single_page" as GenerationScope }))}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              !isFullProject
                ? "bg-stone-900 border-amber-500/80 shadow-sm text-white"
                : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/40"
            } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <svg className={`w-3 h-3 ${!isFullProject ? "text-amber-400" : "text-stone-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[10px] font-medium font-sans">Single Page</span>
            </div>
            <p className="text-[9px] text-stone-500 leading-tight font-mono">One focused page</p>
          </button>

          <button
            disabled={disabled}
            onClick={() => {
              setSettings((p) => ({
                ...p,
                generationScope: "full_project" as GenerationScope,
                aestheticMode: p.aestheticMode === AestheticMode.GAMING_STORYBOARD
                  ? AestheticMode.HIGH_FI
                  : p.aestheticMode,
              }));
            }}
            className={`p-2.5 rounded-lg border text-left transition-all ${
              isFullProject
                ? "bg-stone-900 border-violet-500/80 shadow-sm text-white"
                : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/40"
            } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <svg className={`w-3 h-3 ${isFullProject ? "text-violet-400" : "text-stone-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6M9 16h4" />
              </svg>
              <span className="text-[10px] font-medium font-sans">Full Project</span>
              {isFullProject && (
                <span className="ml-auto text-[7px] font-mono bg-violet-900/40 text-violet-400 border border-violet-700/40 px-1 py-0.5 rounded">ON</span>
              )}
            </div>
            <p className="text-[9px] text-stone-500 leading-tight font-mono">All pages auto-generated</p>
          </button>
        </div>
      </div>

      {/* ── Choose Aesthetics ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-400 block font-mono uppercase tracking-wide">
          Choose Aesthetics
        </label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            disabled={disabled}
            onClick={() => setSettings((p) => ({ ...p, aestheticMode: AestheticMode.WIREFRAME }))}
            className={`p-3 rounded-lg border text-left transition-all ${
              settings.aestheticMode === AestheticMode.WIREFRAME
                ? "bg-stone-900 border-zinc-400 shadow-sm text-white"
                : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/40"
            } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="text-zinc-400 mb-2"><LayersIcon /></div>
            <div className="text-xs font-medium font-sans">Wireframe (Low-Fi)</div>
            <p className="text-[10px] text-stone-500 mt-1 leading-tight font-mono">
              Dashed layout grids, blueprint shapes, slate tones
            </p>
          </button>

          <button
            disabled={disabled}
            onClick={() => setSettings((p) => ({ ...p, aestheticMode: AestheticMode.HIGH_FI }))}
            className={`p-3 rounded-lg border text-left transition-all ${
              settings.aestheticMode === AestheticMode.HIGH_FI
                ? "bg-stone-900 border-amber-500/80 shadow-sm text-white"
                : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/40"
            } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="text-amber-500 mb-2"><SparklesIcon /></div>
            <div className="text-xs font-medium font-sans">Product (High-Fi)</div>
            <p className="text-[10px] text-stone-500 mt-1 leading-tight font-mono">
              Polished gradients, modern shadows, high-contrast mockups
            </p>
          </button>
        </div>

        {/* Gaming Storyboard — only shown for Single Page scope */}
        {!isFullProject && (
          <button
            disabled={disabled}
            onClick={() => setSettings((p) => ({ ...p, aestheticMode: AestheticMode.GAMING_STORYBOARD }))}
            className={`w-full p-3 rounded-lg border text-left transition-all ${
              settings.aestheticMode === AestheticMode.GAMING_STORYBOARD
                ? "bg-stone-900 border-emerald-500/80 shadow-sm text-white"
                : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/40"
            } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="text-emerald-500"><GamepadIcon /></div>
              <div className="text-xs font-medium font-sans">Gaming Storyboard</div>
            </div>
            <p className="text-[10px] text-stone-500 leading-tight font-mono">
              Scene-by-scene gameplay storyboard — type a game concept, get editable storyboard panels
            </p>
          </button>
        )}

        {/* Info pill for Full Project scope */}
        {isFullProject && (
          <div className="px-2.5 py-2 rounded-lg bg-violet-950/30 border border-violet-800/40">
            <p className="text-[9px] text-violet-300 font-mono leading-relaxed">
              Full Project applies your aesthetic (Wireframe or High-Fi) across all generated pages.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
