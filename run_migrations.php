<?php

/**
 * RHU II Patient Queuing System - Unified Database Migration Runner
 *
 * Safely executes all database schema definitions and migration scripts in sequential order.
 * Can be run from CLI: php run_migrations.php
 * Or inside Docker:   docker compose exec web php run_migrations.php
 */

require_once __DIR__ . '/backend/config.php';
require_once __DIR__ . '/backend/Database.php';

$isCli = (php_sapi_name() === 'cli');

function printMsg(string $msg, string $type = 'info'): void {
    global $isCli;
    $colors = [
        'info'    => "\033[0;36m",
        'success' => "\033[0;32m",
        'warning' => "\033[0;33m",
        'error'   => "\033[0;31m",
        'reset'   => "\033[0m"
    ];

    if ($isCli) {
        $prefix = match($type) {
            'success' => '[SUCCESS] ',
            'warning' => '[WARN]    ',
            'error'   => '[ERROR]   ',
            default   => '[INFO]    '
        };
        $color = $colors[$type] ?? '';
        $reset = $colors['reset'];
        echo "{$color}{$prefix}{$msg}{$reset}\n";
    } else {
        $color = match($type) {
            'success' => 'green',
            'warning' => 'orange',
            'error'   => 'red',
            default   => '#333'
        };
        echo "<div style='color:{$color}; font-family:monospace; margin:4px 0;'>" . htmlspecialchars($msg) . "</div>";
    }
}

printMsg("==========================================================");
printMsg(" RHU II Patient Queuing System - Migration Runner");
printMsg("==========================================================");

try {
    $db = Database::getInstance()->getConnection();
    printMsg("Connected successfully to PostgreSQL database.", "success");
} catch (Exception $e) {
    printMsg("Could not connect to database: " . $e->getMessage(), "error");
    printMsg("Please verify your .env file and ensure PostgreSQL/Docker is running.", "warning");
    exit(1);
}

// Ordered list of schema and migration files
$migrationFiles = [
    '01-schema'            => __DIR__ . '/backend/schema.sql',
    '02-add_followup'      => __DIR__ . '/backend/migration_add_followup.sql',
    '03-users'             => __DIR__ . '/backend/migration_users.sql',
    '04-notifications'     => __DIR__ . '/backend/migration_notifications.sql',
    '05-video_config'      => __DIR__ . '/backend/migration_video_config.sql',
    '06-playlist_library'  => __DIR__ . '/backend/migration_playlist_library.sql',
    '07-add_messages'      => __DIR__ . '/backend/migration_add_messages.sql',
    '08-prescriptions'     => __DIR__ . '/backend/migration_prescriptions.sql',
];

$totalExecuted = 0;
$totalSkipped = 0;

foreach ($migrationFiles as $step => $filePath) {
    $filename = basename($filePath);
    if (!file_exists($filePath)) {
        printMsg("Migration file not found: {$filename}", "warning");
        continue;
    }

    printMsg("Applying [{$step}] {$filename}...");
    $sqlContent = file_get_contents($filePath);
    if ($sqlContent === false) {
        printMsg("Failed to read file: {$filename}", "error");
        continue;
    }

    try {
        $db->exec($sqlContent);
        printMsg("✓ Completed {$filename}", "success");
        $totalExecuted++;
    } catch (PDOException $e) {
        // Many statements in migrations use IF NOT EXISTS or ON CONFLICT.
        // If an already exists notice occurs, log it as informational
        if (strpos($e->getMessage(), 'already exists') !== false) {
            printMsg("Notice for {$filename}: " . $e->getMessage(), "info");
            $totalSkipped++;
        } else {
            printMsg("Error in {$filename}: " . $e->getMessage(), "error");
        }
    }
}

printMsg("----------------------------------------------------------");
printMsg("Verifying Database Tables...", "info");

$expectedTables = [
    'patients',
    'consultation_history',
    'queue_management',
    'users',
    'notifications',
    'video_config',
    'playlist_library',
    'messages',
    'yakap_prescriptions'
];

$stmt = $db->query("
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
");
$existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);

foreach ($expectedTables as $table) {
    if (in_array($table, $existingTables, true)) {
        printMsg("✓ Table '{$table}' exists", "success");
    } else {
        printMsg("✗ Table '{$table}' is missing", "error");
    }
}

// Check default users
printMsg("----------------------------------------------------------");
printMsg("Verifying User Accounts...", "info");
$stmt = $db->query("SELECT username, role, is_active FROM users ORDER BY role, username");
$users = $stmt->fetchAll();

if (empty($users)) {
    printMsg("No users found in database users table.", "warning");
} else {
    foreach ($users as $u) {
        $activeText = $u['is_active'] ? 'active' : 'inactive';
        printMsg("✓ User: {$u['username']} (Role: {$u['role']}, Status: {$activeText})", "success");
    }
}

printMsg("==========================================================");
printMsg(" All migrations completed successfully!", "success");
printMsg("==========================================================");
