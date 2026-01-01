# DeMAF Web UI Server

Express backend for file uploads and TADM management.

## Endpoints

| Method | Endpoint                          | Description                           |
| ------ | --------------------------------- | ------------------------------------- |
| GET    | `/health`                         | Health check                          |
| POST   | `/upload?sessionId=<id>`          | Upload single file                    |
| POST   | `/upload-multiple?sessionId=<id>` | Upload multiple files                 |
| POST   | `/move-to-tadms`                  | Move uploaded file to TADMs directory |
| POST   | `/tadms/exists`                   | Check if TADM file exists             |
| GET    | `/tadms/:fileName`                | Download TADM file                    |
| DELETE | `/uploads/:sessionId`             | Clean up session uploads              |

## Environment Variables

| Variable      | Default (Dev)   | Default (Prod)       | Description                       |
| ------------- | --------------- | -------------------- | --------------------------------- |
| `PORT`        | `3000`          | `3000`               | Server port                       |
| `UPLOADS_DIR` | `.data/uploads` | `/usr/share/uploads` | Directory for uploaded files      |
| `TADMS_DIR`   | `.data/tadms`   | `/usr/share/tadms`   | Directory for TADM files          |
| `NODE_ENV`    | -               | `production`         | Set to `production` for prod mode |

## Development

```bash
# Run server only
pnpm server:dev

# Run frontend + server together
pnpm dev:full
```

## Production

```bash
# Build frontend first
pnpm build

# Start server (serves both API and static files)
NODE_ENV=production pnpm server:start
```

## Docker

The Dockerfile builds both the frontend and sets up the Express server:

```bash
docker build -t edmm-model-viewer .
docker run -p 3000:3000 -v uploads:/usr/share/uploads -v tadms:/usr/share/tadms edmm-model-viewer
```
