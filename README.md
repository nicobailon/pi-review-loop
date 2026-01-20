<p>
  <img src="review-loop.png" alt="pi-review-loop" width="1100">
</p>

# Pi Review Loop

Automated code review loop for [Pi coding agent](https://buildwithpi.ai/). Repeatedly prompts the agent to review its own work until it confirms no issues remain.

```
> implement the plan

[agent implements...]

Review mode (1/7)  ← status appears in footer

[agent reviews, finds bug, fixes it]

Review mode (2/7)

[agent reviews again]

"No issues found."

Review mode ended: no issues found  ← auto-exits
```

Agents make mistakes. They miss edge cases, introduce typos, forget error handling. Asking them to review their own code catches a surprising number of issues, but you have to remember to ask, and then ask again if they found something. This automates that:

**Auto-Trigger** - Detects phrases like "implement the plan" or the `/double-check` template. No need to manually activate.

**Persistent Loop** - After each response, sends a review prompt. If the agent found and fixed issues, it loops again. Only exits when the agent genuinely finds nothing.

**Smart Exit Detection** - Won't be fooled by "Fixed 3 issues. No further issues found." Detects when issues were fixed and keeps looping.

**Fully Configurable** - Every pattern is customizable. Change what triggers the loop, what exits it, and what prompt gets sent. Extend the defaults or replace them entirely.

## Typical Workflow

The loop shines in two scenarios:

**Before implementing** — You've got a plan doc and want to sanity-check it against the actual codebase. Run `/double-check-plan` and let the agent compare the plan to what exists. It'll catch things like outdated assumptions, conflicting patterns, or unnecessary complexity. The funny thing is, it rarely finds everything on the first pass. Second pass catches different issues. Third pass, more still. That's the whole point of the loop.

**After implementing** — You just finished building a feature and want to catch bugs before calling it done. Run `/double-check` and the agent reviews its own work with fresh eyes. Typos, missed edge cases, forgotten error handling — it finds stuff you'd miss staring at the same code. Again, multiple passes tend to surface different issues each time.

The pattern is the same: keep reviewing until there's genuinely nothing left to find. The loop handles the "ask again" part automatically. You'll see `Review mode (2/7)` in the footer so you know it's working and how many passes it's done.

## Install

**npm** (recommended):

```bash
npm install -g pi-review-loop
```

The extension is automatically copied to `~/.pi/agent/extensions/pi-review-loop/`.

**Or clone directly:**

```bash
git clone https://github.com/nicobailon/pi-review-loop ~/.pi/agent/extensions/pi-review-loop
```

Restart pi to load the extension. On activation, you'll see status in the footer:

```
Review mode (2/7)
```

## Prompt Templates

The package includes two prompt templates that are automatically installed to `~/.pi/agent/prompts/` (if they don't already exist):

| Template | Command | Description |
|----------|---------|-------------|
| `double-check.md` | `/double-check` | Review code with fresh eyes, fix any issues found |
| `double-check-plan.md` | `/double-check-plan` | Review implementation plan against codebase |

These prompts are designed to work with the review loop:
- They include the "fresh eyes" phrase that auto-triggers the loop
- They instruct the agent to respond with "No issues found." when done (triggering exit)
- They tell the agent to end with "Fixed [N] issue(s). Ready for another review." when issues are fixed (continuing the loop)

You can customize or replace these prompts, change trigger patterns, or use your own entirely. See [Configuration](#configuration). The agent can also start/stop the loop on demand via the `review_loop` tool. See [Tool API](#tool-api).

**Manual installation** (if cloning instead of npm):

```bash
cp ~/.pi/agent/extensions/pi-review-loop/prompts/*.md ~/.pi/agent/prompts/
```

## Quick Start

### Automatic Activation

Just use trigger phrases naturally:

```
> implement the plan
> implement the spec
> let's implement this plan
```

Or use the `/double-check` prompt template.

### Manual Activation

```
/review-start
```

Activates review mode and immediately sends the review prompt.

### Check Status

```
/review-status
```

Shows whether review mode is active and current iteration.

### Exit Early

```
/review-exit
```

Or just type something else. Any non-trigger input exits review mode.

### Adjust Iterations

```
/review-max 5
```

Changes max iterations for current session.

## Configuration

Configure in `~/.pi/agent/settings.json`. Works out of the box, but everything is customizable:

```json
{
  "reviewerLoop": {
    "maxIterations": 7,
    "reviewPrompt": "template:double-check",
    "triggerPatterns": {
      "mode": "extend",
      "patterns": ["execute the plan"]
    },
    "exitPatterns": {
      "mode": "extend",
      "patterns": ["ship it", "ready to merge"]
    },
    "issuesFixedPatterns": {
      "mode": "extend",
      "patterns": ["addressed the following"]
    }
  }
}
```

### Options

| Option | Description |
|--------|-------------|
| `maxIterations` | Max review prompts before auto-exit (default: 7) |
| `reviewPrompt` | The prompt to send each iteration |
| `triggerPatterns` | What activates review mode |
| `exitPatterns` | What indicates "review complete" |
| `issuesFixedPatterns` | What indicates issues were fixed (prevents false exits) |

### Review Prompt Sources

Three formats for `reviewPrompt`:

| Format | Example | Description |
|--------|---------|-------------|
| Template | `"template:double-check"` | Loads `~/.pi/agent/prompts/double-check.md` |
| File | `"~/prompts/review.md"` | Loads from any file path |
| Inline | `"Review the code carefully..."` | Uses text directly |

Templates and files reload on each use. Edit them and changes take effect immediately.

### Pattern Configuration

Each pattern setting accepts:

```json
{
  "mode": "extend",
  "patterns": ["simple string", "/regex\\s+pattern/i"]
}
```

**Modes:**
- `"extend"` (default, recommended) - Add your patterns to the built-in defaults
- `"replace"` - Use only your patterns, discard defaults entirely

**Pattern formats:**
- Simple string → auto-escaped, case-insensitive literal match
- `/pattern/flags` → full regex with custom flags

**Why extend mode is recommended:** The built-in defaults use sophisticated regex patterns to handle edge cases (e.g., distinguishing "No issues found" from "Issues found and fixed"). If you use replace mode, you take full responsibility for handling these nuances. Extend mode lets you add simple patterns like `"ship it"` while the defaults handle the tricky stuff.

## Default Patterns

These are the built-ins (all customizable):

**Triggers:**
- "implement plan/spec", "implement the plan/spec"
- "start implementing", "let's implement", "go ahead and implement"
- `/double-check` template content

**Exit phrases:**
- "no issues found", "no bugs found"
- "looks good", "all good" (on own line)

**Issues-fixed indicators:**
- "fixed the following", "issues fixed", "bugs fixed"
- "Issues:", "Bugs:", "Changes:" (headers)
- "ready for another review"

## Exit Conditions

The loop exits when:

1. **Exit phrase without fixes** - Agent says "no issues" and didn't fix anything
2. **Max iterations** - Safety limit reached (default: 7)
3. **User interrupts** - You type something that isn't a trigger
4. **Manual exit** - `/review-exit` command
5. **Abort** - Press ESC or agent response is empty

## Commands

| Command | Description |
|---------|-------------|
| `/review-start` | Activate and send review prompt immediately |
| `/review-exit` | Exit review mode |
| `/review-max <n>` | Set max iterations (session only) |
| `/review-status` | Show current state |

## Tool API

The `review_loop` tool lets the agent control review mode directly:

```typescript
// Check status (default)
review_loop({})

// Start review mode
review_loop({ start: true })

// Start with custom max iterations
review_loop({ start: true, maxIterations: 5 })

// Stop review mode
review_loop({ stop: true })

// Just update max iterations
review_loop({ maxIterations: 10 })
```

**Returns:**
```json
{
  "active": true,
  "currentIteration": 2,
  "maxIterations": 7,
  "message": "Review mode active: iteration 2/7"
}
```

**Mode priority:** `start` > `stop` > status (default)

## How It Works

```
input event
    ↓
matches trigger? → enter review mode
    ↓
agent responds
    ↓
agent_end event
    ↓
matches exit + no fixes? → exit review mode
    ↓
iteration < max? → send review prompt → loop
    ↓
otherwise → exit (max reached)
```

**Events used:**
- `session_start` - Reload settings
- `input` - Detect triggers, handle interrupts
- `before_agent_start` - Check expanded prompts for triggers
- `agent_end` - Analyze response, decide to loop or exit

## Limitations

- **User templates only** - `template:name` loads from `~/.pi/agent/prompts/`, not project templates
- **Session-scoped /review-max** - Doesn't persist across sessions
- **Pattern failures are silent** - Invalid regex patterns are skipped without error

## File Structure

```
pi-review-loop/
├── index.ts           # Extension entry, event handlers, commands
├── settings.ts        # Configuration loading, pattern parsing, defaults
├── scripts/
│   ├── install.js     # npm postinstall - copies extension + prompts
│   └── uninstall.js   # npm preuninstall - removes extension
├── prompts/
│   ├── double-check.md       # Review code template
│   └── double-check-plan.md  # Review plan template
├── package.json
├── review-loop.png    # Banner image
├── README.md
├── CHANGELOG.md
└── LICENSE
```

## Credits

- **[Ralph Wiggum Loop](https://ghuntley.com/ralph/)** by [@GeoffreyHuntley](https://x.com/GeoffreyHuntley)
- **["Fresh eyes" review prompt](https://x.com/doodlestein/status/1956228999945806049)** by [@doodlestein](https://x.com/doodlestein)
- **[pi](https://github.com/badlogic/pi-mono/)** by [@badlogicgames](https://x.com/badlogicgames)
