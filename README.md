# EDMM Model Viewer

Vue 3 app for loading, transforming, and exploring EDMM deployment models as an interactive graph with integration for the DeMAF

This repo has two main parts:

- `src/`: the frontend UI, graph rendering, parsing, and client-side state.
- `server/`: a lightweight Express server used in development and production for uploads and TADM file access.

## Repo Structure

Most contributors only need to know these areas:

- `src/pages/index.vue`: main entry page and view switching between welcome, local model loading, demo mode, and transformation flow.
- `src/components/EdmmGraph.vue`: the main graph UI built on Vue Flow. This is where rendering and most graph behavior come together.
- `src/stores/graph.ts`: central Pinia store for the loaded model, visibility filters, colors, shapes, and graph-specific state.
- `src/lib/graph-layout.ts`: converts an EDMM model into positioned nodes and edges.
- `src/lib/graph-highlighting.ts`: traversal and highlighting logic for successors, predecessors, neighbours, and shortest-path mode.
- `src/lib/io.ts`: YAML parsing and Zod validation for incoming EDMM models.
- `src/services/transformation-service.ts`: client-side API layer for uploads, transformation requests, polling, and TADM access.
- `server/server.js`: local backend for uploads and TADM file management.

## Local Setup

Requirements:

- `pnpm` 10+
- Node.js 20+ is recommended

Install and start:

```bash
pnpm install
pnpm dev
```

Useful variants:

- `pnpm dev:test-yaml`: starts the app with the dev test-YAML flow enabled so you skip the model selection which is useful when developing.
- `pnpm server:dev`: runs only the Express server.
- `pnpm build`: production build.
- `pnpm lint`: ESLint.
- `pnpm typecheck`: TypeScript checks.

## Docker

This repo also ships with a production Docker image in the repo root. The container serves the built frontend via nginx and runs the Express backend for uploads and TADM access.

Build the image:

```bash
docker build -t edmm-model-viewer .
```

Run it locally:

```bash
docker run --rm -p 3000:80 \
  -v edmm-uploads:/usr/share/uploads \
  -v edmm-tadms:/usr/share/tadms \
  edmm-model-viewer
```

## Environment Notes

Frontend defaults are set up for local development and usually work without extra config:

- `VITE_ANALYSIS_MANAGER_URL` defaults to `/analysismanager`
- `VITE_TADMS_URL` defaults to `/tadms`
- `VITE_UPLOAD_URL` defaults to `/upload`

The Vite dev server proxies:

- `/analysismanager` to `http://localhost:8080`
- upload/TADM routes to the local Express server on `http://localhost:3000`

Server-side variables:

- `PORT` defaults to `3000`
- `UPLOADS_DIR` defaults to `.data/uploads` in development
- `TADMS_DIR` defaults to `.data/tadms` in development
