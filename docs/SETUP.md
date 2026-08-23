# PostgreSQL Database Setup Guide

This guide will help you set up PostgreSQL for the RHU II Patient Queuing System.

## Prerequisites

- PostgreSQL installed on your system
- PHP with PostgreSQL PDO extension enabled
- Administrative access to create databases

## Installation Steps

### 1. Install PostgreSQL

#### Windows:
- Download and install PostgreSQL from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
- During installation, set a password for the default `postgres` user
- Make sure to install the pgAdmin tool for easier database management

#### macOS:
```bash
brew install postgresql
brew services start postgresql
```

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Enable PHP PostgreSQL Extension

#### Windows:
1. Find your `php.ini` file (usually in `C:\php\` or your Laragon/XAMPP installation)
2. Uncomment this line:
   ```ini
   extension=pdo_pgsql
   ```
3. Restart your web server

#### Linux:
```bash
sudo apt install php-pgsql
sudo systemctl restart apache2  # or your web server
```

#### macOS:
```bash
brew install php
# Ensure pdo_pgsql is enabled in php.ini
```

### 3. Create the Database

#### Using pgAdmin (GUI):
1. Open pgAdmin and connect to your PostgreSQL server
2. Right-click on "Databases" and select "Create > Database"
3. Name it `rhu_queue_system`
4. Click "Save"

#### Using Command Line:
```bash
# Connect to PostgreSQL
psql -U postgres

# Create the database
CREATE DATABASE rhu_queue_system;

# Exit
\q
```

### 4. Run the Database Schema

#### Using pgAdmin:
1. Open pgAdmin and connect to your database
2. Click on the "Query Tool" icon (or right-click database > Query Tool)
3. Open the file `backend/database/schema.sql`
4. Copy and paste the contents into the Query Tool
5. Click the "Execute" button (lightning bolt icon)

#### Using Command Line:
```bash
psql -U postgres -d rhu_queue_system -f backend/database/schema.sql
```

### 5. Configure Database Connection

Edit the file `backend/database/config.php` to match your PostgreSQL setup:

```php
return [
    'db_host' => 'localhost',      // Your PostgreSQL server address
    'db_port' => '5432',           // PostgreSQL default port
    'db_name' => 'rhu_queue_system', // Database name we created
    'db_user' => 'postgres',       // Your PostgreSQL username
    'db_password' => 'your_password', // Your PostgreSQL password
    // ... rest of configuration
];
```

#### Using Environment Variables (Recommended):
Instead of editing the file directly, you can set environment variables:

**Windows (Command Prompt):**
```cmd
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=rhu_queue_system
set DB_USER=postgres
set DB_PASSWORD=your_password
```

**Windows (PowerShell):**
```powershell
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:DB_NAME="rhu_queue_system"
$env:DB_USER="postgres"
$env:DB_PASSWORD="your_password"
```

**Linux/macOS:**
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=rhu_queue_system
export DB_USER=postgres
export DB_PASSWORD=your_password
```

### 6. Test the Connection

You can test if your database connection works by creating a simple test file:

Create `test_db.php` in your project root:
```php
<?php
require_once 'backend/database/Database.php';

try {
    $db = Database::getInstance()->getConnection();
    echo "Database connection successful!";
    
    // Test a simple query
    $stmt = $db->query("SELECT COUNT(*) FROM patients");
    $count = $stmt->fetchColumn();
    echo "Current patients in database: " . $count;
    
} catch (Exception $e) {
    echo "Database connection failed: " . $e->getMessage();
}
```

Run this file in your browser: `http://localhost/QUEUING-SYSTEM/test_db.php`

### 7. Update Frontend Configuration

The application has been updated to use the new PostgreSQL API (`api_postgres.php`). If you want to switch back to the JSON-based system, you can change the API endpoints in `app.js`:
- Change `backend/api_postgres.php` back to `backend/api.php`

## Database Schema Overview

The database consists of three main tables:

### `patients` Table
- Stores current patient queue information
- Includes patient details, queue numbers, and status
- Tracks patient classification (Regular, Senior, PWD, Emergency)
- Records PhilHealth status

### `consultation_history` Table
- Stores completed consultation records
- Includes ICD codes and consultation details
- Maintains historical data for reporting

### `queue_management` Table
- Tracks the next available queue number
- Ensures sequential queue numbering

## Troubleshooting

### "Connection failed" Error
- Verify PostgreSQL is running
- Check your credentials in `config.php`
- Ensure the database name is correct
- Make sure the PHP PostgreSQL extension is enabled

### "Table does not exist" Error
- Run the schema.sql file again
- Check for any error messages during schema creation
- Verify you're connected to the correct database

### Permission Issues
- Ensure your database user has proper permissions:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE rhu_queue_system TO postgres;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
  ```

### PHP Extension Issues
- Check if pdo_pgsql is enabled: `php -m | grep pdo`
- Verify your php.ini location: `php --ini`
- Restart your web server after changes

## Data Migration from JSON

If you have existing data in `backend/queue.json` and want to migrate it to PostgreSQL:

1. The current setup preserves your existing JSON file
2. The new PostgreSQL system runs in parallel with the JSON system
3. Both systems use the same API structure, so switching is seamless
4. To migrate data manually, you would need to create a migration script

## Backup and Maintenance

### Backup the Database
```bash
pg_dump -U postgres rhu_queue_system > backup.sql
```

### Restore from Backup
```bash
psql -U postgres rhu_queue_system < backup.sql
```

### Regular Maintenance
- Set up automated backups
- Monitor database size
- Consider archiving old consultation history periodically

## Security Notes

- Change the default PostgreSQL password
- Use environment variables for sensitive credentials
- Restrict database user permissions in production
- Enable SSL for database connections in production
- Regular security updates for PostgreSQL

## Next Steps

After setup:
1. Test the application by adding a patient
2. Verify queue management functions work
3. Check consultation history recording
4. Test all user roles (Admin, Doctor, BHW)
5. Remove the test file when everything works

## Support

If you encounter issues:
1. Check PostgreSQL logs: `C:\Program Files\PostgreSQL\{version}\data\log\`
2. Check PHP error logs
3. Verify all prerequisites are met
4. Test database connection with pgAdmin