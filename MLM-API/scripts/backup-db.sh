#!/bin/bash

# Database Backup Script for MLM Project
# Usage: ./scripts/backup-db.sh

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE_CUSTOM="mlm_backup_${TIMESTAMP}.dump"
BACKUP_FILE_SQL="mlm_backup_${TIMESTAMP}.sql"

# Create backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting database backup..."
echo ""

# Check if database container is running
if ! docker ps | grep -q mlm-db-1; then
    echo "❌ Error: Database container (mlm-db-1) is not running!"
    echo "   Please start the database first: docker-compose up -d db"
    exit 1
fi

# Create custom format backup (compressed, faster restore)
echo "📦 Creating custom format backup..."
docker exec mlm-db-1 pg_dump -U postgres -d mlm \
    --format=custom \
    --file="/tmp/$BACKUP_FILE_CUSTOM"

# Copy custom backup to host
docker cp "mlm-db-1:/tmp/$BACKUP_FILE_CUSTOM" "$BACKUP_DIR/"
docker exec mlm-db-1 rm "/tmp/$BACKUP_FILE_CUSTOM"

# Create SQL format backup (readable, portable)
echo "📄 Creating SQL format backup..."
docker exec mlm-db-1 pg_dump -U postgres -d mlm \
    --format=plain \
    --file="/tmp/$BACKUP_FILE_SQL"

# Copy SQL backup to host
docker cp "mlm-db-1:/tmp/$BACKUP_FILE_SQL" "$BACKUP_DIR/"
docker exec mlm-db-1 rm "/tmp/$BACKUP_FILE_SQL"

# Display backup summary
echo ""
echo "✅ Backup completed successfully!"
echo ""
echo "📊 Backup Summary:"
echo "  📁 Location: $BACKUP_DIR/"
echo "  📦 Custom Format: $BACKUP_FILE_CUSTOM"
echo "  📄 SQL Format: $BACKUP_FILE_SQL"
echo ""
ls -lh "$BACKUP_DIR/$BACKUP_FILE_CUSTOM" "$BACKUP_DIR/$BACKUP_FILE_SQL"
echo ""
echo "💡 To restore backup:"
echo "   docker exec -i mlm-db-1 pg_restore -U postgres -d mlm --clean --if-exists < $BACKUP_DIR/$BACKUP_FILE_CUSTOM"
echo "   OR"
echo "   docker exec -i mlm-db-1 psql -U postgres -d mlm < $BACKUP_DIR/$BACKUP_FILE_SQL"

