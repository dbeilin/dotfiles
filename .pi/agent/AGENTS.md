# Global Agent Instructions

## Subagent model routing

When delegating work through the `Agent` tool:

- Use `openai-codex/gpt-5.6-sol` with `thinking: high` for tasks that create or modify code, tests, migrations, configuration, build files, deployment artifacts, or other repository implementation files.
- Also use `openai-codex/gpt-5.6-sol` with `thinking: high` for debugging, correctness or security analysis, architecture decisions, and reviews likely to result in edits.
- Cheaper models may be used for read-only file discovery, grep/search, documentation lookup, routine research, extraction, and straightforward summarization.
- Use shell tasks rather than LLM agents for deterministic checks such as tests, linting, builds, compilation, and grep-based gates.
- Do not downgrade code-writing or implementation-critical work for cost or speed.
- When orchestrating Babysitter tasks, apply this policy to every pending agent effect and pass `model` and `thinking` explicitly in each `Agent` call.
