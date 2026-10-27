# Continuous Development Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; keep test evidence and the owner policy authoritative.

**Goal:** Establish one evolving Hearth and a shared validation path without changing gameplay or database schema.

**Architecture:** Retain the Rust host/React browser workspace. Centralize the existing check sequence, select the same built host across every browser/recovery harness, and make promotion fail closed. Policy and manual gates remain separate from automated command success.

**Tech Stack:** Existing Node scripts, pnpm, Cargo, Playwright and project Markdown.

**Spec:** `docs/CONTINUOUS_DEVELOPMENT.md` and the owner's policy supplied in this conversation.

## Global constraints

One source/release line; no second product or architectural rewrite. Preserve all 179 feature IDs and migrations. No playable claim or promotion with failed/unperformed required checks. Real campaign roots never become test roots. No app version bump for this workflow-only change.

## Review focus

- Release browser tests must never silently fall back to a debug host.
- Every spawned browser/recovery/capture host must use the selected executable, including Windows suffix and custom Cargo target directories.
- Failed/spawn-error checks must stop validation and return nonzero.
- Inherited live data settings must not reach validation children.
- Policy must not imply existing rollback, portable distribution or playable acceptance is already verified.

## Task 1: Reconcile policy

- [x] Inspect the saved source and existing master/progress/matrix/release/storage workflow.
- [x] Add permanent policy and ADR; link AGENTS/master/README and preserve the complete roadmap.
- [x] Record actual status and a compatible application-plus-data recovery procedure.

## Task 2: Shared checks and host selection

Interfaces: `createVerificationPlan({root, env, platform, release, browserOnly})` produces ordered steps and sanitized environment; `runVerificationPlan(plan)` fails on the first unsuccessful child. `testHostExecutable({root,env,platform})` resolves an explicit selected host or the default debug host.
- [x] Write Node tests for fail-fast exit/spawn failure, live-data isolation, version mismatches and release-host selection. Observe failure before implementation.
- [x] Implement shared verifier and resolver; route package commands, shell wrappers, CI and existing browser hosts through them.
- [x] Run tooling tests, app TypeScript tests, typecheck/lint/inventory and inspect both validation plans. A full Rust/browser/release run must be reported blocked if prerequisites or prior regressions remain; never label it passed.

## Task 3: Record and persist

- [x] Update release validation, progress/overview/next tasks and known issues; record fresh results separately from prior app tests.
- [x] One fresh whole-change review and relevant final checks. Package this unchanged-version source checkpoint for guarded replacement of the existing saved source; this is not release promotion.
