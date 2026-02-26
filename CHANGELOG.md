# Changelog

## [Unreleased]

### Changed
- Removed npm lifecycle side-effects (`postinstall`/`preuninstall`) that copied files into `~/.pi/agent/`
- Prompt templates are now loaded from user prompts first (`~/.pi/agent/prompts/`), with fallback to bundled package prompts (`prompts/`)
- Added `pi.prompts` manifest entry so packaged prompt templates are exposed without local file copying

## [0.4.2] - 2026-02-02

### Fixed
- `/review-plan` used `double-check-plan.md` only on the first iteration; subsequent iterations fell back to the default `double-check.md` prompt because `agent_end` always read from `settings.reviewPromptConfig`
- Session state (review mode, iteration count, boundary tracking) not reset on `session_start`, causing stale review state to carry over between sessions
- Duplicated inline type for `ReviewPromptConfig` in index.ts; now imports the canonical interface from settings.ts

## [0.4.1] - 2026-02-01

### Fixed
- Adapt execute signature to pi v0.51.0: insert signal as 3rd parameter

## [0.4.0] - 2026-01-29

### Added

- **Fresh context mode**: Each review iteration gets a clean, unbiased view of the code. When enabled, prior review iterations are stripped from context and a pass note prompts the agent to re-read any relevant plan/spec/PRD documents. Enable with `/review-fresh on`, the `freshContext` tool parameter, or `freshContext: true` in settings.
- `freshContext` parameter in `review_loop` tool
- `/review-fresh [on|off]` command to toggle fresh context per-session
- `freshContext` setting for persistent configuration

### Changed

- Updated bundled `double-check.md` prompt: stronger review guidance ("question everything", "fight entropy"), explicit ultrathink instruction, anti-rubber-stamp push
- Updated bundled `double-check-plan.md` prompt: streamlined to focus on elegant implementation given architecture and goals
- Updated `DEFAULT_REVIEW_PROMPT` in settings.ts to match the new `double-check.md` content
- Revised response format in all prompts: agent must describe what it examined before concluding "No issues found" instead of giving a terse binary verdict, reducing premature loop exits

### Fixed

- **Off-by-one in max iterations**: `maxIterations: 7` produced 8 review passes instead of 7
- **0-indexed iteration display**: Status bar showed `(0/7)` for the first pass; now shows `(1/7)`
- **Stateful regex in user-configured patterns**: Patterns with the `g` flag caused `.test()` to alternate between true/false on successive calls; `g` flag is now stripped since it's meaningless for match detection
- README incorrectly claimed both prompt templates include the auto-trigger phrase; only `double-check.md` matches the trigger pattern

## [0.3.1] - 2026-01-28

### Changed

- Custom focus text no longer requires quotes - `/review-start focus on error handling` now works

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
