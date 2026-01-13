#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Test email configuration after deployment
echo ""
echo "=================================================="
echo "Testing email configuration after deployment..."
echo "=================================================="
python manage.py test_email_deploy --recipient="${TEST_EMAIL_RECIPIENT:-$DEFAULT_FROM_EMAIL}" 2>&1 || echo "Email test completed with issues (non-blocking)"
echo "=================================================="