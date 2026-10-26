<?php

/**
 * RHU II Patient Queuing System - Environment & Setup Diagnostic Tool
 * Run via CLI: php check_setup.php
 * Or via browser: http://localhost:8081/check_setup.php (or :8000)
 */

$isCli = (php_sapi_name() === 'cli');

function renderLine(string $title, bool $ok, string $detail = ''): void {
    global $isCli;
    $statusText = $ok ? 'PASS' : 'FAIL';
    $symbol = $ok ? '✓' : '✗';
    if ($isCli) {
        $color = $ok ? "\033[0;32m" : "\033[0;31m";
        $reset = "\033[0m";
        echo "{$color}[{$statusText}]{$reset} {$symbol} {$title}";
        if ($detail !== '') {
            echo " ({$detail})";
        }
        echo "\n";
    } else {
        $color = $ok ? '#10b981' : '#ef4444';
        $bg = $ok ? '#ecfdf5' : '#fef2f2';
        echo "<div style='display:flex; justify-content:space-between; padding:8px 12px; margin:4px 0; background:{$bg}; border-left:4px solid {$color}; font-family:sans-serif;'>";
        echo "<span><strong>{$symbol} {$title}</strong></span>";
        echo "<span style='color:{$color}; font-weight:bold;'>{$statusText} " . htmlspecialchars($detail) . "</span>";
        echo "</div>";
    }
}

if (!$isCli) {
    echo "<!DOCTYPE html><html><head><title>RHU II Queuing System - Diagnostics</title></head><body style='max-width:800px; margin:20px auto; padding:0 20px; font-family:sans-serif;'>";
    echo "<h1>RHU II Queuing System - Setup Diagnostics</h1>";
} else {
    echo "\n=======================================================\n";
    echo " RHU II Patient Queuing System - Setup Diagnostics\n";
    echo "=======================================================\n\n";
}

// 1. PHP Version
$phpVersion = phpversion();
renderLine("PHP Version", version_compare($phpVersion, '8.0.0', '>='), $phpVersion);

// 2. Required Extensions
$requiredExts = ['pdo', 'pdo_pgsql', 'json', 'session'];
foreach ($requiredExts as $ext) {
    $loaded = extension_loaded($ext);
    renderLine("PHP Extension: {$ext}", $loaded, $loaded ? 'installed' : 'missing');
}

// 3. Configuration & Environment Files
$envPath = __DIR__ . '/.env';
$envExamplePath = __DIR__ . '/.env.example';
$configPath = __DIR__ . '/backend/config.php';
$dbClassPath = __DIR__ . '/backend/Database.php';

renderLine(".env file exists", file_exists($envPath), $envPath);
renderLine(".env.example template exists", file_exists($envExamplePath), $envExamplePath);
renderLine("backend/config.php exists", file_exists($configPath), $configPath);
renderLine("backend/Database.php exists", file_exists($dbClassPath), $dbClassPath);

// 4. Uploads Directory
$uploadsDir = __DIR__ . '/public/uploads/prescriptions';
if (!is_dir($uploadsDir)) {
    @mkdir($uploadsDir, 0777, true);
}
$uploadsWritable = is_dir($uploadsDir) && is_writable($uploadsDir);
renderLine("Prescriptions Upload Directory Writable", $uploadsWritable, $uploadsDir);

// 5. Database Connection
if (file_exists($configPath) && file_exists($dbClassPath)) {
    require_once $configPath;
    require_once $dbClassPath;

    try {
        $db = Database::getInstance()->getConnection();
        renderLine("PostgreSQL Connection", true, "Connected successfully");

        // Check tables
        $tables = [
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

        foreach ($tables as $t) {
            $hasTable = in_array($t, $existingTables, true);
            renderLine("Table: {$t}", $hasTable, $hasTable ? 'present' : 'run migrations');
        }

        // Check accounts
        $stmt = $db->query("SELECT username, role, is_active FROM users");
        $users = $stmt->fetchAll();
        $userCount = count($users);
        renderLine("User Accounts Configured", $userCount > 0, "{$userCount} accounts found");

    } catch (Exception $e) {
        renderLine("PostgreSQL Connection", false, $e->getMessage());
    }
}

if (!$isCli) {
    echo "</body></html>";
}
