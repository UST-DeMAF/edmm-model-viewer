#!/bin/sh

# Substitute environment variables in nginx config
envsubst '${DEMAF_ANALYSIS_MANAGER_URL}' < /etc/nginx/nginx.template.conf > /etc/nginx/nginx.conf

# Start Express server in background
node server/server.js &

# Start nginx in foreground
nginx -g "daemon off;"
