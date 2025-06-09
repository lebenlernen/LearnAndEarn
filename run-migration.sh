#!/bin/bash

# Database connection details
DB_HOST="localhost"
DB_PORT="3143"
DB_NAME="jetzt"
DB_USER="odoo"

echo "Running database migration to add user profile fields..."
echo "This will add country, mother_language, and timezone columns to our_users table."
echo ""
echo "Please enter the database password for user 'odoo':"

# Run the migration
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/add-user-profile-fields.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "Migration completed successfully!"
    echo "You can now uncomment the profile update endpoint in routes/auth.js"
else
    echo ""
    echo "Migration failed. Please check the error messages above."
fi 