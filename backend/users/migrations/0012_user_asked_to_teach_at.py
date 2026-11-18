"""Adults who said "I teach" at sign-up, until a coordinator answers (identity/teach_requests.py)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_remove_user_users_user_usernam_65d164_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='asked_to_teach_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
