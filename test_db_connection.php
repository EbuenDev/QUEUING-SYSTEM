<?php
// Test PostgreSQL database connection with detailed diagnostics
header('Content-Type: application/json');

// Load environment variables
$envFile = __DIR__ . '/.env';
$config = [
    'db_host' => 'localhost',
    'db_port' => '5432',
    'db_name' => 'rhu_queue_system',
    'db_user' => 'postgres',
    'db_password' => '',
];

if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            if ($name === 'DB_HOST') $config['db_host'] = $value;
            if ($name === 'DB_PORT') $config['db_port'] = $value;
            if ($name === 'DB_NAME') $config['db_name'] = $value;
            if ($name === 'DB_USER') $config['db_user'] = $value;
            if ($name === 'DB_PASSWORD') $config['db_password'] = $value;
        }
    }
}

$dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', $config['db_host'], $config['db_port'], $config['db_name']);

try {
    $pdo = new PDO($dsn, $config['db_user'], $config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    
    // Test a simple query
    $stmt = $pdo->query("SELECT COUNT(*) FROM patients");
    $count = $stmt->fetchColumn();
    
    echo json_encode([
        'success' => true,
        'message' => 'Database connection successful!',
        'config' => [
            'host' => $config['db_host'],
            'port' => $config['db_port'],
            'database' => $config['db_name'],
            'user' => $config['db_user'],
            'password_set' => !empty($config['db_password']),
        ],
        'database_info' => [
            'connected' => true,
            'patient_count' => $count
        ]
    ]);
    
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $e->getMessage(),
        'error_details' => [
            'dsn' => $dsn,
            'user' => $config['db_user'],
            'password_set' => !empty($config['db_password']),
            'host' => $config['db_host'],
            'port' => $config['db_port'],
            'database' => $config['db_name'],
        ]
    ]);
}
