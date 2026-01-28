# Changelog

## [Unreleased]

## [0.3.0] - 2026-01-28

### Added

- `/review-plan` command to activate review loop with `double-check-plan` template for reviewing plans/specs/PRDs
- Custom focus support: append instructions to review prompts with quoted text
  - `/review-start "focus on error handling"`
  - `/review-plan "check for security issues"`
  - `/review-auto "focus on performance"`
- `focus` parameter in `review_loop` tool for programmatic custom focus

## [0.2.1] - 2026-01-26

### Changed
- Added `pi` manifest to package.json for pi v0.50.0 package system compliance
- Added `pi-package` keyword for npm discoverability

## [0.2.0] - 2026-01-21

### Changed

- **Breaking**: Auto-trigger from keywords is now disabled by default. Use `/review-auto on` or set `autoTrigger: true` in settings.json to enable.
- README updated to reflect `/review-start` as the primary workflow

### Added

- `autoTrigger` setting in `reviewerLoop` config (default: false)
- `/review-auto [on|off]` command to toggle auto-trigger for current session
- `autoTrigger` parameter in `review_loop` tool for programmatic control
- `autoTrigger` field in tool response JSON

## [0.1.1] - 2026-01-20

### Added

- `review_loop` tool for programmatic control by the agent (start, stop, status, configure)
- Bundled prompt templates (`/double-check`, `/double-check-plan`) auto-installed to `~/.pi/agent/prompts/`
- npm package with automatic installation to `~/.pi/agent/extensions/`
- Banner image (Ralph Wiggum inspired)
- Credits section in README
- MIT License

### Fixed

- Exit detection bug: "No issues found" was not triggering exit because the issues-fixed pattern `/issues?\s+(i\s+)?(found|identified|discovered)/i` matched "issues found" within the phrase. Added negative lookbehind `(?<!no\s)` to prevent this false positive.

### Changed

- README rewritten with improved structure, install instructions, and pattern configuration guidance

## [0.1.0] - 2026-01-20

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
