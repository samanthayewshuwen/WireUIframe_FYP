import { useState } from "react";
import toast from "react-hot-toast";
import { AppState, AestheticMode, GenerationScope, Settings } from "../../types";
import { useAppStore } from "../../store/app-store";
import { CodeGenerationModel, CODE_GENERATION_MODEL_DESCRIPTIONS } from "../../lib/models";
import { Stack, STACK_DESCRIPTIONS } from "../../lib/stacks";

interface Props {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  doCreateFromText: (text: string) => void;
  doCreate: (images: string[], inputMode: "image" | "video") => void;
}

// Prompt templates
const TEMPLATES = [
  { id: "1", name: "SaaS Dashboard",   category: "Admin",    prompt: "A SaaS admin dashboard with sidebar navigation, KPI metric cards, a line chart for revenue, and a user management table." },
  { id: "2", name: "Landing Page",     category: "Marketing",prompt: "A product landing page with a bold hero section, 3-column features grid with icons, a 3-tier pricing table, and sticky navigation." },
  { id: "3", name: "E-Commerce",       category: "Shop",     prompt: "An e-commerce listing with filter sidebar (category, price, rating) and a 3-column product card grid with add-to-cart." },
  { id: "4", name: "Auth Flow",        category: "Auth",     prompt: "A clean login screen with email, password, remember me, forgot password, Sign In button, and Google OAuth alternative." },
  { id: "5", name: "Mobile App UI",    category: "Mobile",   prompt: "A mobile app UI with status bar, bottom tab navigation (Home, Search, Notifications, Profile), and a scrollable card feed." },
  { id: "6", name: "Blog Article",     category: "Content",  prompt: "A blog post page with hero image, title, author avatar, date, rich body text, blockquotes, tags, and related articles." },
  { id: "7", name: "Kanban Board",     category: "Product",  prompt: "A Kanban board with four columns: Backlog, In Progress, Review, Done — each with task cards showing title, label, avatar." },
  { id: "8", name: "Settings Page",    category: "App",      prompt: "An app settings page with left tab menu: Profile, Account, Billing, Notifications, Security, and a form on the right." },
];

// Full-project prompt templates
const FULL_PROJECT_TEMPLATES = [
  { id: "fp1", name: "Flight Booking", category: "Travel",  prompt: "A flight ticket booking system with search, results, seat selection, passenger details, payment, confirmation, and my bookings." },
  { id: "fp2", name: "E-Commerce App", category: "Shop",    prompt: "A complete e-commerce platform with home, product listing, product detail, cart, checkout, order confirmation, order history, and user profile." },
  { id: "fp3", name: "Project Mgmt",   category: "SaaS",    prompt: "A project management tool with dashboard, projects list, kanban board, task detail, team members, settings, and notifications." },
  { id: "fp4", name: "Hospital App",   category: "Health",  prompt: "A hospital management system with patient registration, appointment booking, doctor list, medical records, billing, and admin dashboard." },
  { id: "fp5", name: "Banking App",    category: "Finance", prompt: "A mobile banking app with login, dashboard, accounts overview, transfer money, transaction history, pay bills, and profile settings." },
  { id: "fp6", name: "LMS Platform",   category: "Edu",     prompt: "A learning management system with student dashboard, course catalog, course detail, video lessons, quizzes, progress tracking, and certificates." },
];

const STACK_LABELS: Record<Stack, string> = {
  [Stack.HTML_TAILWIND]:  "HTML + Tailwind",
  [Stack.HTML_CSS]:       "HTML + CSS",
  [Stack.REACT_TAILWIND]: "React + Tailwind",
  [Stack.BOOTSTRAP]:      "Bootstrap",
  [Stack.VUE_TAILWIND]:   "Vue + Tailwind",
  [Stack.IONIC_TAILWIND]: "Ionic",
  [Stack.SVG]:            "SVG",
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const MODEL_LABELS: Partial<Record<CodeGenerationModel, { brand: string; subtitle: string }>> = {
  [CodeGenerationModel.CLAUDE_4_5_SONNET_2025_09_29]: { brand: "Anthropic", subtitle: "Premium layout" },
  [CodeGenerationModel.GPT_4O_2024_05_13]:            { brand: "OpenAI",    subtitle: "Ultra-fast UI"   },
  [CodeGenerationModel.GPT_4_TURBO_2024_04_09]:       { brand: "OpenAI",    subtitle: "Complex layout"  },
};

export function GenerationSettings({ settings, setSettings, doCreateFromText, doCreate }: Props) {
  const { appState } = useAppStore();
  const [promptText, setPromptText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [imageBase64, setImageBase64] = useState("");
  const [imageInputMode, setImageInputMode] = useState<"image" | "video">("image");

  const isGenerating = appState === AppState.CODING || appState === AppState.CODE_READY;
  const isFullProject = settings.generationScope === "full_project";
  const isStoryboard = settings.aestheticMode === AestheticMode.GAMING_STORYBOARD && !isFullProject;

  function handleGenerate() {
    if (promptText.trim()) {
      doCreateFromText(promptText.trim());
    } else if (imageBase64) {
      doCreate([imageBase64], imageInputMode);
    }
  }

  function readUploadFile(file: File) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast.error("Please upload an image or video file.");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Upload must be under 5MB.");
      return;
    }

    setImageInputMode(isVideo ? "video" : "image");
    const reader = new FileReader();
    reader.onloadend = () => setImageBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readUploadFile(file);
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readUploadFile(file);
  }

  const canGenerate = !isGenerating && (promptText.trim().length > 0 || imageBase64.length > 0);

  const activeTemplates = isFullProject ? FULL_PROJECT_TEMPLATES : TEMPLATES;

  return (
    <div className="flex flex-col gap-y-5">

      {/* ── 1. Describe your layout ────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-400 block font-mono uppercase tracking-wide">
          1. Describe Layout
        </label>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          disabled={isGenerating}
          placeholder={
            isFullProject
              ? "A flight booking system, an e-commerce platform, a hospital management app..."
              : "A SaaS admin dashboard with charts, sidebar navigation, and user management table..."
          }
          rows={4}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
          className="w-full px-3 py-2 bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-600 text-xs rounded-lg focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed transition-colors disabled:opacity-40"
        />
        {/* Templates */}
        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto border border-stone-800/80 bg-stone-950/70 p-1.5 rounded-lg">
          {activeTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => setPromptText(t.prompt)}
              disabled={isGenerating}
              className="w-full text-left p-1.5 rounded hover:bg-stone-900/60 group transition-all disabled:opacity-40"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-stone-300 font-medium font-sans group-hover:text-amber-500 transition-colors">
                  {t.name}
                </span>
                <span className="text-[8px] bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                  {t.category}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. Screenshot / Sketch upload ─────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-stone-400 font-mono uppercase tracking-wide">
            2. Screenshot / Sketch (Optional)
          </label>
          {imageBase64 && (
            <button
              onClick={() => setImageBase64("")}
              className="text-[10px] text-red-400 hover:underline font-mono flex items-center gap-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>

        <div
          onDragEnter={handleDrag} onDragOver={handleDrag}
          onDragLeave={handleDrag} onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-3 text-center transition-all relative overflow-hidden ${
            dragActive ? "border-amber-500 bg-amber-500/5"
            : imageBase64 ? "border-stone-700 bg-stone-900/20"
            : "border-stone-800 bg-stone-950 hover:bg-stone-900/10"
          }`}
        >
          {imageBase64 ? (
            <div className="relative group flex items-center justify-center h-28">
              {imageInputMode === "video"
                ? <video src={imageBase64} className="max-h-full max-w-full opacity-70 object-contain rounded" muted />
                : <img src={imageBase64} alt="Preview" className="max-h-full max-w-full opacity-70 object-contain rounded" />
              }
              <div className="absolute inset-0 bg-stone-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                <label htmlFor="img-replace" className="text-xs text-white bg-stone-800 border border-stone-700 px-3 py-1.5 rounded cursor-pointer hover:bg-stone-700">
                  Replace
                </label>
                <input id="img-replace" type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
              </div>
            </div>
          ) : (
            <label htmlFor="img-upload" className="flex flex-col items-center justify-center py-4 cursor-pointer text-stone-400 hover:text-stone-200">
              <svg className="w-8 h-8 text-stone-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-semibold font-sans">Drop screenshot or sketch here</span>
              <span className="text-[10px] text-stone-500 font-mono mt-1">Or click to browse — image or video</span>
              <input id="img-upload" type="file" accept="image/*,video/*" onChange={handleFileChange} className="hidden" />
            </label>
          )}
        </div>
      </div>

      {/* ── 3. Generation Scope ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-400 block font-mono uppercase tracking-wide">
          3. Generation Scope
        </label>
        <div className="grid grid-cols-2 gap-2">
          {/* Single Page */}
          <button
            disabled={isGenerating}
            onClick={() => setSettings((p) => ({
              ...p,
              generationScope: "single_page" as GenerationScope,
              // If switching away from storyboard, reset to High-Fi
              aestheticMode: p.aestheticMode === AestheticMode.GAMING_STORYBOARD
                ? AestheticMode.HIGH_FI
                : p.aestheticMode,
            }))}
            className={`p-3 rounded-lg border text-left transition-all disabled:opacity-40 ${
              !isFullProject && !isStoryboard
                ? "bg-stone-900 border-amber-500/80 shadow-sm text-white"
                : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/40"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className={`w-3.5 h-3.5 ${!isFullProject && !isStoryboard ? "text-amber-400" : "text-stone-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-medium font-sans">Single Page</span>
            </div>
            <p className="text-[10px] text-stone-500 leading-tight font-mono">
              One focused page — wireframe or high-fi
            </p>
          </button>

          {/* Full Project */}
          <button
            disabled={isGenerating}
            onClick={() => {
              setSettings((p) => ({
                ...p,
                generationScope: "full_project" as GenerationScope,
                aestheticMode: p.aestheticMode === AestheticMode.GAMING_STORYBOARD
                  ? AestheticMode.HIGH_FI
                  : p.aestheticMode,
              }));
            }}
            className={`p-3 rounded-lg border text-left transition-all disabled:opacity-40 ${
              isFullProject
                ? "bg-stone-900 border-violet-500/80 shadow-sm text-white"
                : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/40"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg className={`w-3.5 h-3.5 ${isFullProject ? "text-violet-400" : "text-stone-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6M9 16h4" />
              </svg>
              <span className="text-xs font-medium font-sans">Full Project</span>
              <span className="ml-auto text-[8px] font-mono bg-violet-900/40 text-violet-400 border border-violet-700/40 px-1 py-0.5 rounded">NEW</span>
            </div>
            <p className="text-[10px] text-stone-500 leading-tight font-mono">
              All pages auto-generated — login, dashboard, payment...
            </p>
          </button>
        </div>

        {/* Gaming Storyboard — full-width, 3rd scope option */}
        <button
          disabled={isGenerating || isFullProject}
          onClick={() => setSettings((p) => ({
            ...p,
            generationScope: "single_page" as GenerationScope,
            aestheticMode: AestheticMode.GAMING_STORYBOARD,
          }))}
          className={`w-full p-3 rounded-lg border text-left transition-all disabled:opacity-40 ${
            isStoryboard
              ? "bg-stone-900 border-emerald-500/80 shadow-sm text-white"
              : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/40"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className={`w-3.5 h-3.5 shrink-0 ${isStoryboard ? "text-emerald-400" : "text-stone-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4H4a1 1 0 00-1 1v14a1 1 0 001 1h16a1 1 0 001-1V5a1 1 0 00-1-1h-3M9 4h6M9 4V2m6 2V2M9 9h6M9 13h4" />
            </svg>
            <span className="text-xs font-medium font-sans">Gaming Storyboard</span>
            <span className="ml-auto text-[9px] font-mono bg-emerald-900/40 text-emerald-400 border border-emerald-700/40 px-1.5 py-0.5 rounded">NEW</span>
          </div>
          <p className="text-[10px] text-stone-500 leading-tight font-mono mt-1">
            Type a game concept → Claude generates editable scene-by-scene gameplay panels
          </p>
        </button>
      </div>

      {/* ── 4. Choose Aesthetics — hidden when storyboard scope is active ─── */}
      {!isStoryboard && (
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-400 block font-mono uppercase tracking-wide">
          4. Choose Aesthetics
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: AestheticMode.WIREFRAME, label: "Wireframe (Low-Fi)", desc: "Dashed layout grids, blueprint shapes, slate tones",  activeColor: "border-zinc-400" },
            { value: AestheticMode.HIGH_FI,   label: "Product (High-Fi)",  desc: "Polished gradients, modern shadows, high-contrast",   activeColor: "border-amber-500/80" },
          ] as const).map((mode) => (
            <button
              key={mode.value}
              disabled={isGenerating}
              onClick={() => setSettings((p) => ({ ...p, aestheticMode: mode.value }))}
              className={`p-3 rounded-lg border text-left transition-all disabled:opacity-40 ${
                settings.aestheticMode === mode.value
                  ? `bg-stone-900 ${mode.activeColor} shadow-sm text-white`
                  : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/40"
              }`}
            >
              <div className={`w-4 h-4 mb-2 ${settings.aestheticMode === mode.value ? "text-amber-500" : "text-stone-500"}`}>
                {mode.value === AestheticMode.WIREFRAME
                  ? <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                  : <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                }
              </div>
              <div className="text-xs font-medium font-sans">{mode.label}</div>
              <p className="text-[10px] text-stone-500 mt-1 leading-tight font-mono">{mode.desc}</p>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ── 5. Model engine ──────────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-400 block font-mono uppercase tracking-wide">
          5. Model Engine
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(CodeGenerationModel)
            .filter((m) => MODEL_LABELS[m])
            .map((modelId) => {
              const meta  = MODEL_LABELS[modelId]!;
              const desc  = CODE_GENERATION_MODEL_DESCRIPTIONS[modelId];
              const isActive = settings.codeGenerationModel === modelId;
              return (
                <button
                  key={modelId}
                  disabled={isGenerating}
                  onClick={() => setSettings((p) => ({ ...p, codeGenerationModel: modelId }))}
                  className={`py-2 px-2.5 rounded border text-left transition-all flex flex-col justify-between disabled:opacity-40 ${
                    isActive
                      ? "bg-stone-900 border-amber-500 text-white shadow"
                      : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/35"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] font-medium font-sans truncate pr-1">{desc.name}</span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                  </div>
                  <div className="flex items-center justify-between w-full mt-1.5">
                    <span className="text-[9px] text-stone-500 font-mono uppercase">{meta.brand}</span>
                    <span className={`text-[9px] font-mono ${desc.inBeta ? "text-amber-600" : "text-stone-600"}`}>
                      {desc.inBeta ? "Beta" : meta.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* ── 6. Framework / Stack ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-400 block font-mono uppercase tracking-wide">
          6. Output Framework
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(Stack).map((stack) => {
            const isActive = settings.generatedCodeConfig === stack;
            const isBeta   = STACK_DESCRIPTIONS[stack].inBeta;
            return (
              <button
                key={stack}
                disabled={isGenerating}
                onClick={() => setSettings((p) => ({ ...p, generatedCodeConfig: stack }))}
                className={`py-2 px-2.5 rounded border text-left transition-all flex items-center justify-between gap-1 disabled:opacity-40 ${
                  isActive
                    ? "bg-stone-900 border-amber-500 text-white shadow"
                    : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/35"
                }`}
              >
                <span className="text-[11px] font-medium font-sans truncate">{STACK_LABELS[stack]}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {isBeta && <span className="text-[8px] font-mono text-amber-600 border border-amber-700/40 px-1 rounded">Beta</span>}
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Generate button ───────────────────────────────────────────────── */}
      {!isGenerating && settings.aestheticMode === AestheticMode.GAMING_STORYBOARD && !isFullProject ? (
        <div className="w-full py-3 px-4 rounded-lg border border-emerald-700/40 bg-emerald-950/30 text-center">
          <p className="text-xs text-emerald-400 font-mono">
            ↗ Type your game scenario in the main panel
          </p>
          <p className="text-[10px] text-stone-500 font-mono mt-1">
            The storyboard generator is open on the right →
          </p>
        </div>
      ) : !isGenerating && (
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2.5 text-xs font-bold tracking-wide transition-all ${
            canGenerate
              ? isFullProject
                ? "bg-violet-600 hover:bg-violet-500 text-white hover:shadow-lg active:scale-[0.98] cursor-pointer"
                : "bg-amber-500 hover:bg-amber-400 text-stone-950 hover:shadow-lg active:scale-[0.98] cursor-pointer"
              : "bg-stone-900 border border-stone-800 text-stone-600 cursor-not-allowed"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <span>
            {isFullProject
              ? "GENERATE FULL PROJECT"
              : settings.aestheticMode === AestheticMode.WIREFRAME
              ? "GENERATE WIREFRAME"
              : "GENERATE PRODUCT UI"}
          </span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>
      )}
    </div>
  );
}
