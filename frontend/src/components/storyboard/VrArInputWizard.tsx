/**
 * VrArInputWizard — structured 4-step input form for VR/AR storyboards.
 * Replaces free-text textarea with specific fields so Claude receives an
 * unambiguous, deterministic prompt with no guesswork.
 */

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoryboardMode = "vr" | "ar";

export interface VrArInputState {
  // Step 1
  gameTitle: string;
  genre: string;
  storySummary: string;
  platform: StoryboardMode;
  // Step 2
  sceneCount: number;
  sceneNames: string[];     // one entry per scene
  sceneIntents: string[];   // optional one-liner intent per scene
  // Step 3 — VR/AR features
  viewTypePattern: "triplet" | "godsEye_pov" | "pov_only" | "ar_overlay";
  triggerTypes: string[];   // multi-select
  sensoryFeatures: string[]; // multi-select
  transitionType: string;
  fovCoverage: "primary" | "primary_secondary" | "full_360";
  // Step 4
  sketchStyle: "sketch" | "digital" | "card";
}

interface Props {
  mode: StoryboardMode;
  onSubmit: (input: VrArInputState, compiledPrompt: string) => void;
  onCancel: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS = [
  { value: "gaze", label: "👁 Gaze", desc: "Player looks at an object" },
  { value: "proximity", label: "⊙ Proximity", desc: "Player gets close" },
  { value: "grab", label: "✊ Grab / Controller", desc: "Player grabs or presses" },
  { value: "timer", label: "⏱ Timer", desc: "Time-based auto-trigger" },
  { value: "auto", label: "▶ Auto / Scene start", desc: "Triggers automatically" },
];

const SENSORY_OPTIONS = [
  { value: "spatial_audio", label: "🔊 Spatial Audio", desc: "Directional sound cues" },
  { value: "haptics", label: "📳 Haptics", desc: "Controller vibration feedback" },
  { value: "branching", label: "⑂ Branching Paths", desc: "Player choices / alternate outcomes" },
  { value: "ui_hud", label: "◫ HUD / UI Elements", desc: "Floating menus, health bars, prompts" },
];

const TRANSITION_OPTIONS = [
  { value: "fade", label: "Fade to black" },
  { value: "portal", label: "Portal / teleport" },
  { value: "walk", label: "Natural walk" },
  { value: "cut", label: "Hard cut" },
  { value: "mixed", label: "Mix per scene" },
];

const FOV_OPTIONS = [
  { value: "primary", label: "Primary only", desc: "90° front focus zone" },
  { value: "primary_secondary", label: "Primary + Secondary", desc: "~180° — front + sides" },
  { value: "full_360", label: "Full 360°", desc: "All zones including rear-tertiary" },
];

const VIEW_PATTERN_OPTIONS = [
  {
    value: "triplet",
    label: "Triplet (recommended for VR)",
    desc: "Each scene: God's Eye circle + Front POV panel + Rear POV panel",
  },
  {
    value: "godsEye_pov",
    label: "God's Eye + POV alternating",
    desc: "Alternates between top-down circle views and first-person panels",
  },
  {
    value: "pov_only",
    label: "POV panels only",
    desc: "All scenes as first-person curved panels",
  },
  {
    value: "ar_overlay",
    label: "AR Overlay panels",
    desc: "All scenes as AR frames with real-world background",
  },
];

const GENRE_SUGGESTIONS = [
  "Horror Escape Room", "Sci-Fi Shooter", "Fantasy RPG", "Underwater Exploration",
  "Puzzle / Mystery", "Sports / Training", "Survival", "AR Museum",
];

const STYLE_OPTIONS = [
  { value: "sketch", label: "✏ Sketch", desc: "Hand-drawn pencil style" },
  { value: "digital", label: "◻ Digital", desc: "Clean digital outlines" },
  { value: "card", label: "⊞ Card", desc: "Modular icon cards" },
];

// ─── Step components ──────────────────────────────────────────────────────────

function StepHeader({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i < step ? "w-6 bg-violet-500" : i === step - 1 ? "w-6 bg-violet-500" : "w-3 bg-stone-700"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] font-mono text-stone-500">Step {step}/4</span>
      <span className="text-[10px] font-mono text-stone-300 ml-1">{title}</span>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-mono text-stone-400 uppercase tracking-wide">{label}</label>
      {hint && <p className="text-[9px] font-mono text-stone-500 -mt-1">{hint}</p>}
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  if (rows && rows > 1) {
    return (
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2
          text-sm text-stone-200 resize-none outline-none
          focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/30
          placeholder:text-stone-600 transition-colors"
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2
        text-sm text-stone-200 outline-none
        focus:border-violet-500/70 focus:ring-1 focus:ring-violet-500/30
        placeholder:text-stone-600 transition-colors"
    />
  );
}

function MultiCheckbox({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string; desc: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`flex flex-col gap-0.5 text-left px-2.5 py-2 rounded-lg border transition-colors ${
            selected.includes(opt.value)
              ? "bg-violet-900/40 border-violet-500 text-violet-200"
              : "bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500"
          }`}
        >
          <span className="text-[10px] font-mono font-medium">{opt.label}</span>
          <span className="text-[9px] font-mono text-stone-500 leading-tight">{opt.desc}</span>
        </button>
      ))}
    </div>
  );
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; desc?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex items-start gap-2.5 text-left px-3 py-2 rounded-lg border transition-colors ${
            value === opt.value
              ? "bg-violet-900/40 border-violet-500 text-violet-200"
              : "bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500"
          }`}
        >
          <span
            className={`mt-0.5 w-3 h-3 rounded-full border-2 shrink-0 ${
              value === opt.value ? "border-violet-400 bg-violet-400" : "border-stone-600"
            }`}
          />
          <div>
            <span className="text-[10px] font-mono font-medium block">{opt.label}</span>
            {opt.desc && (
              <span className="text-[9px] font-mono text-stone-500 leading-tight">{opt.desc}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Prompt compiler ──────────────────────────────────────────────────────────

export function compileVrArPrompt(input: VrArInputState): string {
  const {
    gameTitle, genre, storySummary, platform, sceneCount, sceneNames, sceneIntents,
    viewTypePattern, triggerTypes, sensoryFeatures, transitionType, fovCoverage, sketchStyle,
  } = input;

  const platformLabel = platform === "vr" ? "VR (Virtual Reality)" : "AR (Augmented Reality)";

  const viewDesc =
    viewTypePattern === "triplet"
      ? "Use the TRIPLET format for every scene: generate a god's_eye top-down circle view (bifurcated by a dotted line showing front-half and rear-half, with a dot at center for camera position), PLUS a front_pov curved panel (what player sees looking forward), PLUS a rear_pov curved panel (what player sees looking behind). These three views work together as one scene."
      : viewTypePattern === "godsEye_pov"
      ? "Alternate between gods_eye top-down circle views and player_pov first-person curved panels across scenes."
      : viewTypePattern === "pov_only"
      ? "Use player_pov curved first-person panels for all scenes."
      : "Use ar_overlay panels for all scenes, showing virtual elements anchored over real-world sketches.";

  const fovDesc =
    fovCoverage === "primary"
      ? "FOV focus: Primary zone only (the immediate 90° front area the player is looking at)."
      : fovCoverage === "primary_secondary"
      ? "FOV coverage: Primary (front 90°) and Secondary (just outside direct vision, ~180° total). Annotate elements in both zones."
      : "FOV coverage: Full 360° — mark elements in Primary (front 90°), Secondary (peripheral), and Tertiary (behind player) zones for every scene.";

  const triggerDesc =
    triggerTypes.length > 0
      ? `Trigger types to use: ${triggerTypes.join(", ")}. Every scene must specify exactly which trigger type activates the event.`
      : "Include a trigger for every scene (any type appropriate to the situation).";

  const sensoryDesc: string[] = [];
  if (sensoryFeatures.includes("spatial_audio"))
    sensoryDesc.push("Spatial audio: note the direction and type of audio cue for every scene (e.g., footsteps from rear-left, ambient hum from front-center).");
  if (sensoryFeatures.includes("haptics"))
    sensoryDesc.push("Haptics: describe controller vibration feedback for every scene (light pulse / strong rumble / none).");
  if (sensoryFeatures.includes("branching"))
    sensoryDesc.push("Branching paths: every scene must include at least 2 branching outcome options based on player choices.");
  if (sensoryFeatures.includes("ui_hud"))
    sensoryDesc.push("HUD/UI elements: include floating UI elements, interaction prompts, or holographic menus in relevant scenes.");

  const transitionDesc =
    transitionType === "mixed"
      ? "Use a different transition technique per scene — vary between fade-to-black, portal, teleport, and natural walk."
      : `All scene transitions use: ${transitionType}.`;

  const sceneListDesc =
    sceneNames.filter(Boolean).length > 0
      ? `Scenes (in order):\n${sceneNames
          .map((name, i) => {
            const intent = sceneIntents[i] ? ` — ${sceneIntents[i]}` : "";
            return `  ${i + 1}. "${name}"${intent}`;
          })
          .join("\n")}`
      : `Generate ${sceneCount} scenes with distinct, meaningful titles.`;

  const styleDesc =
    sketchStyle === "sketch"
      ? "Style: hand-drawn sketch style (pencil-like strokes, rough and organic)."
      : sketchStyle === "digital"
      ? "Style: clean digital (precise outlines, clear shapes)."
      : "Style: modular card system (icon-based, labelled cards per element).";

  const lines = [
    `Generate a ${sceneCount}-panel ${platformLabel} storyboard for a ${genre || "game"} game.`,
    gameTitle ? `Game title: "${gameTitle}".` : "",
    storySummary ? `Story: ${storySummary}` : "",
    "",
    sceneListDesc,
    "",
    viewDesc,
    fovDesc,
    triggerDesc,
    ...sensoryDesc,
    transitionDesc,
    styleDesc,
    "",
    "Output requirements: Every scene MUST include viewType, fovZone, trigger, audioSpatial, haptics, transition, and branchingPaths fields in the JSON. Do not omit any field.",
  ];

  return lines.filter((l) => l !== undefined).join("\n");
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function VrArInputWizard({ mode, onSubmit, onCancel }: Props) {
  const [step, setStep] = useState(1);

  const [state, setState] = useState<VrArInputState>({
    gameTitle: "",
    genre: "",
    storySummary: "",
    platform: mode,
    sceneCount: 6,
    sceneNames: Array(6).fill(""),
    sceneIntents: Array(6).fill(""),
    viewTypePattern: mode === "ar" ? "ar_overlay" : "triplet",
    triggerTypes: ["gaze", "proximity"],
    sensoryFeatures: ["spatial_audio", "branching"],
    transitionType: "mixed",
    fovCoverage: "full_360",
    sketchStyle: "digital",
  });

  const update = <K extends keyof VrArInputState>(key: K, val: VrArInputState[K]) =>
    setState((s) => ({ ...s, [key]: val }));

  const setSceneCount = (n: number) => {
    const count = Math.max(2, Math.min(8, n));
    setState((s) => ({
      ...s,
      sceneCount: count,
      sceneNames: Array(count).fill("").map((_, i) => s.sceneNames[i] ?? ""),
      sceneIntents: Array(count).fill("").map((_, i) => s.sceneIntents[i] ?? ""),
    }));
  };

  const handleSubmit = () => {
    const prompt = compileVrArPrompt(state);
    onSubmit(state, prompt);
  };

  const canProceed = (s: number) => {
    if (s === 1) return state.genre.trim().length > 0 || state.storySummary.trim().length > 0;
    return true;
  };

  const accentBtn = mode === "vr"
    ? "bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900"
    : "bg-amber-600 hover:bg-amber-500 disabled:bg-amber-900";

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto">
      {/* ── Step 1: Core setup ── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <StepHeader step={1} total={4} title="Core Setup" />

          <Field label="Game Title" hint="Optional — used as the storyboard heading">
            <TextInput
              value={state.gameTitle}
              onChange={(v) => update("gameTitle", v)}
              placeholder="e.g. Project Abyss"
            />
          </Field>

          <Field label="Game Genre *" hint="Type freely or pick a suggestion below">
            <TextInput
              value={state.genre}
              onChange={(v) => update("genre", v)}
              placeholder="e.g. Horror Escape Room, Sci-Fi Shooter…"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {GENRE_SUGGESTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => update("genre", g)}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    state.genre === g
                      ? "bg-violet-800 border-violet-500 text-violet-200"
                      : "bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Story Summary" hint="1–2 sentences — what happens in this game/experience?">
            <TextInput
              value={state.storySummary}
              onChange={(v) => update("storySummary", v)}
              placeholder="The player wakes up in an abandoned lab and must escape before the facility collapses…"
              rows={3}
            />
          </Field>
        </div>
      )}

      {/* ── Step 2: Scene structure ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <StepHeader step={2} total={4} title="Scene Structure" />

          <Field label="Number of Scenes">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSceneCount(state.sceneCount - 1)}
                disabled={state.sceneCount <= 2}
                className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700 text-stone-300
                  text-lg font-bold flex items-center justify-center hover:bg-stone-700
                  disabled:opacity-30 transition-colors"
              >
                −
              </button>
              <span className="text-xl font-semibold text-stone-200 w-6 text-center">
                {state.sceneCount}
              </span>
              <button
                type="button"
                onClick={() => setSceneCount(state.sceneCount + 1)}
                disabled={state.sceneCount >= 8}
                className="w-8 h-8 rounded-lg bg-stone-800 border border-stone-700 text-stone-300
                  text-lg font-bold flex items-center justify-center hover:bg-stone-700
                  disabled:opacity-30 transition-colors"
              >
                +
              </button>
              <span className="text-[10px] font-mono text-stone-500">2–8 scenes</span>
            </div>
          </Field>

          <Field
            label="Scene Names"
            hint="Name each scene — leave blank to let Claude choose"
          >
            <div className="flex flex-col gap-2">
              {state.sceneNames.map((name, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-stone-500 w-4 shrink-0">{i + 1}.</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        const names = [...state.sceneNames];
                        names[i] = e.target.value;
                        update("sceneNames", names);
                      }}
                      placeholder={`Scene ${i + 1} name (optional)`}
                      className="flex-1 bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5
                        text-xs text-stone-200 outline-none focus:border-violet-500/70 placeholder:text-stone-600"
                    />
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <input
                      type="text"
                      value={state.sceneIntents[i]}
                      onChange={(e) => {
                        const intents = [...state.sceneIntents];
                        intents[i] = e.target.value;
                        update("sceneIntents", intents);
                      }}
                      placeholder="Brief intent (e.g. 'player finds key, hears footsteps from rear')"
                      className="flex-1 bg-stone-900 border border-stone-700 rounded px-2.5 py-1
                        text-[10px] text-stone-300 outline-none focus:border-violet-500/50
                        placeholder:text-stone-600 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* ── Step 3: VR/AR features ── */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <StepHeader step={3} total={4} title={`${mode.toUpperCase()} Features`} />

          <Field label="Panel View Pattern" hint="How each scene's sketch panels are laid out">
            <RadioGroup
              options={
                mode === "ar"
                  ? VIEW_PATTERN_OPTIONS.filter((o) => o.value !== "triplet" && o.value !== "pov_only")
                  : VIEW_PATTERN_OPTIONS.filter((o) => o.value !== "ar_overlay")
              }
              value={state.viewTypePattern}
              onChange={(v) => update("viewTypePattern", v as VrArInputState["viewTypePattern"])}
            />
          </Field>

          <Field label="FOV Zone Coverage" hint="Which zones of the 360° space to annotate">
            <RadioGroup
              options={FOV_OPTIONS}
              value={state.fovCoverage}
              onChange={(v) => update("fovCoverage", v as VrArInputState["fovCoverage"])}
            />
          </Field>

          <Field label="Trigger Types" hint="What kinds of player actions trigger events">
            <MultiCheckbox
              options={TRIGGER_OPTIONS}
              selected={state.triggerTypes}
              onChange={(v) => update("triggerTypes", v)}
            />
          </Field>

          <Field label="Sensory & Interaction Features" hint="Select all that apply">
            <MultiCheckbox
              options={SENSORY_OPTIONS}
              selected={state.sensoryFeatures}
              onChange={(v) => update("sensoryFeatures", v)}
            />
          </Field>

          <Field label="Scene Transition Type">
            <div className="flex flex-wrap gap-1.5">
              {TRANSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("transitionType", opt.value)}
                  className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-colors ${
                    state.transitionType === opt.value
                      ? "bg-violet-900/50 border-violet-500 text-violet-200"
                      : "bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-500"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* ── Step 4: Style ── */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <StepHeader step={4} total={4} title="Sketch Style" />

          <Field label="Sketch Style" hint="How AI-generated panel sketches will look">
            <RadioGroup
              options={STYLE_OPTIONS}
              value={state.sketchStyle}
              onChange={(v) => update("sketchStyle", v as VrArInputState["sketchStyle"])}
            />
          </Field>

          {/* Summary preview */}
          <div className="bg-stone-900 border border-stone-700 rounded-lg p-3 flex flex-col gap-1.5">
            <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wide">Prompt preview</span>
            <pre className="text-[8px] font-mono text-stone-400 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {compileVrArPrompt(state)}
            </pre>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={step === 1 ? onCancel : () => setStep((s) => s - 1)}
          className="text-[10px] font-mono text-stone-400 hover:text-stone-200 border border-stone-700
            hover:border-stone-500 rounded px-3 py-1.5 transition-colors"
        >
          {step === 1 ? "← cancel" : "← back"}
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed(step)}
            className={`text-[10px] font-mono text-white rounded px-4 py-1.5 transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed ${accentBtn}`}
          >
            next →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            className={`text-sm font-medium text-white rounded-lg px-5 py-2 transition-colors ${accentBtn}`}
          >
            ✦ Generate Storyboard
          </button>
        )}
      </div>
    </div>
  );
}
