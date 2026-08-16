# Evidera Repository Guide

## Product principles

- Every finding must separate observation, evidence, inference, impact, recommendation, and verification.
- Never present external observations as Search Console, Analytics, or ad-account facts.
- Deterministic checks create issues; AI may explain or prioritize them but must not invent them.
- Store analyzer version, execution time, device, locale, and source with every measurement.
- Security checks are passive by default. Do not add exploit, brute-force, or intrusive scanning behavior.

## Interface principles

- Use an Apple/iOS-inspired visual language: quiet surfaces, strong hierarchy, generous whitespace, subtle depth, and direct manipulation.
- Keep the interface functional and data-dense without looking crowded.
- Use system fonts and avoid decorative gradients, excessive pills, or gratuitous animation.
- Every state needs accessible focus, hover, empty, loading, error, and reduced-motion behavior.
- Responsive layouts must remain useful at 390 px, 768 px, and desktop widths.

## Engineering conventions

- TypeScript strict mode is required.
- Shared API contracts belong in `packages/contracts`.
- Web features belong in `apps/web`; crawler and API behavior belongs in `apps/api`.
- Prefer small, composable modules and semantic names over generic utility files.
- Validate all external URLs and guard against SSRF before network access.
- Use `npm` for this repository.
- Run `npm run typecheck`, `npm test`, and `npm run build` before handoff.
