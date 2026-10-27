# ADR-0001 · Local authoritative foundation

Date: 2026-10-22. Status: accepted for the server/browser foundation; desktop-shell assumptions are permanently superseded by ADR-0002.

Use Rust 1.99.1, Axum 0.8.9, SQLx 0.9, SQLite WAL and React/TypeScript/Vite/Pixi. Exact resolved dependency versions are in Cargo.lock and pnpm-lock.yaml; use frozen/locked install/build commands. Initial environment had Node 24.19.0 and pnpm 11.25.0, but no Rust. The official rustup toolchain was installed for actual compilation/testing.

A Node replacement would lower initial setup effort but undermine the chosen host architecture. A managed cloud Site would undermine local data ownership and cannot substitute for this Rust service. The initial desktop-shell proposal is cancelled by the user; keep the existing headless server/browser boundary and do not build a desktop wrapper.

Canonical exact origins and private-interface opt-in make local/LAN startup explicit. No TLS termination/proxy trust/public listener is supported yet. Use SQLx literal statements and bound parameters; SQLx 0.9 rejects unchecked dynamic SQL. Storage is separate from binaries and migration startup is protected by a process-wide data-root lock.

Official implementation references checked during this session: [Axum Router](https://docs.rs/axum/0.8.9/axum/struct.Router.html), [SQLx SQLite connect options](https://docs.rs/sqlx/0.9.0/sqlx/sqlite/struct.SqliteConnectOptions.html), [Tauri sidecars](https://v2.tauri.app/develop/sidecar/). No competitor internals were copied.
