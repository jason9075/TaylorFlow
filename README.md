# TaylorFlow

TaylorFlow is an interactive Taylor series visualizer for the browser. It lets you compare a function with its Taylor polynomial, move the expansion center, inspect numerical error, and study the Lagrange remainder bound in real time.

## Live Page

https://jason9075.github.io/TaylorFlow/

## Features

- Visualize `e^x`, `sin x`, `cos x`, and `ln(1+x)`
- Drag the orange point to move the expansion center `a`
- Change Taylor order up to 12
- Snap the evaluation point to the expansion center
- Inspect absolute error, relative error, and Lagrange bound
- Open the built-in Knowledge panel for math explanations

## Local Development

If you use Nix:

```bash
nix develop
just dev
```

Without Nix, install `live-server` and `just`, then run:

```bash
just dev
```

The app will start on `http://127.0.0.1:8080`.

## Project Structure

- `index.html`: app shell, layout, styles, and CDN imports
- `src/main.js`: rendering, math logic, interaction, and UI updates
- `Justfile`: local development commands
- `flake.nix`: Nix dev shell

## License

MIT. See [LICENSE](./LICENSE).
