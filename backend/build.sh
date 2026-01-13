#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate

# Test email configuration after deployment (optional - won't fail build)
echo "Testing email configuration..."
python manage.py test_email_deploy --quiet || echo "Email test skipped or failed (non-blocking)"