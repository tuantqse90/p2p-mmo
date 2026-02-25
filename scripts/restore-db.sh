#!/bin/bash
set -euo pipefail

# Database restore script
# Usage: ./scripts/restore-db.sh <backup_file>
#
# CAUTION: This will DROP and recreate the database!

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/*.sql.gz 2>/dev/null || echo "  (none found in ./backups/)"
    exit 1
fi

BACKUP_FILE="$1"
DB_NAME="${DB_NAME:-p2p_escrow}"
DB_USER="${DB_USER:-p2p}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: File not found: $BACKUP_FILE"
    exit 1
fi

echo "============================================"
echo "  DATABASE RESTORE"
echo "  Backup: $BACKUP_FILE"
echo "  Database: $DB_NAME"
echo "============================================"
echo ""
echo "WARNING: This will DROP and recreate '$DB_NAME'!"

read -p "Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# If running in Docker
if command -v docker &> /dev/null; then
    CONTAINER=$(docker compose ps -q postgres 2>/dev/null || docker ps --filter "name=postgres" -q | head -1)
    if [ -n "$CONTAINER" ]; then
        echo "Dropping and recreating database..."
        docker exec "$CONTAINER" psql -U "$DB_USER" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" postgres 2>/dev/null || true
        docker exec "$CONTAINER" dropdb -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
        docker exec "$CONTAINER" createdb -U "$DB_USER" "$DB_NAME"

        echo "Restoring from backup..."
        gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" "$DB_NAME"
    else
        echo "ERROR: PostgreSQL container not found"
        exit 1
    fi
else
    echo "Dropping and recreating database..."
    psql -U "$DB_USER" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" postgres 2>/dev/null || true
    dropdb -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
    createdb -U "$DB_USER" "$DB_NAME"

    echo "Restoring from backup..."
    gunzip -c "$BACKUP_FILE" | psql -U "$DB_USER" "$DB_NAME"
fi

echo ""
echo "Restore complete!"
echo "Remember to restart backend and celery services."
