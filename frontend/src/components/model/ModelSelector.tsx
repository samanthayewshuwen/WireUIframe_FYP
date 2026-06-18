import { AppState, Settings } from "../../types";
import { CodeGenerationModel, CODE_GENERATION_MODEL_DESCRIPTIONS } from "../../lib/models";
import { useAppStore } from "../../store/app-store";

interface Props {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

// Model display config — maps enum keys to richer display data
const MODEL_DISPLAY: Record<string, { label: string; subtitle: string; brand: string }> = {
  "claude-sonnet-4-5-20250929": { label: "Claude Sonnet 4.5", subtitle: "Premium layout", brand: "Anthropic" },
  "gpt-4o-2024-05-13":         { label: "GPT-4o",            subtitle: "Ultra-fast UI",   brand: "OpenAI" },
  "gpt-4-turbo-2024-04-09":    { label: "GPT-4 Turbo",       subtitle: "Complex layout",  brand: "OpenAI" },
  "gpt_4_vision":              { label: "GPT-4 Vision",      subtitle: "Deprecated",      brand: "OpenAI" },
  "claude_3_sonnet":           { label: "Claude 3 Sonnet",   subtitle: "Deprecated",      brand: "Anthropic" },
};

export default function ModelSelector({ settings, setSettings }: Props) {
  const { appState } = useAppStore();
  const disabled = appState === AppState.CODING || appState === AppState.CODE_READY;

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-stone-400 block font-mono uppercase tracking-wide">
        2. Choose Model Engine
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {Object.values(CodeGenerationModel).map((modelId) => {
          const display = MODEL_DISPLAY[modelId];
          const desc = CODE_GENERATION_MODEL_DESCRIPTIONS[modelId];
          const isActive = settings.codeGenerationModel === modelId;
          if (!display) return null;

          return (
            <button
              key={modelId}
              disabled={disabled}
              onClick={() => setSettings((p) => ({ ...p, codeGenerationModel: modelId }))}
              className={`py-2 px-2.5 rounded border text-left transition-all flex flex-col justify-between ${
                isActive
                  ? "bg-stone-900 border-amber-500 text-white shadow"
                  : "bg-stone-950 border-stone-800 text-stone-400 hover:bg-stone-900/35"
              } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-medium font-sans truncate pr-1">{display.label}</span>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
              </div>
              <div className="flex items-center justify-between w-full mt-1.5">
                <span className="text-[9px] text-stone-500 font-mono uppercase">{display.brand}</span>
                <span className={`text-[9px] font-mono ${desc.inBeta ? "text-amber-600" : "text-stone-600"}`}>
                  {desc.inBeta ? "Beta" : display.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}