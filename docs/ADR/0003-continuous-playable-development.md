# ADR-0003 — One continuously evolving Hearth

Date: 2026-10-27. Status: accepted by explicit owner policy.

The inspected saved source identifies application 0.0.12/schema11. It has one Rust host, one React/Pixi client and shared protocol/UI packages. There was no evidence of separately maintained development and playable products; `dev`, debug and optimized release configurations already compile the same source. The old release document's development-checkpoint wording and duplicated check lists made that distinction unclear.

Retain the architecture and all 179 roadmap IDs. Establish CONTINUOUS_DEVELOPMENT.md as permanent policy, referenced by AGENTS/master. Centralize validation in one cross-platform runner, use explicit host selection in every browser/recovery/capture fixture, reject version mismatch, stop on failed checks and remove inherited live campaign settings. CI uses the optimized-host validation path; it does not automatically promote or publish.

A policy/workflow revision is not a new gameplay release or a claim of playability. Keep application version 0.0.12. Existing player-rendering, full P0 encounter, real LAN/platform and portable-distribution gates remain open. Preserve old application/data pairs for rollback. Automatic rollback and universal database downgrades remain unimplemented.

Consequences: one place maintains the check sequence; release browser tests can exercise the intended optimized host rather than a hardcoded debug executable. Full release validation still requires the real toolchains, browsers, manual acceptance evidence and final-package smoke. An unverified checkpoint cannot replace a validated installation.
