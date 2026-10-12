<?php
// Migration script to add messages table
require_once __DIR__ . '/Database.php';

try {
    $db = Database::getInstance()->getConnection();

    // Read and execute migration
    $migrationSql = file_get_contents(__DIR__ . '/migration_add_messages.sql');

    if ($migrationSql === false) {
        echo "Error: Could not read migration file\n";
        exit(1);
    }

    // Execute migration
    $db->exec($migrationSql);

    echo "Migration completed successfully!\n";
    echo "Messages table has been created.\n";
} catch (Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
