import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");

export const DEFAULT_MAX_ITERATIONS = 7;

export const DEFAULT_REVIEW_PROMPT = `Great, now I want you to carefully read over all of the new code you just wrote and other existing code you just modified with "fresh eyes," looking super carefully for any obvious bugs, errors, problems, issues, confusion, etc. If any issues are found, proceed to fix them without being asked to do so.

**Response format:**
- If you find ANY issues: fix them, then list what you fixed. Do NOT say "no issues found" - instead end with "Fixed [N] issue(s). Ready for another review."
- If you find ZERO issues: respond with exactly "No issues found."`;

export const DEFAULT_TRIGGER_PATTERNS: RegExp[] = [
  /\bimplement\s+(the\s+)?plan\b/i,
  /\bimplement\s+(the\s+)?spec\b/i,
  /\bimplement\s+(this\s+)?plan\b/i,
  /\bimplement\s+(this\s+)?spec\b/i,
  /\bstart\s+implementing\b.*\b(plan|spec)\b/i,
  /\bgo\s+ahead\s+and\s+implement\b.*\b(plan|spec)\b/i,
  /\blet'?s\s+implement\b.*\b(plan|spec)\b/i,
  /\b(plan|spec)\b.*\bstart\s+implementing\b/i,
  /\b(plan|spec)\b.*\bgo\s+ahead\s+and\s+implement\b/i,
  /\b(plan|spec)\b.*\blet'?s\s+implement\b/i,
  /read over all of the new code.*fresh eyes/i,
];

export const DEFAULT_EXIT_PATTERNS: RegExp[] = [
  /no\s+(\w+\s+)?issues\s+found/i,
  /no\s+(\w+\s+)?bugs\s+found/i,
  /(?:^|\n)\s*(?:looks\s+good|all\s+good)[\s.,!]*(?:$|\n)/im,
];

export const DEFAULT_ISSUES_FIXED_PATTERNS: RegExp[] = [
  /issues?\s+(i\s+)?fixed/i,
  /fixed\s+(the\s+)?(following|these|this|issues?|bugs?)/i,
  /fixed\s+\d+\s+issues?/i,
  /found\s+and\s+(fixed|corrected|resolved)/i,
  /bugs?\s+(i\s+)?fixed/i,
  /corrected\s+(the\s+)?(following|these|this)/i,
  /(?<!no\s)issues?\s+(i\s+)?(found|identified|discovered)/i,
  /(?<!no\s)problems?\s+(i\s+)?(found|identified|discovered)/i,
  /changes?\s+(i\s+)?made/i,
  /here'?s?\s+what\s+(i\s+)?(fixed|changed|corrected)/i,
  /(issues|bugs|problems|changes|fixes)\s*:/i,
  /ready\s+for\s+(another|the\s+next)\s+review/i,
];

export interface PatternConfig {
  mode?: "extend" | "replace";
  patterns: string[];
}

export interface ReviewPromptConfig {
  type: "inline" | "file" | "template";
  value: string;
}

export interface ReviewerLoopSettingsRaw {
  maxIterations?: number;
  reviewPrompt?: string;
  triggerPatterns?: PatternConfig;
  exitPatterns?: PatternConfig;
  issuesFixedPatterns?: PatternConfig;
}

export interface ReviewerLoopSettings {
  maxIterations: number;
  reviewPromptConfig: ReviewPromptConfig;
  triggerPatterns: RegExp[];
  exitPatterns: RegExp[];
  issuesFixedPatterns: RegExp[];
}

function parsePattern(input: unknown): RegExp | null {
  if (typeof input !== "string") return null;

  const match = input.match(/^\/(.+)\/([gimsuy]*)$/);
  if (match) {
    try {
      return new RegExp(match[1], match[2]);
    } catch {
      return null;
    }
  }
  const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

function loadPatterns(
  config: PatternConfig | undefined,
  defaults: RegExp[]
): RegExp[] {
  if (!config?.patterns || !Array.isArray(config.patterns) || config.patterns.length === 0) {
    return defaults;
  }

  const userPatterns = config.patterns
    .map(parsePattern)
    .filter((p): p is RegExp => p !== null);

  if (config.mode === "replace") {
    return userPatterns.length > 0 ? userPatterns : defaults;
  }

  return [...defaults, ...userPatterns];
}

function isFilePath(value: string): boolean {
  return (
    value.startsWith("~/") ||
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.endsWith(".md") ||
    value.endsWith(".txt")
  );
}

function parseReviewPromptConfig(value: string | undefined): ReviewPromptConfig {
  if (!value) {
    return { type: "inline", value: DEFAULT_REVIEW_PROMPT };
  }

  if (value.startsWith("template:")) {
    const templateName = value.slice("template:".length).trim();
    return { type: "template", value: templateName };
  }

  if (isFilePath(value)) {
    return { type: "file", value };
  }

  return { type: "inline", value };
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

function resolvePath(value: string): string {
  if (value.startsWith("~/")) {
    return join(homedir(), value.slice(2));
  }
  return value;
}

export function getReviewPrompt(config: ReviewPromptConfig): string {
  switch (config.type) {
    case "inline":
      return config.value || DEFAULT_REVIEW_PROMPT;

    case "file": {
      const resolvedPath = resolvePath(config.value);
      try {
        const content = readFileSync(resolvedPath, "utf-8").trim();
        return content || DEFAULT_REVIEW_PROMPT;
      } catch {
        return DEFAULT_REVIEW_PROMPT;
      }
    }

    case "template": {
      const templatePath = join(
        homedir(),
        ".pi",
        "agent",
        "prompts",
        `${config.value}.md`
      );
      try {
        if (!existsSync(templatePath)) {
          return DEFAULT_REVIEW_PROMPT;
        }
        let content = readFileSync(templatePath, "utf-8");
        content = stripFrontmatter(content);
        content = content.replace(/\$@/g, "").trim();
        return content || DEFAULT_REVIEW_PROMPT;
      } catch {
        return DEFAULT_REVIEW_PROMPT;
      }
    }
  }
}

export function loadSettings(): ReviewerLoopSettings {
  let raw: ReviewerLoopSettingsRaw = {};

  try {
    const content = readFileSync(SETTINGS_PATH, "utf-8");
    const parsed = JSON.parse(content);
    raw = parsed?.reviewerLoop ?? {};
  } catch {
    // Use all defaults
  }

  return {
    maxIterations:
      typeof raw.maxIterations === "number" && raw.maxIterations >= 1
        ? raw.maxIterations
        : DEFAULT_MAX_ITERATIONS,
    reviewPromptConfig: parseReviewPromptConfig(raw.reviewPrompt),
    triggerPatterns: loadPatterns(raw.triggerPatterns, DEFAULT_TRIGGER_PATTERNS),
    exitPatterns: loadPatterns(raw.exitPatterns, DEFAULT_EXIT_PATTERNS),
    issuesFixedPatterns: loadPatterns(
      raw.issuesFixedPatterns,
      DEFAULT_ISSUES_FIXED_PATTERNS
    ),
  };
}
