import { Stack } from "./lib/stacks";
import { CodeGenerationModel } from "./lib/models";

export enum EditorTheme {
  ESPRESSO = "espresso",
  COBALT = "cobalt",
}

// ✅ Visual style for generated output
export enum AestheticMode {
  WIREFRAME = "wireframe",
  HIGH_FI = "high_fi",
  GAMING_STORYBOARD = "gaming_storyboard",
}

// ✅ How many pages to generate — orthogonal to visual style
export type GenerationScope = "single_page" | "full_project";

export interface Settings {
  openAiApiKey: string | null;
  openAiBaseURL: string | null;
  screenshotOneApiKey: string | null;
  isImageGenerationEnabled: boolean;
  editorTheme: EditorTheme;
  generatedCodeConfig: Stack;
  codeGenerationModel: CodeGenerationModel;
  isTermOfServiceAccepted: boolean;
  anthropicApiKey: string | null;
  aestheticMode: AestheticMode;     // visual style (wireframe / high-fi / gaming)
  generationScope: GenerationScope; // single page vs full multi-page project
}

export enum AppState {
  INITIAL = "INITIAL",
  CODING = "CODING",
  CODE_READY = "CODE_READY",
}

export enum ScreenRecorderState {
  INITIAL = "initial",
  RECORDING = "recording",
  FINISHED = "finished",
}

export interface PromptContent {
  text: string;
  images: string[];
}

export interface CodeGenerationParams {
  generationType: "create" | "update";
  inputMode: "image" | "video" | "text";
  prompt: PromptContent;
  history?: PromptContent[];
  isImportedFromCode?: boolean;
  variantCount?: number;
}

export type FullGenerationSettings = CodeGenerationParams & Settings;

export interface DbGeneration {
  id: string;
  user_id: string;
  prompt: string;
  code: string;
  project_state: any;
  created_at: string;
}

// ✅ NEW: Component saved in the library
export interface SavedComponent {
  id: string;
  name: string;
  html: string;
  tagName: string;
  createdAt: string;
}
