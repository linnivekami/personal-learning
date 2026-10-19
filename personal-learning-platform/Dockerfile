# Runtime image for Fly.io. `npm run build` produces dist/node/server.mjs, a
# single bundle that already contains the client and all dependencies, so the
# image holds only Node, that file and the SQL migrations.
FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    MIGRATIONS_DIR=/app/migrations
COPY dist/node ./dist/node
COPY migrations ./migrations
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/node/server.mjs"]
