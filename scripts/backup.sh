#!/bin/sh
# =============================================================================
# Thena — Database Backup Script
# =============================================================================
# Performs pg_dump, gzips the result, uploads to MinIO 'backups' bucket,
# and deletes backups older than 30 days.
#
# Usage (manual):
#   ./scripts/backup.sh
#
# Usage (via Docker cron — see docker-compose.prod.yml):
#   Runs automatically via backup-cron service at 02:00 UTC daily
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
#   BACKUP_RETENTION_DAYS — How many days to keep backups (default: 30)
# =============================================================================

set -e  # Exit immediately on error

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
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# PGPASSWORD must be set in the environment (not hardcoded here)
if [ -z "$PGPASSWORD" ]; then
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') PGPASSWORD environment variable is not set." >&2
    exit 1
fi

# -----------------------------------------------------------------
# Timestamp and filename
# -----------------------------------------------------------------
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILENAME="${POSTGRES_DB}_${TIMESTAMP}.dump.gz"
LOCAL_BACKUP_PATH="/tmp/${BACKUP_FILENAME}"

echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Starting backup of database '${POSTGRES_DB}' on ${POSTGRES_HOST}:${POSTGRES_PORT}"

# -----------------------------------------------------------------
# Step 1: pg_dump in custom format, piped directly to gzip
# Custom format (-Fc) is smaller than plain SQL and supports
# parallel restore via pg_restore -j
# -----------------------------------------------------------------
echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Running pg_dump..."

pg_dump \
    --host="$POSTGRES_HOST" \
    --port="$POSTGRES_PORT" \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB" \
    --format=custom \
    --no-password \
    --compress=0 \
    | gzip -9 > "$LOCAL_BACKUP_PATH"

if [ $? -ne 0 ]; then
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') pg_dump failed." >&2
    rm -f "$LOCAL_BACKUP_PATH"
    exit 1
fi

BACKUP_SIZE=$(du -sh "$LOCAL_BACKUP_PATH" | cut -f1)
echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Backup created: ${LOCAL_BACKUP_PATH} (${BACKUP_SIZE})"

# -----------------------------------------------------------------
# Step 2: Configure MinIO client (mc) and upload
# -----------------------------------------------------------------
echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Configuring MinIO client..."

mc alias set thena-minio "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" --api s3v4 > /dev/null 2>&1

# Create bucket if it doesn't exist
mc mb --ignore-existing "thena-minio/${MINIO_BACKUP_BUCKET}" > /dev/null 2>&1

echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Uploading backup to MinIO bucket '${MINIO_BACKUP_BUCKET}'..."

mc cp "$LOCAL_BACKUP_PATH" "thena-minio/${MINIO_BACKUP_BUCKET}/${BACKUP_FILENAME}"

if [ $? -ne 0 ]; then
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') Upload to MinIO failed." >&2
    rm -f "$LOCAL_BACKUP_PATH"
    exit 1
fi

echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Upload successful: s3://${MINIO_BACKUP_BUCKET}/${BACKUP_FILENAME}"

# -----------------------------------------------------------------
# Step 3: Clean up local temp file
# -----------------------------------------------------------------
rm -f "$LOCAL_BACKUP_PATH"
echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Local temp file removed."

# -----------------------------------------------------------------
# Step 4: Retention policy — delete backups older than N days
# -----------------------------------------------------------------
echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Applying retention policy (keep last ${BACKUP_RETENTION_DAYS} days)..."

# Calculate cutoff date in seconds since epoch
CUTOFF_EPOCH=$(date -d "-${BACKUP_RETENTION_DAYS} days" '+%s' 2>/dev/null || \
               date -v "-${BACKUP_RETENTION_DAYS}d" '+%s' 2>/dev/null)

if [ -z "$CUTOFF_EPOCH" ]; then
    echo "[WARN]  $(date '+%Y-%m-%d %H:%M:%S') Could not compute cutoff date — skipping retention cleanup."
else
    # List all backup files and filter by last-modified date
    DELETED_COUNT=0
    mc ls "thena-minio/${MINIO_BACKUP_BUCKET}" 2>/dev/null | while read -r LINE; do
        # mc ls output format: [YYYY-MM-DD HH:MM:SS UTC] <size> <filename>
        FILE_DATE=$(echo "$LINE" | awk '{print $1}')
        FILE_TIME=$(echo "$LINE" | awk '{print $2}')
        FILE_NAME=$(echo "$LINE" | awk '{print $NF}')

        # Convert file date to epoch
        FILE_EPOCH=$(date -d "${FILE_DATE} ${FILE_TIME}" '+%s' 2>/dev/null || \
                     date -j -f "%Y-%m-%d %H:%M:%S" "${FILE_DATE} ${FILE_TIME}" '+%s' 2>/dev/null)

        if [ -n "$FILE_EPOCH" ] && [ "$FILE_EPOCH" -lt "$CUTOFF_EPOCH" ]; then
            mc rm "thena-minio/${MINIO_BACKUP_BUCKET}/${FILE_NAME}" > /dev/null 2>&1 && \
            echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Deleted old backup: ${FILE_NAME}"
        fi
    done
fi

echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') Backup completed successfully."
exit 0
