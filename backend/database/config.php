<?php

// Load environment variables from .env file if it exists
$envFile = __DIR__ . '/../../.env';
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
            if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
                putenv(sprintf('%s=%s', $name, $value));
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
    }
}

// PostgreSQL Database Configuration
return [
    // Database connection settings
    'db_host' => getenv('DB_HOST') ?: 'localhost',
    'db_port' => getenv('DB_PORT') ?: '5432',
    'db_name' => getenv('DB_NAME') ?: 'rhu_queue_system',
    'db_user' => getenv('DB_USER') ?: 'postgres',
    'db_password' => getenv('DB_PASSWORD') ?: '',
    
    // Admin credentials (existing from config.php)
    'admin_username' => 'admin',
    'admin_password' => 'admin123',
    'legacy_admin_password' => 'admin123',
    
    // PDO connection string
    'dsn' => sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        getenv('DB_HOST') ?: 'localhost',
        getenv('DB_PORT') ?: '5432',
        getenv('DB_NAME') ?: 'rhu_queue_system'
    ),
];