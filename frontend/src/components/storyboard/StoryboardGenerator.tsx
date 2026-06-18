import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { HTTP_BACKEND_URL } from "../../config";
import { Settings } from "../../types";
import { supabase } from "../../lib/supabase";
import StoryboardView, { Storyboard } from "./StoryboardView";
import VrArInputWizard, { VrArInputState } from "./VrArInputWizard";

interface Props {
  settings: Settings;
  userId?: string | null;
  initialStoryboard?: Storyboard | null;
  onClearInitial?: () => void;
  onGenerated?: () => void;
  onStoryboardActive?: (title: string) => void;
}

type AppMode = "standard" | "vr" | "ar";

type ModelProvider = "anthropic" | "openai";

interface ValidationResult {
  valid: boolean;
  score: number;
  scene_count_ok: boolean;
  issues: string[];
  warnings: string[];
  passed_checks: string[];
  improved_prompt?: string | null;
  improvements?: string[];
  validator_provider?: string;
  validator_model?: string;
}

const EXAMPLES: Record<AppMode, string[]> = {
  standard: [
    "A 2D platformer where the player escapes a crumbling dungeon, avoiding spike traps and enemies while collecting keys to unlock the exit.",
    "A top-down shooter where the player defends a base from waves of alien ships, picking up power-ups between waves.",
    "A puzzle game where the player pushes blocks onto pressure plates to open doors, with increasing complexity each level.",
  ],
  vr: [
    "Generate a 6-panel VR storyboard for a horror escape room game. The player wakes up in a dark lab, hears footsteps (rear-left audio cue), finds a key (grab trigger), unlocks a door (proximity trigger), enters a boss room (portal transition), and defeats the monster (gaze + haptic feedback).",
    "A VR underwater exploration game set in a coral reef. The player follows a scuba guide through two activity zones — discovering marine life (gaze trigger), avoiding sharks (proximity alert), and surfacing to safety (walk transition). Include FOV zone annotations and spatial audio cues.",
    "A VR sci-fi shooter where the player emerges from a cryo-pod in an alien cave, is ambushed by enemies from the rear tertiary zone (rear audio cue), uses a gravity gun (grab trigger) to defeat them, and escapes through a portal (teleport transition). Include branching paths.",
  ],
  ar: [
    "An AR museum puzzle game where players scan real exhibits to unlock virtual clues, collect holographic artifacts anchored to display cases, and solve a mystery by combining AR and real-world objects.",
    "An AR city treasure hunt where virtual waypoints are anchored to real buildings, players follow holographic arrows through streets, and discover hidden AR characters triggered by proximity to landmarks.",
    "An AR tabletop strategy game where virtual armies are placed on a real table surface, players issue commands via gaze and gesture, and the battlefield evolves with real-time AR animations and spatial audio.",
  ],
};

function cleanForStorage(storyboard: Storyboard): Omit<Storyboard, "_dbId"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _dbId, ...clean } = storyboard;
  return clean;
}

async function insertStoryboard(
  prompt: string,
  storyboard: Storyboard,
  userId: string | null | undefined,
): Promise<number | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("generations")
    .insert({
      prompt,
      code: JSON.stringify(cleanForStorage(storyboard)),
      aesthetic_mode: "gaming_storyboard",
      title: storyboard.title ?? prompt.slice(0, 80),
      user_id: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as number;
}

async function updateStoryboard(
  storyboard: Storyboard,
  generationId: number,
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) return;
  const { error } = await supabase
    .from("generations")
    .update({
      code: JSON.stringify(cleanForStorage(storyboard)),
      title: storyboard.title ?? "Storyboard",
    })
    .eq("id", generationId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ─── Validation badge ─────────────────────────────────────────────────────────
function ValidationBadge({
  result,
  onDismiss,
  onRegenerate,
}: {
  result: ValidationResult;
  onDismiss: () => void;
  onRegenerate: (withPrompt?: string) => void;
}) {
  const [expanded, setExpanded] = useState(!result.valid);
  const [showImprovedPrompt, setShowImprovedPrompt] = useState(false);
  const pct = Math.round(result.score * 100);
  const hasIssues = result.issues.length > 0;
  const hasImprovedPrompt = !!result.improved_prompt;
  const validatorLabel = result.validator_model
    ? result.validator_model.startsWith("gpt") ? "GPT-4o mini" : "Claude Haiku"
    : "AI";
  const isOpenAI = result.validator_model?.startsWith("gpt");

  return (
    <div className={`rounded-xl border overflow-hidden flex flex-col text-xs ${
      result.valid
        ? "border-emerald-800/50"
        : "border-amber-800/50"
    }`}>
      {/* ── Validator Agent header strip ── */}
      <div className={`flex items-center gap-2.5 px-3.5 py-2 ${
        result.valid
          ? "bg-emerald-950/60 border-b border-emerald-800/40"
          : "bg-amber-950/60 border-b border-amber-800/40"
      }`}>
        {/* Robot icon */}
        <svg className={`w-3.5 h-3.5 shrink-0 ${result.valid ? "text-emerald-400" : "text-amber-400"}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <circle cx="12" cy="5" r="2"/>
          <line x1="12" y1="7" x2="12" y2="11"/>
          <line x1="8" y1="15" x2="8" y2="15" strokeWidth="3"/>
          <line x1="16" y1="15" x2="16" y2="15" strokeWidth="3"/>
          <line x1="9" y1="18" x2="15" y2="18"/>
        </svg>
        <span className="text-xs font-semibold text-stone-200 tracking-wide">Validator Agent</span>
        {/* Model pill */}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
          isOpenAI
            ? "bg-emerald-900/50 border-emerald-700/60 text-emerald-300"
            : "bg-violet-900/50 border-violet-700/60 text-violet-300"
        }`}>
          {validatorLabel}
        </span>
        <span className="text-[10px] text-stone-600 ml-0.5">cross-checking your storyboard</span>
        <button onClick={onDismiss} className="ml-auto text-stone-600 hover:text-stone-300 text-base leading-none">×</button>
      </div>

      {/* ── Score / status row ── */}
      <div className={`flex items-center gap-2 px-3.5 py-2.5 ${
        result.valid ? "bg-emerald-950/20" : "bg-amber-950/20"
      }`}>
        <span className={`text-base ${result.valid ? "text-emerald-400" : "text-amber-400"}`}>
          {result.valid ? "✓" : "⚠"}
        </span>
        <div className="flex-1 min-w-0">
          <span className={`font-semibold ${result.valid ? "text-emerald-400" : "text-amber-400"}`}>
            {result.valid ? "Validation passed" : "Issues found"}
          </span>
          <span className="text-stone-400 ml-1.5">
            {pct}% match · {result.passed_checks.length} checks passed
          </span>
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[10px] text-stone-500 hover:text-stone-300"
        >
          {expanded ? "hide ▲" : "details ▼"}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 px-3.5 py-3 bg-stone-950/40 border-t border-stone-800/50">
          {/* Issues */}
          {hasIssues && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-mono text-amber-500 uppercase tracking-wide">Issues found</span>
              {result.issues.map((issue, i) => (
                <div key={i} className="flex gap-1.5 items-start">
                  <span className="text-amber-500 shrink-0 mt-0.5">·</span>
                  <span className="text-[10px] font-mono text-amber-300 leading-snug">{issue}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wide">Warnings</span>
              {result.warnings.map((w, i) => (
                <div key={i} className="flex gap-1.5 items-start">
                  <span className="text-stone-500 shrink-0 mt-0.5">·</span>
                  <span className="text-[10px] font-mono text-stone-400 leading-snug">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Passed */}
          {result.passed_checks.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-mono text-emerald-600 uppercase tracking-wide">Passed</span>
              {result.passed_checks.map((p, i) => (
                <div key={i} className="flex gap-1.5 items-start">
                  <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                  <span className="text-[10px] font-mono text-emerald-400 leading-snug">{p}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── AI-improved prompt section — only shown when validator is NOT satisfied ── */}
          {hasImprovedPrompt && hasIssues && (
            <div className="flex flex-col gap-2 border-t border-stone-800 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-sky-400 uppercase tracking-wide">
                  ✦ AI-improved prompt
                </span>
                <span className="text-[9px] font-mono text-stone-600">
                  ({validatorLabel ?? "validator"} rewrote your prompt to fix the issues above)
                </span>
                <button
                  onClick={() => setShowImprovedPrompt((s) => !s)}
                  className="ml-auto text-[9px] font-mono text-stone-500 hover:text-stone-300"
                >
                  {showImprovedPrompt ? "hide ▲" : "preview ▼"}
                </button>
              </div>

              {/* What changed */}
              {(result.improvements ?? []).length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-sky-600 uppercase tracking-wide">Changes made</span>
                  {result.improvements!.map((imp, i) => (
                    <div key={i} className="flex gap-1.5 items-start">
                      <span className="text-sky-500 shrink-0 mt-0.5">+</span>
                      <span className="text-[10px] font-mono text-sky-300 leading-snug">{imp}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview of the improved prompt */}
              {showImprovedPrompt && (
                <div className="bg-stone-950 border border-stone-700 rounded p-2.5">
                  <p className="text-[10px] font-mono text-stone-300 leading-relaxed whitespace-pre-wrap">
                    {result.improved_prompt}
                  </p>
                </div>
              )}

              {/* Apply button — only available because validator was NOT satisfied */}
              <div className="flex gap-2">
                <button
                  onClick={() => onRegenerate(result.improved_prompt!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono
                    font-medium text-white bg-sky-600 hover:bg-sky-500 transition-colors"
                >
                  ↺ Regenerate with improved prompt
                </button>
                <button
                  onClick={() => onRegenerate()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono
                    text-stone-400 border border-stone-700 hover:border-stone-500 transition-colors"
                >
                  ↺ Retry with original
                </button>
              </div>
            </div>
          )}

          {/* Fallback regenerate (no improved prompt) */}
          {!hasImprovedPrompt && hasIssues && (
            <button
              onClick={() => onRegenerate()}
              className="self-start text-[10px] font-mono text-amber-400 border border-amber-700
                hover:border-amber-500 rounded px-2.5 py-1 transition-colors"
            >
              ↺ Regenerate to fix issues
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main generator ───────────────────────────────────────────────────────────
export default function StoryboardGenerator({
  settings,
  userId,
  initialStoryboard,
  onClearInitial,
  onGenerated,
  onStoryboardActive,
}: Props) {
  const [scenario, setScenario] = useState("");
  const [mode, setMode] = useState<AppMode>("standard");
  const [modelProvider, setModelProvider] = useState<ModelProvider>("anthropic");
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  // Stored so regenerate can replay the same structured requirements
  const [lastWizardInput, setLastWizardInput] = useState<VrArInputState | null>(null);
  const [lastCompiledPrompt, setLastCompiledPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (initialStoryboard) {
      const withBoardId: Storyboard = initialStoryboard.boardId
        ? initialStoryboard
        : { ...initialStoryboard, boardId: nanoid(8) };
      setGenerationId(withBoardId._dbId ?? null);
      setStoryboard(withBoardId);
      setLoadKey((k) => k + 1);
      onStoryboardActive?.(withBoardId.title ?? "Storyboard");
      // Intentionally do NOT run validation or restore a previous validation result
      // when loading from history. Validation belongs to the moment of generation —
      // showing a stale badge on a restored storyboard would mislead the user.
      setValidation(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStoryboard]);

  const runValidation = async (
    generated: Storyboard,
    compiledPrompt: string,
    wizardInput: VrArInputState | null,
    genProvider: ModelProvider,
  ) => {
    setValidating(true);
    try {
      const requirements: Record<string, unknown> = {
        anthropic_api_key: settings.anthropicApiKey ?? undefined,
      };
      if (wizardInput) {
        requirements.sceneCount = wizardInput.sceneCount;
        requirements.viewTypePattern = wizardInput.viewTypePattern;
        requirements.triggerTypes = wizardInput.triggerTypes;
        requirements.sensoryFeatures = wizardInput.sensoryFeatures;
        requirements.fovCoverage = wizardInput.fovCoverage;
      }

      const res = await fetch(`${HTTP_BACKEND_URL}/api/storyboard/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyboard: generated,
          original_prompt: compiledPrompt,
          requirements,
          model_provider: genProvider,
          // Always use OpenAI as the cross-validator (falls back to Haiku if unavailable)
          validator_provider: "openai",
        }),
      });
      if (!res.ok) return; // silent fail — validation is non-blocking
      const result: ValidationResult = await res.json();
      setValidation(result);
    } catch {
      // silent — validation never blocks showing the storyboard
    } finally {
      setValidating(false);
    }
  };

  const generate = async (
    promptOverride?: string,
    wizardInputOverride?: VrArInputState,
    storyboardTypeOverride?: AppMode,
    providerOverride?: ModelProvider,
  ) => {
    const prompt = promptOverride ?? (lastCompiledPrompt || scenario.trim());
    const wizardInput = wizardInputOverride ?? lastWizardInput;
    const sbType = storyboardTypeOverride ?? mode;
    const provider = providerOverride ?? modelProvider;

    if (!prompt) return;
    setLoading(true);
    setError(null);
    setValidation(null);

    try {
      const body: Record<string, unknown> = {
        scenario: prompt,
        storyboard_type: sbType,
        model_provider: provider,
      };
      // Only send the anthropic key when using Anthropic (OpenAI key stays server-side)
      if (provider === "anthropic") {
        body.anthropic_api_key = settings.anthropicApiKey ?? undefined;
      }

      const res = await fetch(`${HTTP_BACKEND_URL}/api/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Server error ${res.status}`);
      }
      const raw: Storyboard = await res.json();
      const data: Storyboard = { ...raw, boardId: nanoid(8) };

      const newId = await insertStoryboard(prompt, data, userId);
      setGenerationId(newId);

      onGenerated?.();
      onStoryboardActive?.(data.title ?? "Storyboard");

      setStoryboard(data);
      setLoadKey((k) => k + 1);

      // Run validation for VR/AR storyboards (OpenAI cross-validates Claude; Haiku cross-validates GPT-4o)
      if (sbType !== "standard") {
        await runValidation(data, prompt, wizardInput, provider);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Called when the VR/AR wizard submits
  const handleWizardSubmit = (input: VrArInputState, compiledPrompt: string) => {
    setLastWizardInput(input);
    setLastCompiledPrompt(compiledPrompt);
    setShowWizard(false);
    generate(compiledPrompt, input, input.platform);
  };

  const handleSave = async (current: Storyboard) => {
    const rowId = generationId ?? current._dbId ?? null;
    if (rowId) {
      await updateStoryboard(current, rowId, userId);
      if (!generationId) setGenerationId(rowId);
    } else {
      const newId = await insertStoryboard(current.title, current, userId);
      setGenerationId(newId);
    }
    onGenerated?.();
  };

  const handleReset = () => {
    setStoryboard(null);
    setGenerationId(null);
    setValidation(null);
    onClearInitial?.();
  };

  const handleRegenerate = (withPrompt?: string) => {
    const prompt = withPrompt ?? lastCompiledPrompt ?? scenario.trim();
    if (withPrompt) setLastCompiledPrompt(withPrompt); // store as new baseline
    generate(prompt, lastWizardInput ?? undefined, mode);
  };

  // ── Show storyboard view ─────────────────────────────────────────────────────
  if (storyboard) {
    return (
      <div className="p-4 flex flex-col gap-3">
        {/* Validation banner */}
        {validating && (
          <div className="flex items-center gap-2.5 rounded-xl bg-stone-900 border border-stone-700 px-3.5 py-2.5">
            <svg className="w-4 h-4 animate-spin text-sky-400 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-stone-200">Validator Agent is running…</span>
              <span className="text-[11px] text-stone-500">Cross-checking your storyboard against requirements</span>
            </div>
          </div>
        )}
        {validation && !validating && (
          <ValidationBadge
            result={validation}
            onDismiss={() => setValidation(null)}
            onRegenerate={handleRegenerate}
          />
        )}

        <StoryboardView
          key={loadKey}
          storyboard={storyboard}
          onReset={handleReset}
          // Only provide regenerate when we have a prompt to replay.
          // History-restored storyboards have no lastCompiledPrompt, so the
          // button is intentionally absent — there is nothing to regenerate from.
          onRegenerate={lastCompiledPrompt || scenario.trim() ? handleRegenerate : undefined}
          anthropicApiKey={settings.anthropicApiKey}
          onSave={handleSave}
        />
      </div>
    );
  }

  // ── Show VR/AR wizard ────────────────────────────────────────────────────────
  if (showWizard && (mode === "vr" || mode === "ar")) {
    return (
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-stone-100">
            {mode === "vr" ? "VR" : "AR"} Storyboard Setup
          </h2>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${
            mode === "vr"
              ? "bg-violet-900/40 border-violet-500 text-violet-300"
              : "bg-amber-900/40 border-amber-500 text-amber-300"
          }`}>
            Structured input wizard
          </span>
        </div>
        <VrArInputWizard
          mode={mode}
          onSubmit={handleWizardSubmit}
          onCancel={() => setShowWizard(false)}
        />
      </div>
    );
  }

  // ── Mode selector + input form ────────────────────────────────────────────────
  return (
    <div className="p-5 flex flex-col gap-5 max-w-xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-stone-100 mb-1.5">Game Storyboard Generator</h2>
        <p className="text-sm text-stone-400 leading-relaxed">
          Describe your game scenario and the AI will generate a sequential storyboard of gameplay scenes.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-stone-300">Storyboard Type</label>
        <div className="flex gap-2">
          {(["standard", "vr", "ar"] as AppMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setShowWizard(false); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                mode === m
                  ? m === "vr"
                    ? "bg-violet-600 text-white border-violet-600"
                    : m === "ar"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-emerald-600 text-white border-emerald-600"
                  : "bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-500 hover:text-stone-100"
              }`}
            >
              {m === "standard" ? "Standard" : m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Generation engine selector */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-stone-300">Generation Engine</label>
        <div className="flex gap-2">
          {([
            { value: "anthropic" as ModelProvider, label: "Claude Sonnet", sub: "Anthropic", color: "violet" },
            { value: "openai" as ModelProvider, label: "GPT-4o", sub: "OpenAI", color: "emerald" },
          ]).map(({ value, label, sub, color }) => (
            <button
              key={value}
              onClick={() => setModelProvider(value)}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold border transition-colors flex flex-col items-center gap-0.5 ${
                modelProvider === value
                  ? color === "violet"
                    ? "bg-violet-700 text-white border-violet-500"
                    : "bg-emerald-700 text-white border-emerald-500"
                  : "bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-500 hover:text-stone-100"
              }`}
            >
              <span>{label}</span>
              <span className={`text-xs font-normal ${modelProvider === value ? "opacity-75" : "text-stone-500"}`}>{sub}</span>
            </button>
          ))}
        </div>
        {/* Cross-validation notice */}
        <div className={`rounded-lg px-3 py-2 text-xs border ${
          modelProvider === "anthropic"
            ? "bg-violet-950/30 border-violet-800/40 text-violet-300"
            : "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
        }`}>
          {modelProvider === "anthropic"
            ? "✦ GPT-4o mini will cross-validate Claude's output and suggest prompt improvements when issues are found."
            : "✦ Claude Haiku will cross-validate GPT-4o's output and suggest prompt improvements when issues are found."}
        </div>
      </div>

      {/* VR/AR: wizard option vs. manual prompt */}
      {mode !== "standard" && (
        <div className={`rounded-lg border p-4 flex flex-col gap-3 ${
          mode === "vr" ? "border-violet-700/50 bg-violet-950/20" : "border-amber-700/50 bg-amber-950/20"
        }`}>
          <p className="text-sm text-stone-300 leading-relaxed">
            {mode === "vr"
              ? "VR storyboards need 360° spatial layout, FOV zones, trigger types, spatial audio, haptics, and branching paths. The structured wizard ensures the AI has all required details."
              : "AR storyboards need real-world integration details, spatial anchors, occlusion info, and overlay types. The structured wizard guides you through each requirement."}
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className={`self-start flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
              mode === "vr" ? "bg-violet-600 hover:bg-violet-500" : "bg-amber-600 hover:bg-amber-500"
            }`}
          >
            ◈ Open structured wizard →
          </button>
          <p className="text-xs text-stone-500">
            Or fill in the prompt below manually (less precise).
          </p>
        </div>
      )}

      {/* Scenario textarea */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-stone-300">
          {mode === "vr" ? "VR Scenario" : mode === "ar" ? "AR Scenario" : "Game Scenario"}
        </label>
        <textarea
          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-4 py-3
            text-base text-stone-100 resize-none outline-none
            focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/30
            placeholder:text-stone-600 transition-colors leading-relaxed"
          rows={5}
          placeholder={
            mode === "vr"
              ? "Describe your VR game — or use the structured wizard above for best results…"
              : mode === "ar"
              ? "Describe your AR game — or use the structured wizard above for best results…"
              : "Describe your game idea, mechanics, and the story you want to storyboard…"
          }
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(scenario.trim(), undefined, mode);
          }}
        />
        <p className="text-xs text-stone-500">Press Cmd / Ctrl + Enter to generate</p>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800/50 rounded-lg px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        disabled={loading || !scenario.trim()}
        onClick={() => generate(scenario.trim(), undefined, mode)}
        className={`w-full py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed
          text-white text-base font-semibold transition-colors ${
          mode === "vr"
            ? "bg-violet-600 hover:bg-violet-500"
            : mode === "ar"
            ? "bg-amber-600 hover:bg-amber-500"
            : "bg-emerald-600 hover:bg-emerald-500"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating storyboard…
          </span>
        ) : (
          `Generate ${mode === "standard" ? "" : mode.toUpperCase() + " "}Storyboard via ${modelProvider === "anthropic" ? "Claude" : "GPT-4o"}`
        )}
      </button>

      {/* Examples */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-stone-400">Examples</span>
        {EXAMPLES[mode].map((ex, i) => (
          <button
            key={i}
            onClick={() => setScenario(ex)}
            className="text-left text-xs text-stone-400 hover:text-stone-200
              bg-stone-900/50 hover:bg-stone-800 border border-stone-800 hover:border-stone-600
              rounded-lg px-3 py-2.5 transition-colors leading-relaxed"
          >
            {ex}
          </button>
        ))}
      </div>

      {mode !== "standard" && (
        <p className="text-xs text-stone-500 leading-relaxed">
          Tip: Use the structured wizard above for best results — it ensures the AI receives all FOV zones, trigger types, sensory features, and branching paths.
        </p>
      )}
    </div>
  );
}
