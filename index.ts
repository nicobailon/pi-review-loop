import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { loadSettings, getReviewPrompt, type ReviewerLoopSettings } from "./settings.js";

export default function (pi: ExtensionAPI) {
  let settings: ReviewerLoopSettings = loadSettings();
  let reviewModeActive = false;
  let currentIteration = 0;

  function updateStatus(ctx: ExtensionContext) {
    if (reviewModeActive) {
      ctx.ui.setStatus(
        "reviewer-loop",
        `Review mode (${currentIteration}/${settings.maxIterations})`
      );
    } else {
      ctx.ui.setStatus("reviewer-loop", undefined);
    }
  }

  function exitReviewMode(ctx: ExtensionContext, reason: string) {
    reviewModeActive = false;
    currentIteration = 0;
    updateStatus(ctx);
    ctx.ui.notify(`Review mode ended: ${reason}`, "info");
  }

  function enterReviewMode(ctx: ExtensionContext) {
    reviewModeActive = true;
    currentIteration = 0;
    updateStatus(ctx);
    ctx.ui.notify("Review mode activated", "info");
  }

  pi.on("session_start", async () => {
    settings = loadSettings();
  });

  pi.on("input", async (event, ctx) => {
    if (!ctx.hasUI) return { action: "continue" as const };

    const isTrigger = settings.triggerPatterns.some((p) => p.test(event.text));

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

    const isTrigger = settings.triggerPatterns.some((p) => p.test(event.prompt));
    if (isTrigger) {
      enterReviewMode(ctx);
    }
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
    if (currentIteration > settings.maxIterations) {
      exitReviewMode(ctx, `max iterations (${settings.maxIterations}) reached`);
      return;
    }

    updateStatus(ctx);
    pi.sendUserMessage(getReviewPrompt(settings.reviewPromptConfig), {
      deliverAs: "followUp",
    });
  });

  pi.registerCommand("review-start", {
    description: "Activate review loop and send review prompt immediately",
    handler: async (_args, ctx) => {
      if (reviewModeActive) {
        ctx.ui.notify("Review mode is already active", "info");
      } else {
        enterReviewMode(ctx);
        pi.sendUserMessage(getReviewPrompt(settings.reviewPromptConfig));
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
        ctx.ui.notify(
          `Review mode active: iteration ${currentIteration}/${settings.maxIterations}`,
          "info"
        );
      } else {
        ctx.ui.notify(
          `Review mode inactive (max: ${settings.maxIterations})`,
          "info"
        );
      }
    },
  });
}
