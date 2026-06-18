// Keep in sync with backend (llm.py)
// Order here matches dropdown order
export enum CodeGenerationModel {
  CLAUDE_4_5_SONNET_2025_09_29 = "claude-sonnet-4-5-20250929",
  CLAUDE_4_SONNET_2025_05_14   = "claude-sonnet-4-20250514",
  GPT_4O_2024_05_13            = "gpt-4o-2024-05-13",
  GPT_4_TURBO_2024_04_09       = "gpt-4-turbo-2024-04-09",
  GEMINI_2_0_FLASH             = "gemini-2.0-flash",
  GEMINI_2_5_FLASH_PREVIEW     = "gemini-2.5-flash-preview-05-20",
  GPT_4_VISION                 = "gpt_4_vision",
  CLAUDE_3_SONNET              = "claude_3_sonnet",
}

export const CODE_GENERATION_MODEL_DESCRIPTIONS: {
  [key in CodeGenerationModel]: { name: string; inBeta: boolean };
} = {
  "claude-sonnet-4-5-20250929":        { name: "Claude Sonnet 4.5",        inBeta: false },
  "claude-sonnet-4-20250514":          { name: "Claude Sonnet 4",           inBeta: false },
  "gpt-4o-2024-05-13":                 { name: "GPT-4o",                    inBeta: false },
  "gpt-4-turbo-2024-04-09":            { name: "GPT-4 Turbo",               inBeta: false },
  "gemini-2.0-flash":                  { name: "Gemini 2.0 Flash",          inBeta: false },
  "gemini-2.5-flash-preview-05-20":    { name: "Gemini 2.5 Flash",          inBeta: true  },
  gpt_4_vision:                        { name: "GPT-4 Vision (deprecated)", inBeta: false },
  claude_3_sonnet:                     { name: "Claude 3 (deprecated)",     inBeta: false },
};