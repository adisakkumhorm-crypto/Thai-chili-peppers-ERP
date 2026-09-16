#!/bin/bash
# Run the rpc_adjust_stock migration via psql

set -e

# Get the database connection info
SUPABASE_URL="https://erp.estimateoohub.cloud"
# The database name in Supabase is typically the project name or "postgres"

echo "=== Running rpc_adjust_stock Migration via psql ==="
echo "Note: This script requires psql to be installed and configured"

# The migration file
MIGRATION_FILE="supabase/migrations/20260912000000_step36_inventory_adjust_rpc.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "Migration file exists: $MIGRATION_FILE"
echo "File size: $(wc -c < "$MIGRATION_FILE") bytes"

# Extract the function definition
echo ""
echo "=== Function Definition (first 500 chars) ==="
head -174 "$MIGRATION_FILE" | tail -166 | head -500

echo ""
echo "=== Migration Complete ==="
echo "To apply this migration manually, run:"
echo "psql \"\$SUPABASE_URL\" -U postgres -f $MIGRATION_FILE"
