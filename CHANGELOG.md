# Changelog

## [0.1.0] - 2025-01-17

Initial release with full configuration support.

### Features

- **Automatic trigger detection**: Activates on "implement plan/spec" phrases and `/double-check` template
- **Smart review loop**: Continues until "No issues found" or max iterations
- **Issues-fixed detection**: Won't exit if agent fixed issues in the same response (prevents premature exit)
- **Multiple exit conditions**: Exit phrase, max iterations, user interrupt, ESC abort, manual command
- **Status indicator**: Shows current iteration in footer

### Commands

- `/review-start` - Manually activate and send review prompt
- `/review-exit` - Exit review mode
- `/review-max <n>` - Set max iterations
- `/review-status` - Show current status

### Configuration

Full customization via `settings.json`:

- `maxIterations` - Max review prompts (default: 7)
- `reviewPrompt` - Custom prompt (inline, file path, or template reference)
- `triggerPatterns` - Patterns to activate review mode (extend or replace defaults)
- `exitPatterns` - Patterns indicating "no issues" (extend or replace defaults)
- `issuesFixedPatterns` - Patterns indicating issues were fixed (extend or replace defaults)

### Review Prompt Sources

- **Inline text**: Direct string in settings
- **File path**: `~/path/to/prompt.md` or `/absolute/path.md`
- **Template reference**: `template:double-check` loads from `~/.pi/agent/prompts/`

Templates reload on each use for immediate updates.

### Pattern Formats

- **Simple strings**: `"no issues found"` → case-insensitive literal match
- **Regex strings**: `"/no\\s+issues/i"` → full regex with flags

### Robustness

- Validates patterns array and element types
- Handles invalid regex gracefully (skips, uses defaults)
- Falls back to defaults on file/template read errors
- Handles frontmatter stripping for templates
- Removes `$@` placeholder from templates
