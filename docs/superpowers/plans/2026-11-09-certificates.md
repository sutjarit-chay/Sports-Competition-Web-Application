# Certificate Downloads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Issue and download approved athlete/coach certificates with replaceable Base64 backgrounds.
**Architecture:** Server-trusted recipient snapshots and private versioned JSON; embedded-font PDF/ZIP; public minimal QR verification; school-isolated access.
**Tech Stack:** Next.js, Supabase SDK, PDFKit, QRCode, JSZip, existing Sarabun fonts.
**Spec:** docs/superpowers/specs/2026-11-09-certificates-design.md

## Constraints and review focus
- No schema/RLS changes, keys committed, or E2E. No automatic issuance from uncompleted competitions.
- Scope all school downloads on server, deny referee/viewer mutations, validate images and positions, preserve original bytes.
- Freeze issued recipients/results/template; stale previews conflict; revoked QR invalid; reset should retain historical verification.

## Tasks
- [x] Define shared contracts and test trusted eligibility/athletics identity rules.
- [x] TDD PDF rendering, Base64 validation, font embedding and batch ZIP.
- [x] TDD authenticated issuance/template/download/verification endpoints and storage CAS.
- [x] Integrate admin/school document UI with preview, settings, feedback and batch downloads.
- [x] Run focused/full node tests, typecheck, production build, fresh review; publish main and check deployment.
