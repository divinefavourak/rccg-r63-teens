from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("payments", "0003_payment_registration_checkout"),
    ]

    operations = [
        migrations.RenameField(
            model_name="payment",
            old_name="paystack_reference",
            new_name="gateway_reference",
        ),
        migrations.RenameField(
            model_name="payment",
            old_name="paystack_response",
            new_name="gateway_response",
        ),
        migrations.RemoveField(
            model_name="payment",
            name="access_code",
        ),
    ]
