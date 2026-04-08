#!/bin/sh
# =============================================================================
# Thena — Database Restore Script
# =============================================================================
# Downloads a backup from MinIO and restores it using pg_restore.
#
# Usage:
#   ./scripts/restore.sh <backup-filename>
#   ./scripts/restore.sh thena_20260407_020000.dump.gz
#
# If no filename is provided, lists available backups and exits.
#
# Required environment variables:
#   POSTGRES_HOST     — PostgreSQL hostname (default: postgres)
#   POSTGRES_PORT     — PostgreSQL port (default: 5432)
#   POSTGRES_DB       — Database name (default: thena)
#   POSTGRES_USER     — PostgreSQL username (default: thena)
#   PGPASSWORD        — PostgreSQL password (required — set in env, NOT here)
#   MINIO_ENDPOINT    — MinIO endpoint URL (e.g., http://minio:9000)
#   MINIO_ACCESS_KEY  — MinIO access key
#   MINIO_SECRET_KEY  — MinIO secret key
#   MINIO_BACKUP_BUCKET — MinIO bucket name (default: thena-backups)
# =============================================================================

set -e

# -----------------------------------------------------------------
# Configuration — read from env with sensible defaults
# -----------------------------------------------------------------
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-thena}"
POSTGRES_USER="${POSTGRES_USER:-thena}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:?ERROR: MINIO_ACCESS_KEY is required}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:?ERROR: MINIO_SECRET_KEY is required}"
MINIO_BACKUP_BUCKET="${MINIO_BACKUP_BUCKET:-thena-backups}"

BACKUP_FILENAME="$1"

# -----------------------------------------------------------------
# Validate required env
# -----------------------------------------------------------------
if [ -z "$PGPASSWORD" ]; then
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') PGPASSWORD environment variable is not set." >&2
    exit 1
fi

# -----------------------------------------------------------------
# Configure MinIO client
# -----------------------------------------------------------------
mc alias set thena-minio "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api s3v4 > /dev/null 2>&1

# -----------------------------------------------------------------
# If no filename provided, list available backups and exit
# -----------------------------------------------------------------
if [ -z "$BACKUP_FILENAME" ]; then
    echo "[INFO]  Available backups in bucket '${MINIO_BACKUP_BUCKET}':"
    echo ""
    mc ls "thena-minio/${MINIO_BACKUP_BUCKET}" 2>/dev/null | sort -r || \
        echo "[WARN]  No backups found or bucket does not exist."
    echo ""
    echo "Usage: $0 <backup-filename>"
    echo "Example: $0 thena_20260407_020000.dump.gz"
    exit 0
fi

echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Starting restore from backup: ${BACKUP_FILENAME}"
echo "[WARN]  This will DROP and recreate the '${POSTGRES_DB}' database. Press Ctrl+C within 5 seconds to cancel."
sleep 5

# -----------------------------------------------------------------
# Step 1: Download backup from MinIO
# -----------------------------------------------------------------
LOCAL_BACKUP_PATH="/tmp/${BACKUP_FILENAME}"

echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Downloading backup from MinIO..."

mc cp "thena-minio/${MINIO_BACKUP_BUCKET}/${BACKUP_FILENAME}" "$LOCAL_BACKUP_PATH"

if [ $? -ne 0 ]; then
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') Download from MinIO failed." >&2
    exit 1
fi

BACKUP_SIZE=$(du -sh "$LOCAL_BACKUP_PATH" | cut -f1)
echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Downloaded: ${LOCAL_BACKUP_PATH} (${BACKUP_SIZE})"

# -----------------------------------------------------------------
# Step 2: Drop and recreate the target database
# -----------------------------------------------------------------
echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Dropping existing database '${POSTGRES_DB}'..."

psql \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname=postgres \
    --no-password \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" \
    > /dev/null 2>&1

psql \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname=postgres \
    --no-password \
    -c "DROP DATABASE IF EXISTS \"${POSTGRES_DB}\";" \
    > /dev/null 2>&1

psql \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname=postgres \
    --no-password \
    -c "CREATE DATABASE \"${POSTGRES_DB}\";" \
    > /dev/null 2>&1

echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Database recreated."

# -----------------------------------------------------------------
# Step 3: Decompress and restore
# pg_restore -j 4 uses 4 parallel workers for faster restore
# -----------------------------------------------------------------
echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Restoring database from backup..."

gunzip -c "$LOCAL_BACKUP_PATH" | pg_restore \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --no-password \
    --jobs=4 \
    --no-owner \
    --no-privileges \
    --verbose

if [ $? -ne 0 ]; then
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') pg_restore failed." >&2
    rm -f "$LOCAL_BACKUP_PATH"
    exit 1
fi

# -----------------------------------------------------------------
# Step 4: Clean up local temp file
# -----------------------------------------------------------------
rm -f "$LOCAL_BACKUP_PATH"
echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Local temp file removed."

echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Restore completed successfully."
exit 0
