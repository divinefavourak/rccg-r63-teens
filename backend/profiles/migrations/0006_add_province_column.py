# backend/profiles/migrations/0006_add_province_column.py

from django.db import migrations

def add_province_column(apps, schema_editor):
    """
    Safely add the missing 'province' column to TeenProfile.
    """
    connection = schema_editor.connection
    
    # Configuration for the missing column
    table_name = 'profiles_teenprofile'
    column_name = 'province'
    # match existing max_length=50 from models.py
    # Adding DEFAULT '' to ensure it can apply to existing rows without error
    column_definition = "VARCHAR(50) DEFAULT '' NOT NULL" 
    
    with connection.cursor() as cursor:
        # Check if column exists first
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = %s 
            AND column_name = %s
        """, [table_name, column_name])
        
        if cursor.fetchone() is None:
            # Column doesn't exist, add it
            sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
            try:
                cursor.execute(sql)
                print(f"Successfully added missing column: {column_name}")
                
                # Optional: Create an index for it since models.py specifies db_index=True (via Meta indexes)
                # But typically Django handles indexes in separate operations. 
                # For raw SQL fix, the column existence is the priority.
            except Exception as e:
                print(f"Could not add column {column_name}: {e}")
        else:
            print(f"Column {column_name} already exists. Skipping.")

def reverse_migration(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        # Depend on your last migration
        ('profiles', '0005_add_all_missing_columns'),
    ]

    operations = [
        migrations.RunPython(add_province_column, reverse_migration),
    ]