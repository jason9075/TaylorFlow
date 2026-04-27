# Repository Guidelines

## Project Structure & Module Organization
`index.html` is the application shell and includes the UI layout, inline styles, and CDN-loaded browser dependencies. Core behavior lives in [src/main.js](/home/jason9075/data/TaylorFlow/src/main.js), which handles canvas rendering, Taylor-series math, and UI events. Tooling is intentionally light: `Justfile` defines local commands, and `flake.nix` provides the development shell. There is no dedicated `tests/` or `assets/` directory yet; add new modules under `src/` and keep browser-only assets near `index.html` until the project grows enough to justify a split.

## Build, Test, and Development Commands
Use Nix if available to get a consistent shell:

- `nix develop` installs `live-server` and `just` from the flake.
- `just dev` starts the local server on `http://127.0.0.1:8080`.
- `just refresh` touches `index.html` to force a reload during development.
- `just check` verifies that the expected local tools are available.

This project is a static site, so there is no separate build step at the moment.

## Coding Style & Naming Conventions
Follow the existing style in `src/main.js`: 2-space indentation is not used here; preserve the current 2-4 space alignment pattern and favor readable `const` declarations, small helper functions, and plain browser APIs. Use `camelCase` for variables and functions, `UPPER_SNAKE_CASE` for constant lookup tables such as `FUNCS`, and kebab-case for DOM ids like `x-eval-label`. Keep comments brief and sectional, matching the current divider style.

## Testing Guidelines
There is no automated test suite yet. For changes, run `just dev` and manually verify the main flows: function switching, order controls, slider updates, canvas interaction, and modal behavior. If you add non-trivial logic, factor it into small pure functions in `src/main.js` so it is easier to cover with future tests.

## Commit & Pull Request Guidelines
The current history uses Conventional Commit-style subjects, for example `feat: basic page`. Continue with prefixes like `feat:`, `fix:`, and `chore:` followed by a short imperative summary. Pull requests should explain the user-visible change, note manual verification steps, and include screenshots or short clips for UI changes.
