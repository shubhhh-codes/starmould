# Node and PostgreSQL tooling run outside the Next.js request lifecycle.
ARG POSTGRES_MAJOR=17
FROM node:24-bookworm-slim AS node
FROM postgres:${POSTGRES_MAJOR}-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
WORKDIR /app
COPY automation/db-backup-service/package.json ./package.json
COPY automation/db-backup-service/package-lock.json ./package-lock.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY scripts/backup ./scripts/backup
COPY automation/db-backup-service/service.cjs ./automation/db-backup-service/service.cjs
COPY supabase/migrations/20261117120000_database_backup_jobs.sql ./supabase/migrations/20261117120000_database_backup_jobs.sql
RUN node scripts/backup/certificates.cjs /app/database-ca.crt
ENV BACKUP_DATABASE_CA_FILE=/app/database-ca.crt
ENV BACKUP_PGSSLROOTCERT=/app/database-ca.crt
USER postgres
EXPOSE 8080
ENTRYPOINT ["node", "automation/db-backup-service/service.cjs"]
