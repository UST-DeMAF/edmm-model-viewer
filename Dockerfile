FROM node:20-alpine AS build-stage

WORKDIR /app
RUN corepack enable

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production stage - nginx + Express server
FROM node:20-alpine AS production-stage

# Install nginx and gettext for envsubst
RUN apk upgrade --update-cache \
    && apk add --no-cache curl gettext nginx

WORKDIR /app

# Copy built frontend
COPY --from=build-stage /app/dist ./dist

# Copy server files
COPY --from=build-stage /app/server ./server
COPY --from=build-stage /app/node_modules ./node_modules

# Copy nginx config and entrypoint
COPY nginx.template.conf /etc/nginx/nginx.template.conf
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# Create directories for uploads and TADMs
RUN mkdir -p /usr/share/uploads /usr/share/tadms

# Environment variables
ENV PORT=3000
ENV UPLOADS_DIR=/usr/share/uploads
ENV TADMS_DIR=/usr/share/tadms
ENV NODE_ENV=production
ENV DEMAF_ANALYSIS_MANAGER_URL=analysismanager:8080

EXPOSE 80

CMD ["./entrypoint.sh"]
