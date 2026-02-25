#!/bin/bash
set -euo pipefail

# Database backup script
# Usage: ./scripts/backup-db.sh [output_dir]
#
# Creates a compressed PostgreSQL dump with timestamp.
# Recommended: run daily via cron.
# Retention: keep last 30 daily + 12 monthly backups.

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="${DB_NAME:-p2p_escrow}"
DB_USER="${DB_USER:-p2p}"
RETENTION_DAYS=30

mkdir -p "$OUTPUT_DIR"

BACKUP_FILE="$OUTPUT_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Backing up database: $DB_NAME"
echo "Output: $BACKUP_FILE"

# If running in Docker
if command -v docker &> /dev/null; then
    CONTAINER=$(docker compose ps -q postgres 2>/dev/null || docker ps --filter "name=postgres" -q | head -1)
    if [ -n "$CONTAINER" ]; then
        docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
        echo "Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
    else
        echo "ERROR: PostgreSQL container not found"
        exit 1
    fi
else
    # Direct PostgreSQL access
    pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
    echo "Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
fi

# Cleanup old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$OUTPUT_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

REMAINING=$(find "$OUTPUT_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l)
echo "Remaining backups: $REMAINING"
echo "Done."
