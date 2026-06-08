#!/bin/bash

# Local Database Backup Script for MLM Project
# Usage: ./scripts/backup-local-db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/../production-db-backup/local"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE_SQL="local-backup-${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 BACKING UP LOCAL DATABASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if database container is running
if ! docker ps | grep -q mlm-api-v2-db-1; then
    echo "❌ Error: Database container (mlm-api-v2-db-1) is not running!"
    echo "   Please start the database first: cd MLM-API && docker-compose up -d db"
    exit 1
fi

echo "✅ Database container is running"
echo ""

# Create SQL format backup (readable, portable)
echo "📄 Creating SQL format backup..."
docker exec mlm-api-v2-db-1 pg_dump -U postgres -d mlm \
    --no-owner \
    --no-acl \
    --format=plain \
    --file="/tmp/$BACKUP_FILE_SQL"

# Copy SQL backup to host
docker cp "mlm-api-v2-db-1:/tmp/$BACKUP_FILE_SQL" "$BACKUP_DIR/"
docker exec mlm-api-v2-db-1 rm "/tmp/$BACKUP_FILE_SQL"

# Check if backup file was created and has content
if [ ! -f "$BACKUP_DIR/$BACKUP_FILE_SQL" ]; then
    echo "❌ Backup file was not created"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE_SQL" | cut -f1)
BACKUP_LINES=$(wc -l < "$BACKUP_DIR/$BACKUP_FILE_SQL" | tr -d ' ')

if [ "$BACKUP_LINES" -lt 100 ]; then
    echo "⚠️  Warning: Backup file seems too small ($BACKUP_LINES lines)"
    echo "   Please verify the backup manually"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted by user"
        exit 1
    fi
else
    echo "✅ Database backup completed successfully"
fi

# Display backup summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Backup Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📁 Location: $BACKUP_DIR/$BACKUP_FILE_SQL"
echo "  📦 Size: $BACKUP_SIZE"
echo "  📄 Lines: $BACKUP_LINES"
echo ""
ls -lh "$BACKUP_DIR/$BACKUP_FILE_SQL"
echo ""
echo "💡 To restore backup:"
echo "   docker exec -i mlm-api-v2-db-1 psql -U postgres -d mlm < $BACKUP_DIR/$BACKUP_FILE_SQL"
echo ""
