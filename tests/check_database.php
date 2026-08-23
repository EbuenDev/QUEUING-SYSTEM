<?php
// Quick database check script
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Database Status Check</h1>";

try {
    // Try to connect to PostgreSQL first
    $dsn = 'pgsql:host=localhost;port=5432;dbname=postgres';
    $pdo = new PDO($dsn, 'postgres', 'HQtff031001m', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    
    echo "<p style='color: green;'>✓ Connected to PostgreSQL server</p>";
    
    // Check if database exists
    $stmt = $pdo->prepare("SELECT datname FROM pg_database WHERE datname = 'rhu_queue_system'");
    $stmt->execute();
    $exists = $stmt->fetch();
    
    if ($exists) {
        echo "<p style='color: green;'>✓ Database 'rhu_queue_system' exists</p>";
        
        // Connect to the database
        $dsn = 'pgsql:host=localhost;port=5432;dbname=rhu_queue_system';
        $pdo = new PDO($dsn, 'postgres', 'HQtff031001m', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        
        echo "<p style='color: green;'>✓ Connected to 'rhu_queue_system' database</p>";
        
        // Check tables
        $tables = ['patients', 'consultation_history', 'queue_management'];
        foreach ($tables as $table) {
            $stmt = $pdo->prepare("SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = :table
            )");
            $stmt->execute([':table' => $table]);
            $tableExists = $stmt->fetchColumn();
            
            if ($tableExists) {
                echo "<p style='color: green;'>✓ Table '$table' exists</p>";
            } else {
                echo "<p style='color: red;'>✗ Table '$table' does not exist</p>";
            }
        }
    } else {
        echo "<p style='color: red;'>✗ Database 'rhu_queue_system' does not exist</p>";
        echo "<p>Creating database...</p>";
        
        $pdo->exec("CREATE DATABASE rhu_queue_system");
        echo "<p style='color: green;'>✓ Database 'rhu_queue_system' created</p>";
        
        // Now connect to the new database and run schema
        $dsn = 'pgsql:host=localhost;port=5432;dbname=rhu_queue_system';
        $pdo = new PDO($dsn, 'postgres', 'HQtff031001m', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        
        echo "<p style='color: green;'>✓ Connected to new database</p>";
        echo "<p>Please run the schema.sql file to create tables</p>";
    }
    
} catch (PDOException $e) {
    echo "<h2 style='color: red;'>Database Error</h2>";
    echo "<p style='color: red;'>Error: " . htmlspecialchars($e->getMessage()) . "</p>";
}
?>