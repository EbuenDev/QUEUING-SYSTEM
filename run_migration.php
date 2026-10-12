<?php
// Manual migration runner for notification table
// Run this file to create the notifications table
// For Docker use: docker-compose exec web php run_migration.php

require_once __DIR__ . '/backend/Database.php';
require_once __DIR__ . '/backend/config.php';

$config = require __DIR__ . '/backend/config.php';

try {
    $db = Database::getInstance()->getConnection();
    
    // Read and execute migration
    $migrationSql = file_get_contents(__DIR__ . '/backend/migration_notifications.sql');
    
    if ($migrationSql === false) {
        die("Error: Could not read migration file\n");
    }
    
    // Execute migration
    $result = $db->exec($migrationSql);
    
    echo "Migration executed successfully!\n";
    echo "Notifications table has been created.\n";
    
} catch (Exception $e) {
    echo "Error executing migration: " . $e->getMessage() . "\n";
    echo "If using Docker, run: docker-compose exec web php run_migration.php\n";
    exit(1);
}
