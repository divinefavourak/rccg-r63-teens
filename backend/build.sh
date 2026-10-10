#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Phase 1 authorization: RBAC roles are seeded by identity migration 0003; bridge
# existing users into Membership/RoleAssignment so the new HasPermission checks
# work immediately (idempotent — safe to run every deploy).
python manage.py derive_hierarchy || echo "derive_hierarchy skipped (non-blocking)"

# Until 10 October 2026 the line above put back everyone who had been moved in
# the Console, and granted again every legacy role that had been revoked. This
# undoes that. It finds nothing once it has run, and can then be removed.
python manage.py repair_console_moves || echo "repair_console_moves skipped (non-blocking)"

# Test email configuration after deployment
echo ""
echo "=================================================="
echo "Testing email configuration after deployment..."
echo "=================================================="
python manage.py test_email_deploy --recipient="${TEST_EMAIL_RECIPIENT:-$DEFAULT_FROM_EMAIL}" 2>&1 || echo "Email test completed with issues (non-blocking)"
echo "=================================================="