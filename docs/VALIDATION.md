# Validation of the prepared public source

- Environment: Windows, Node.js 24.21.0.
- `npm run check`: passed; 20 automated tests passed.
- Coverage includes broker authentication/origin checks, stdio MCP, private/unloaded tab filtering, DOM actions and stale refs, BiDi input cleanup/pause/fallback, closed Shadow DOM traversal, SyncShare site restrictions, per-install token setup, extension options, and ZIP structure/CRC32.
- Public-source check passed. Actual local token and personal-path checks are also performed on the delivery archives during preparation.
- The extension archive is unsigned. It is not a Mozilla-approved store release.
- Fresh manual installation of the cleaned extension/settings flow in Firefox remains a release smoke-test step. The existing local runtime was not replaced during preparation.
- The original local prototype previously passed live Firefox checks for native input/canvas, file attachment, monitoring, screenshots and hidden-page scrolling. That does not replace validation on other users' profiles or platforms.
- CI is configured for Windows and Linux but has not yet run on GitHub. No remote repository is configured or published by this preparation.
