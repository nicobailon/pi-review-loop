# Reviewer Loop Extension

Automatically runs a review loop after implementation tasks. When triggered, the extension repeatedly prompts the agent to review its work until the response matches an exit condition or the iteration limit is reached.

Everything is fully configurable: trigger patterns, exit patterns, issues-fixed patterns, the review prompt itself, and iteration limits.

## How It Works

1. **Trigger detection**: Activates when input matches any trigger pattern
2. **Review loop**: After the agent responds, sends a configurable review prompt
3. **Smart exit**: Continues looping until response matches an exit pattern without also matching an issues-fixed pattern
4. **Safety limit**: Exits after max iterations reached

## Commands

| Command | Description |
|---------|-------------|
| `/review-start` | Manually activate review loop and send prompt immediately |
| `/review-exit` | Exit review mode |
| `/review-max <n>` | Set max iterations for current session |
| `/review-status` | Show current review mode status |

## Configuration

All behavior is configurable via `~/.pi/agent/settings.json`. Works out of the box with sensible defaults, but you can customize or replace any part.

```json
{
  "reviewerLoop": {
    "maxIterations": 7,
    "reviewPrompt": "template:double-check",
    "triggerPatterns": {
      "mode": "extend",
      "patterns": ["my custom trigger"]
    },
    "exitPatterns": {
      "mode": "extend", 
      "patterns": ["mission accomplished"]
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
| `reviewPrompt` | The prompt to send - inline text, file path, or template reference |
| `triggerPatterns` | Patterns that activate review mode |
| `exitPatterns` | Patterns indicating review is complete (e.g., "no issues found") |
| `issuesFixedPatterns` | Patterns indicating issues were fixed (prevents premature exit) |

### Review Prompt

The prompt sent during the review loop. Three formats supported:

| Format | Example | Description |
|--------|---------|-------------|
| Template | `"template:double-check"` | Loads from `~/.pi/agent/prompts/double-check.md` |
| File | `"~/my-prompt.md"` | Loads from any file path |
| Inline | `"Review the code..."` | Uses text directly |

Templates and files reload on each use - edits take effect immediately.

### Pattern Configuration

Each pattern setting accepts:

```json
{
  "mode": "extend",
  "patterns": ["simple string", "/regex\\s+pattern/i"]
}
```

**Modes:**
- `"extend"` (default) - Add your patterns to the built-in defaults
- `"replace"` - Use only your patterns, ignore defaults entirely

**Pattern formats:**
- Simple string: `"no issues found"` → case-insensitive literal match
- Regex string: `"/no\\s+issues/i"` → full regex with custom flags

## Default Patterns

These are the built-in defaults (all can be extended or replaced):

**Trigger patterns:**
- "implement plan/spec", "implement the plan/spec", "implement this plan/spec"
- "start implementing", "let's implement", "go ahead and implement" (with plan/spec)
- "read over all of the new code...fresh eyes" (matches `/double-check` template)

**Exit patterns:**
- "no issues found", "no bugs found" (with optional words between)
- "looks good", "all good" (on own line)

**Issues-fixed patterns:**
- "issues fixed", "fixed the following", "bugs fixed"
- "issues found", "problems found", "changes made"
- "Issues:", "Bugs:", "Changes:", "Fixes:" (headers)
- "ready for another review"

## Other Exit Conditions

Beyond pattern matching, the loop also exits when:
- Max iterations reached
- User types something else (interrupts)
- User presses ESC (aborts)
- `/review-exit` command

## Status Indicator

When active, shows in footer: `Review mode (2/7)`

## Files

- `index.ts` - Extension entry point
- `settings.ts` - Settings loading, parsing, and defaults
