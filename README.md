# Card stack

A stack of cards you swap, drag, flip and fan out, built with React, Vite, Tailwind CSS and Framer Motion. The cards hold five pieces of my own work; the point is the interaction, not what is on them.

## Setup

1. Install Node.js 20+ and npm 10+.
2. Install dependencies:

```bash
npm install
```

3. Start the local dev server:

```bash
npm run dev
```

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Preview production build: `npm run preview`

## Deployment

This project is a Vite static app. Production output is generated into `dist/`, so it can be deployed to static hosts like Vercel, Netlify, Cloudflare Pages, or GitHub Pages.

- Standard root-host deployment: `npm run build`
- Local production preview: `npm run preview -- --host 127.0.0.1 --port 4173`
- Optional subpath hosting: set `VITE_BASE_PATH` before building

Example PowerShell build for a subpath:

```powershell
$env:VITE_BASE_PATH='/card-stack/'
npm run build
```

## Environment Variables

No runtime secrets are required.

- Optional: `VITE_BASE_PATH`
- Purpose: sets the Vite base path for subpath deployments
- Example defaults are documented in [.env.example](./.env.example)

## Testing / Smoke Check

Before pushing or deploying, run:

```bash
npm run lint
npm run typecheck
npm run build
```

Quick manual smoke check:

- Open the app locally with `npm run dev`
- Confirm the stack starts clustered
- Confirm the active card toggles the layout with double-click, `Enter`, and `Space`
- Confirm the active CTA toggles the layout on touch/click
- Confirm inactive cards only promote in spread mode
- Under 640 px wide, confirm the front card follows the finger and a drag or flick past about a third of its width turns it away
- Under 640 px wide, confirm a drag let go early snaps back, and that the card can be caught on its way
- Under 640 px wide, confirm tapping either side of the front card, or a neighbour, brings that card forward
- Under 640 px wide, with reduced motion on, confirm the cards swap with no turn
- Confirm the production preview works with `npm run preview`
