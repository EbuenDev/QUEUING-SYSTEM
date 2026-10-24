<?php
// Migration script to add users table
require_once __DIR__ . '/backend/Database.php';

try {
    $db = Database::getInstance()->getConnection();

    // Read and execute migration
    $migrationSql = file_get_contents(__DIR__ . '/backend/migration_users.sql');

    if ($migrationSql === false) {
        echo "Error: Could not read migration file\n";
        exit(1);
    }

    // Execute migration
    $db->exec($migrationSql);

    echo "Migration completed successfully!\n";
    echo "Users table has been created with default users.\n";
    echo "Default admin: admin / admin123\n";
    echo "Default superadmin: superadmin / superadmin123\n";
    echo "Default doctor: renz / renzsale\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
