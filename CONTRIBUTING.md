# Contributing

Use Node.js 24+, install dev dependencies with `npm ci --ignore-scripts`, and run `npm run check` before submitting a change.

- Add tests for behavior changes, especially protocol lifecycle, authorization checks and fallbacks.
- Keep browser results explicit: distinguish dispatched events from observed effects, native input from DOM fallback, and confirmed focus from unknown outcome.
- Do not commit local configuration, pairing files, profile data, real quiz sessions or screenshots with personal information.
- Use synthetic test pages and generated credentials. Automated CI must not control an existing personal Firefox session.
- Changes to supported commands, scopes or permissions must be reflected in documentation.
- Do not vendor third-party extension bundles or access their credentials. SyncShare integration reads its existing page UI and remains experimental.

The project is independent and does not guarantee full feature parity with Chrome automation.
