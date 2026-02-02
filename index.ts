import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { loadSettings, getReviewPrompt, type ReviewerLoopSettings, type ReviewPromptConfig } from "./settings.js";

export default function (pi: ExtensionAPI) {
  let settings: ReviewerLoopSettings = loadSettings();
  let reviewModeActive = false;
  let currentIteration = 0;
  let customPromptSuffix = "";
  let freshContext = settings.freshContext;
  let reviewBoundaryCount = -1;
  let boundaryNeedsCapture = false;
  let activePromptConfig: ReviewPromptConfig = settings.reviewPromptConfig;

  function updateStatus(ctx: ExtensionContext) {
    if (reviewModeActive) {
      const parts = [`Review mode (${currentIteration + 1}/${settings.maxIterations})`];
      if (freshContext) parts.push("fresh");
      ctx.ui.setStatus("review-loop", parts.join(" | "));
    } else {
      ctx.ui.setStatus("review-loop", undefined);
    }
  }

  function buildReviewPrompt(promptConfig: ReviewPromptConfig): string {
    const basePrompt = getReviewPrompt(promptConfig);
    if (customPromptSuffix) {
      return `${basePrompt}\n\n**Additional focus:** ${customPromptSuffix}`;
    }
    return basePrompt;
  }

  function parseCustomText(args: string): string {
    const trimmed = args.trim();
    if (!trimmed) return "";

    const match = trimmed.match(/^"(.+)"$/s) || trimmed.match(/^'(.+)'$/s);
    return match ? match[1].trim() : trimmed;
  }

  function exitReviewMode(ctx: ExtensionContext, reason: string) {
    reviewModeActive = false;
    currentIteration = 0;
    customPromptSuffix = "";
    reviewBoundaryCount = -1;
    boundaryNeedsCapture = false;
    activePromptConfig = settings.reviewPromptConfig;
    updateStatus(ctx);
    ctx.ui.notify(`Review mode ended: ${reason}`, "info");
  }

  function enterReviewMode(ctx: ExtensionContext) {
    reviewModeActive = true;
    currentIteration = 0;
    reviewBoundaryCount = -1;
    boundaryNeedsCapture = false;
    updateStatus(ctx);
    ctx.ui.notify("Review mode activated", "info");
  }

  pi.on("session_start", async () => {
    settings = loadSettings();
    freshContext = settings.freshContext;
    activePromptConfig = settings.reviewPromptConfig;
    reviewModeActive = false;
    currentIteration = 0;
    customPromptSuffix = "";
    reviewBoundaryCount = -1;
    boundaryNeedsCapture = false;
  });

  pi.on("input", async (event, ctx) => {
    if (!ctx.hasUI) return { action: "continue" as const };

    const isTrigger = settings.autoTrigger && settings.triggerPatterns.some((p) => p.test(event.text));

    if (reviewModeActive && event.source === "interactive" && !isTrigger) {
      exitReviewMode(ctx, "user interrupted");
      return { action: "continue" as const };
    }

    if (isTrigger && !reviewModeActive) {
      enterReviewMode(ctx);
    }

    return { action: "continue" as const };
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!ctx.hasUI) return;
    if (reviewModeActive) return;
    if (!settings.autoTrigger) return;

    const isTrigger = settings.triggerPatterns.some((p) => p.test(event.prompt));
    if (isTrigger) {
      enterReviewMode(ctx);
    }
  });

  pi.on("context", async (event) => {
    if (!reviewModeActive || !freshContext) return;

    const messages = event.messages;
    if (messages.length === 0) return;

    if (boundaryNeedsCapture) {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          reviewBoundaryCount = i;
          break;
        }
      }
      boundaryNeedsCapture = false;
    }

    if (currentIteration === 0) return;
    if (reviewBoundaryCount < 0) return;

    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;
    if (reviewBoundaryCount >= lastUserIdx) return;

    const preReview = messages.slice(0, reviewBoundaryCount);
    const currentIterationMsgs = messages.slice(lastUserIdx);

    const assembled: typeof messages = [...preReview];

    assembled.push({
      role: "user",
      content: [{
        type: "text",
        text: `[Review pass ${currentIteration + 1}. ${currentIteration} prior pass(es) completed, fixes applied to code. Re-read any relevant plan, spec, PRD, or progress documents before reviewing. Review with fresh eyes.]`,
      }],
      timestamp: Date.now(),
    } as any);

    assembled.push(...currentIterationMsgs);

    return { messages: assembled };
  });

  pi.on("agent_end", async (event, ctx) => {
    if (!ctx.hasUI) return;
    if (!reviewModeActive) return;

    const assistantMessages = event.messages.filter((m) => m.role === "assistant");
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];

    if (!lastAssistantMessage) {
      exitReviewMode(ctx, "aborted");
      return;
    }

    const textContent = lastAssistantMessage.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    if (!textContent.trim()) {
      exitReviewMode(ctx, "aborted");
      return;
    }

    const hasExitPhrase = settings.exitPatterns.some((p) => p.test(textContent));
    const hasIssuesFixed = settings.issuesFixedPatterns.some((p) =>
      p.test(textContent)
    );

    if (hasExitPhrase && !hasIssuesFixed) {
      exitReviewMode(ctx, "no issues found");
      return;
    }

    currentIteration++;
    if (currentIteration >= settings.maxIterations) {
      exitReviewMode(ctx, `max iterations (${settings.maxIterations}) reached`);
      return;
    }

    if (freshContext && reviewBoundaryCount < 0) boundaryNeedsCapture = true;
    updateStatus(ctx);
    pi.sendUserMessage(buildReviewPrompt(activePromptConfig), {
      deliverAs: "followUp",
    });
  });

  pi.registerCommand("review-start", {
    description: "Activate review loop with optional custom focus text.",
    handler: async (args, ctx) => {
      if (reviewModeActive) {
        ctx.ui.notify("Review mode is already active", "info");
      } else {
        customPromptSuffix = parseCustomText(args);
        activePromptConfig = settings.reviewPromptConfig;
        enterReviewMode(ctx);
        if (freshContext && reviewBoundaryCount < 0) boundaryNeedsCapture = true;
        pi.sendUserMessage(buildReviewPrompt(activePromptConfig));
      }
    },
  });

  pi.registerCommand("review-plan", {
    description: "Activate review loop for plans/specs/PRDs with optional custom focus text.",
    handler: async (args, ctx) => {
      if (reviewModeActive) {
        ctx.ui.notify("Review mode is already active", "info");
      } else {
        customPromptSuffix = parseCustomText(args);
        activePromptConfig = { type: "template", value: "double-check-plan" };
        enterReviewMode(ctx);
        if (freshContext && reviewBoundaryCount < 0) boundaryNeedsCapture = true;
        pi.sendUserMessage(buildReviewPrompt(activePromptConfig));
      }
    },
  });

  pi.registerCommand("review-max", {
    description: "Set max review iterations (default: 7)",
    handler: async (args, ctx) => {
      const num = parseInt(args, 10);
      if (isNaN(num) || num < 1) {
        ctx.ui.notify("Usage: /review-max <number>", "error");
        return;
      }
      settings.maxIterations = num;
      ctx.ui.notify(`Max review iterations set to ${settings.maxIterations}`, "info");
    },
  });

  pi.registerCommand("review-exit", {
    description: "Exit review mode manually",
    handler: async (_args, ctx) => {
      if (reviewModeActive) {
        exitReviewMode(ctx, "manual exit");
      } else {
        ctx.ui.notify("Review mode is not active", "info");
      }
    },
  });

  pi.registerCommand("review-status", {
    description: "Show review mode status",
    handler: async (_args, ctx) => {
      if (reviewModeActive) {
        const parts = [`iteration ${currentIteration + 1}/${settings.maxIterations}`];
        if (freshContext) parts.push("fresh context");
        ctx.ui.notify(`Review mode active: ${parts.join(", ")}`, "info");
      } else {
        ctx.ui.notify(
          `Review mode inactive (max: ${settings.maxIterations}, auto-trigger: ${settings.autoTrigger ? "on" : "off"}, fresh: ${freshContext ? "on" : "off"})`,
          "info"
        );
      }
    },
  });

  pi.registerCommand("review-auto", {
    description: "Toggle auto-trigger, or start review with custom focus: /review-auto focus on X",
    handler: async (args, ctx) => {
      const arg = args.trim();
      const argLower = arg.toLowerCase();

      if (argLower === "on" || argLower === "true" || argLower === "1") {
        settings.autoTrigger = true;
        ctx.ui.notify(`Auto-trigger enabled`, "info");
        return;
      }
      if (argLower === "off" || argLower === "false" || argLower === "0") {
        settings.autoTrigger = false;
        ctx.ui.notify(`Auto-trigger disabled`, "info");
        return;
      }
      if (arg === "") {
        settings.autoTrigger = !settings.autoTrigger;
        ctx.ui.notify(
          `Auto-trigger ${settings.autoTrigger ? "enabled" : "disabled"}`,
          "info"
        );
        return;
      }

      settings.autoTrigger = true;
      customPromptSuffix = parseCustomText(arg);
      if (reviewModeActive) {
        ctx.ui.notify(`Auto-trigger enabled, focus updated for next iteration`, "info");
      } else {
        activePromptConfig = settings.reviewPromptConfig;
        enterReviewMode(ctx);
        if (freshContext && reviewBoundaryCount < 0) boundaryNeedsCapture = true;
        pi.sendUserMessage(buildReviewPrompt(activePromptConfig));
        ctx.ui.notify(`Auto-trigger enabled, review started with custom focus`, "info");
      }
    },
  });

  pi.registerCommand("review-fresh", {
    description: "Toggle fresh context mode for review iterations",
    handler: async (args, ctx) => {
      const arg = args.trim().toLowerCase();

      if (arg === "on" || arg === "true" || arg === "1") {
        freshContext = true;
      } else if (arg === "off" || arg === "false" || arg === "0") {
        freshContext = false;
      } else {
        freshContext = !freshContext;
      }
      ctx.ui.notify(`Fresh context ${freshContext ? "enabled" : "disabled"}`, "info");
    },
  });

  pi.registerTool({
    name: "review_loop",
    description:
      "Control the automated code review loop. Start/stop review mode, toggle auto-trigger, or check status. When started, the loop repeatedly prompts for code review until 'No issues found' or max iterations reached.",
    parameters: Type.Object({
      start: Type.Optional(
        Type.Boolean({
          description: "Start review mode and send the review prompt",
        })
      ),
      stop: Type.Optional(
        Type.Boolean({
          description: "Stop review mode",
        })
      ),
      autoTrigger: Type.Optional(
        Type.Boolean({
          description: "Enable/disable auto-trigger from keywords (disabled by default)",
        })
      ),
      maxIterations: Type.Optional(
        Type.Number({
          description: "Set max iterations (can be combined with start)",
          minimum: 1,
        })
      ),
      focus: Type.Optional(
        Type.String({
          description: "Custom focus/instructions to append to the review prompt (e.g., \"focus on error handling\")",
        })
      ),
      freshContext: Type.Optional(
        Type.Boolean({
          description: "Enable/disable fresh context mode (strips prior review iterations from context)",
        })
      ),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (typeof params.maxIterations === "number" && params.maxIterations >= 1) {
        settings.maxIterations = params.maxIterations;
      }

      if (typeof params.autoTrigger === "boolean") {
        settings.autoTrigger = params.autoTrigger;
        ctx.ui.notify(
          `Auto-trigger ${settings.autoTrigger ? "enabled" : "disabled"}`,
          "info"
        );
      }

      if (typeof params.focus === "string") {
        customPromptSuffix = params.focus.trim();
      }

      if (typeof params.freshContext === "boolean") {
        freshContext = params.freshContext;
        ctx.ui.notify(
          `Fresh context ${freshContext ? "enabled" : "disabled"}`,
          "info"
        );
      }

      if (params.start) {
        if (reviewModeActive) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  active: true,
                  currentIteration,
                  maxIterations: settings.maxIterations,
                  autoTrigger: settings.autoTrigger,
                  freshContext,
                  focus: customPromptSuffix || undefined,
                  message: "Review mode is already active",
                }),
              },
            ],
          };
        }

        activePromptConfig = settings.reviewPromptConfig;
        enterReviewMode(ctx);
        if (freshContext && reviewBoundaryCount < 0) boundaryNeedsCapture = true;
        pi.sendUserMessage(buildReviewPrompt(activePromptConfig));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                active: true,
                currentIteration,
                maxIterations: settings.maxIterations,
                autoTrigger: settings.autoTrigger,
                freshContext,
                focus: customPromptSuffix || undefined,
                message: customPromptSuffix
                  ? `Review mode started with custom focus. Review prompt sent.`
                  : "Review mode started. Review prompt sent.",
              }),
            },
          ],
        };
      }

      if (params.stop) {
        if (!reviewModeActive) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  active: false,
                  currentIteration: 0,
                  maxIterations: settings.maxIterations,
                  autoTrigger: settings.autoTrigger,
                  freshContext,
                  message: "Review mode is not active",
                }),
              },
            ],
          };
        }

        exitReviewMode(ctx, "stopped by agent");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                active: false,
                currentIteration: 0,
                maxIterations: settings.maxIterations,
                autoTrigger: settings.autoTrigger,
                freshContext,
                message: "Review mode stopped",
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              active: reviewModeActive,
              currentIteration,
              maxIterations: settings.maxIterations,
              autoTrigger: settings.autoTrigger,
              freshContext,
              focus: customPromptSuffix || undefined,
              message: reviewModeActive
                ? `Review mode active: iteration ${currentIteration + 1}/${settings.maxIterations}`
                : "Review mode inactive",
            }),
          },
        ],
      };
    },
  });
}
