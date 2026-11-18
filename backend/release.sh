#!/usr/bin/env bash
# Run once after each deploy on the VPS, before the new containers serve
# traffic:
#
#   docker compose -f deploy/docker-compose.yml run --rm web ./release.sh
#
# The same steps as build.sh, without installing packages or collecting static
# files: the image already did both. build.sh stays for Render until Render is
# switched off.
set -o errexit

python manage.py migrate --no-input

python manage.py derive_hierarchy || echo "derive_hierarchy skipped (non-blocking)"
python manage.py repair_console_moves || echo "repair_console_moves skipped (non-blocking)"
python manage.py backfill_memory_verses || echo "backfill_memory_verses skipped (non-blocking)"

echo ""
echo "=================================================="
echo "Testing email configuration after deployment..."
echo "=================================================="
python manage.py test_email_deploy --recipient="${TEST_EMAIL_RECIPIENT:-$DEFAULT_FROM_EMAIL}" 2>&1 || echo "Email test completed with issues (non-blocking)"
echo "=================================================="
