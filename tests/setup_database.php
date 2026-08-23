<?php
// Database setup script - creates tables if they don't exist
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Database Setup</h1>";

try {
    // Connect to PostgreSQL
    $dsn = 'pgsql:host=localhost;port=5432;dbname=rhu_queue_system';
    $pdo = new PDO($dsn, 'postgres', 'HQtff031001m', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    
    echo "<p style='color: green;'>✓ Connected to database</p>";
    
    // Read and execute schema
    $schema = file_get_contents('../backend/schema.sql');
    
    // Split schema into individual statements
    $statements = explode(';', $schema);
    
    foreach ($statements as $statement) {
        $statement = trim($statement);
        if (!empty($statement) && !str_starts_with($statement, '--')) {
            try {
                $pdo->exec($statement);
                echo "<p style='color: green;'>✓ Executed: " . substr($statement, 0, 50) . "...</p>";
            } catch (PDOException $e) {
                // Ignore errors for existing objects
                if (strpos($e->getMessage(), 'already exists') === false) {
                    echo "<p style='color: orange;'>⚠ " . htmlspecialchars($e->getMessage()) . "</p>";
                }
            }
        }
    }
    
    echo "<h2 style='color: green;'>Database Setup Complete!</h2>";
    echo "<p>Your database is now ready for the queuing system.</p>";
    
} catch (PDOException $e) {
    echo "<h2 style='color: red;'>Database Error</h2>";
    echo "<p style='color: red;'>Error: " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<p>Make sure PostgreSQL is running and the database 'rhu_queue_system' exists.</p>";
}
?>