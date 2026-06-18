import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { HTTP_BACKEND_URL } from "../../config";
import { Settings } from "../../types";
import { supabase } from "../../lib/supabase";
import StoryboardView, { Storyboard } from "./StoryboardView";

interface Props {
  settings: Settings;
  userId?: string | null;
  initialStoryboard?: Storyboard | null;
  onClearInitial?: () => void;
  onGenerated?: () => void; // called after successful save → triggers history refresh
  onStoryboardActive?: (title: string) => void; // called when a storyboard becomes active
}

const EXAMPLES = [
  "A 2D platformer where the player escapes a crumbling dungeon, avoiding spike traps and enemies while collecting keys to unlock the exit.",
  "A top-down shooter where the player defends a base from waves of alien ships, picking up power-ups between waves.",
  "A puzzle game where the player pushes blocks onto pressure plates to open doors, with increasing complexity each level.",
];

// Strip internal fields that must not be written into the JSON stored in Supabase
function cleanForStorage(storyboard: Storyboard): Omit<Storyboard, "_dbId"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _dbId, ...clean } = storyboard;
  return clean;
}

// INSERT a new row and return the auto-generated id
async function insertStoryboard(
  prompt: string,
  storyboard: Storyboard,
  userId: string | null | undefined,
): Promise<number | null> {
  if (!userId) {
    console.warn("No user ID — skipping Supabase insert");
    return null;
  }
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

  if (error) {
    console.error("Failed to insert storyboard:", error.message);
    throw error;
  }
  console.log("✅ Storyboard inserted, id:", data.id);
  return data.id as number;
}

// UPDATE an existing row — same history entry, updated content
async function updateStoryboard(
  storyboard: Storyboard,
  generationId: number,
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) {
    console.warn("No user ID — skipping Supabase update");
    return;
  }
  const { error } = await supabase
    .from("generations")
    .update({
      code: JSON.stringify(cleanForStorage(storyboard)),
      title: storyboard.title ?? "Storyboard",
    })
    .eq("id", generationId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update storyboard:", error.message);
    throw error;
  }
  console.log("✅ Storyboard updated, id:", generationId);
}

export default function StoryboardGenerator({
  settings,
  userId,
  initialStoryboard,
  onClearInitial,
  onGenerated,
  onStoryboardActive,
}: Props) {
  const [scenario, setScenario] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  // Tracks which Supabase row the current storyboard belongs to.
  // SET after first INSERT so subsequent Saves UPDATE that row instead of inserting new ones.
  const [generationId, setGenerationId] = useState<number | null>(null);
  // Incremented every time a new storyboard is loaded — forces StoryboardView to remount
  const [loadKey, setLoadKey] = useState(0);

  // Restore a storyboard loaded from history
  useEffect(() => {
    if (initialStoryboard) {
      // Old storyboards saved before the boardId feature had no boardId — assign one now
      const withBoardId: Storyboard = initialStoryboard.boardId
        ? initialStoryboard
        : { ...initialStoryboard, boardId: nanoid(8) };
      // Extract the DB row id attached by HistoryPanel so Save can UPDATE this row
      setGenerationId(withBoardId._dbId ?? null);
      setStoryboard(withBoardId);
      setLoadKey((k) => k + 1);
      onStoryboardActive?.(withBoardId.title ?? "Storyboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStoryboard]);

  const generate = async () => {
    if (!scenario.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Ask Claude for the storyboard
      const res = await fetch(`${HTTP_BACKEND_URL}/api/storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: scenario.trim(),
          anthropic_api_key: settings.anthropicApiKey ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Server error ${res.status}`);
      }
      const raw: Storyboard = await res.json();
      const data: Storyboard = { ...raw, boardId: nanoid(8) };

      // 2. INSERT into Supabase and capture the new row id
      const newId = await insertStoryboard(scenario.trim(), data, userId);
      setGenerationId(newId);

      // 3. Notify parent so history panel refreshes + sidebar shows storyboard meta
      onGenerated?.();
      onStoryboardActive?.(data.title ?? "Storyboard");

      setStoryboard(data);
      setLoadKey((k) => k + 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Called when user presses the Save button inside StoryboardView.
  // Updates the SAME Supabase row — no duplicate history entries.
  const handleSave = async (current: Storyboard) => {
    // Use tracked generationId first; fall back to _dbId on the storyboard object
    // (set when loading from history) in case the component remounted.
    const rowId = generationId ?? current._dbId ?? null;
    if (rowId) {
      await updateStoryboard(current, rowId, userId);
      if (!generationId) setGenerationId(rowId);
    } else {
      // Truly new storyboard with no DB row yet — insert
      const newId = await insertStoryboard(current.title, current, userId);
      setGenerationId(newId);
    }
    onGenerated?.(); // refresh history panel so the updated title shows
  };

  const handleReset = () => {
    setStoryboard(null);
    setGenerationId(null);
    onClearInitial?.();
  };

  if (storyboard) {
    return (
      <div className="p-4">
        <StoryboardView
          key={loadKey}
          storyboard={storyboard}
          onReset={handleReset}
          anthropicApiKey={settings.anthropicApiKey}
          onSave={handleSave}
        />
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-xl mx-auto">
      <div>
        <h2 className="text-sm font-semibold text-stone-200 mb-1">Game Storyboard Generator</h2>
        <p className="text-[11px] text-stone-400 font-mono leading-relaxed">
          Describe your game scenario and Claude will generate a sequential storyboard of gameplay
          scenes — each with sketch space and editable metadata.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-mono text-stone-400 uppercase tracking-wide">
          Game Scenario
        </label>
        <textarea
          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2.5
            text-sm text-stone-200 resize-none outline-none
            focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/30
            placeholder:text-stone-600 transition-colors"
          rows={5}
          placeholder="Describe your game idea, mechanics, and the story you want to storyboard..."
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
          }}
        />
        <p className="text-[10px] text-stone-600 font-mono">Cmd/Ctrl + Enter to generate</p>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <button
        disabled={loading || !scenario.trim()}
        onClick={generate}
        className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40
          disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating storyboard…
          </span>
        ) : (
          "Generate Storyboard"
        )}
      </button>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wide">Examples</span>
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => setScenario(ex)}
            className="text-left text-[10px] text-stone-500 hover:text-stone-300 font-mono
              bg-stone-900/50 hover:bg-stone-800 border border-stone-800 rounded px-2.5 py-1.5
              transition-colors leading-relaxed"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
