#!/usr/bin/env bash
# Apply all migrations to a throwaway database and run the RLS tests.
# Needs a Postgres superuser connection: set PGHOST/PGPORT/PGUSER/PGPASSWORD.
set -euo pipefail
cd "$(dirname "$0")/.."

DB="adsai_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

PSQL=(psql -v ON_ERROR_STOP=1 -q -X -d "$DB")
"${PSQL[@]}" -f supabase/tests/auth_stub.sql
"${PSQL[@]}" -f supabase/tests/grants.sql
for f in supabase/migrations/*.sql; do
  echo "applying $f"
  "${PSQL[@]}" -f "$f"
done
for t in supabase/tests/*_test.sql; do
  echo "running $t"
  "${PSQL[@]}" -o /dev/null -f "$t"
done
