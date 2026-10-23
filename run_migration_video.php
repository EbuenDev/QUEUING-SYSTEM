<?php
// Migration runner for video configuration
// This script applies the video_config migration to existing databases

require_once __DIR__ . '/backend/config.php';
require_once __DIR__ . '/backend/Database.php';

$config = require __DIR__ . '/backend/config.php';

try {
    $db = new Database(
        $config['db_host'],
        $config['db_name'],
        $config['db_user'],
        $config['db_password']
    );
    $pdo = $db->getConnection();

    echo "Applying video configuration migration...\n";

    // Read migration file
    $migrationSql = file_get_contents(__DIR__ . '/backend/migration_video_config.sql');

    // Split by semicolon and execute each statement
    $statements = array_filter(array_map('trim', explode(';', $migrationSql)));

    foreach ($statements as $statement) {
        if (!empty($statement) && !preg_match('/^--/', $statement)) {
            try {
                $pdo->exec($statement);
                echo "✓ Executed: " . substr($statement, 0, 50) . "...\n";
            } catch (PDOException $e) {
                // Ignore duplicate errors (object already exists)
                if (strpos($e->getMessage(), 'already exists') === false) {
                    echo "✗ Error: " . $e->getMessage() . "\n";
                }
            }
        }
    }

    echo "\n✓ Video configuration migration completed successfully!\n";
} catch (Exception $e) {
    echo "✗ Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
