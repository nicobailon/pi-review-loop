#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const EXTENSION_NAME = "pi-review-loop";
const TARGET_DIR = path.join(os.homedir(), ".pi", "agent", "extensions", EXTENSION_NAME);

try {
  if (fs.existsSync(TARGET_DIR)) {
    fs.rmSync(TARGET_DIR, { recursive: true });
    console.log("");
    console.log("✓ pi-review-loop removed from ~/.pi/agent/extensions/pi-review-loop/");
    console.log("");
  }
} catch (err) {
  console.error("Failed to uninstall pi-review-loop:", err.message);
}
