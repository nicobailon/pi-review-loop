#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const EXTENSION_NAME = "pi-review-loop";
const TARGET_DIR = path.join(os.homedir(), ".pi", "agent", "extensions", EXTENSION_NAME);
const PROMPTS_DIR = path.join(os.homedir(), ".pi", "agent", "prompts");
const SOURCE_DIR = path.dirname(__dirname);
const FILES = ["index.ts", "settings.ts", "review-loop.png"];
const PROMPTS = ["double-check.md", "double-check-plan.md"];

try {
  // Install extension files
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  for (const file of FILES) {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(TARGET_DIR, file);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  // Install prompt templates (skip if already exist)
  fs.mkdirSync(PROMPTS_DIR, { recursive: true });
  const installedPrompts = [];

  for (const file of PROMPTS) {
    const src = path.join(SOURCE_DIR, "prompts", file);
    const dest = path.join(PROMPTS_DIR, file);

    if (fs.existsSync(src) && !fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      installedPrompts.push(file);
    }
  }

  console.log("");
  console.log("✓ pi-review-loop installed to ~/.pi/agent/extensions/pi-review-loop/");
  if (installedPrompts.length > 0) {
    console.log(`✓ Prompt templates installed: ${installedPrompts.join(", ")}`);
  }
  console.log("  Restart pi to load the extension.");
  console.log("");
} catch (err) {
  console.error("Failed to install pi-review-loop:", err.message);
  process.exit(1);
}
