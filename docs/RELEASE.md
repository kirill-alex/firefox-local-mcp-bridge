# Release checklist

1. Update package.json, extension/manifest.json, serverInfo version and CHANGELOG.md together.
2. Run `npm ci --ignore-scripts` and `npm run check` on a clean checkout.
3. Confirm no runtime configuration is tracked: `git ls-files config.json extension/config.js .local` should be empty.
4. Review the Git diff and files staged for the public repository. The built-in checker is intentionally limited and is not proof of the absence of all sensitive data.
5. Run `npm run build` and inspect the unsigned extension ZIP. It must contain only extension files, with no per-install token.
6. Run `node scripts/package-source.mjs` after build. Generated config, dependencies, pairing data, .git and dist are excluded.
7. Install the archive temporarily in a test Firefox profile, configure a newly generated test token, and perform a smoke test. This is a separate manual step; CI uses mocks and jsdom.
8. Publish source to the intended GitHub repository and optionally attach unsigned artifacts to a release. Permanent normal-Firefox installation requires separate Mozilla signing; GitHub hosting does not replace it.

This repository has no automatic deployment/publishing workflow. The included CI only runs checks and builds locally inside its jobs.
