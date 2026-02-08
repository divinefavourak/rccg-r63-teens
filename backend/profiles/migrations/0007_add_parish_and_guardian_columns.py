# backend/profiles/migrations/0007_add_parish_and_guardian_columns.py

from django.db import migrations

def add_missing_columns(apps, schema_editor):
    """
    Safely check for and add 'parish' and guardian-related columns if they are missing.
    """
    connection = schema_editor.connection
    table_name = 'profiles_teenprofile'
    
    # List of columns to ensure exist: (column_name, sql_definition)
    columns_to_check = [
        ('parish', "VARCHAR(255) DEFAULT '' NOT NULL"),
        ('guardian_name', "VARCHAR(255) DEFAULT '' NOT NULL"),
        ('guardian_phone', "VARCHAR(20) DEFAULT '' NOT NULL"),
        ('guardian_email', "VARCHAR(254) DEFAULT '' NOT NULL"),
        ('guardian_relationship', "VARCHAR(100) DEFAULT '' NOT NULL"),
    ]
    
    with connection.cursor() as cursor:
        for col_name, col_def in columns_to_check:
            # Check if column exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = %s 
                AND column_name = %s
            """, [table_name, col_name])
            
            if cursor.fetchone() is None:
                # Column doesn't exist, add it
                sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def}"
                try:
                    cursor.execute(sql)
                    print(f"Successfully added missing column: {col_name}")
                except Exception as e:
                    print(f"Could not add column {col_name}: {e}")
            else:
                print(f"Column '{col_name}' already exists. Skipping.")

def reverse_migration(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        # Depend on your last migration (add_province_column)
        ('profiles', '0006_add_province_column'),
    ]

    operations = [
        migrations.RunPython(add_missing_columns, reverse_migration),
    ]