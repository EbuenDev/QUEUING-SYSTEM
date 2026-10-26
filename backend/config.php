<?php

/**
 * RHU II Patient Queuing System - Configuration Loader
 *
 * Automatically parses and loads variables from the root .env file,
 * detects the runtime environment (Docker vs Local/Host),
 * and provides safe defaults for all database and authentication parameters.
 */

// Function to load .env variables into putenv, $_ENV, and $_SERVER
if (!function_exists('loadEnvFile')) {
    function loadEnvFile(string $filePath): void {
        if (!file_exists($filePath) || !is_readable($filePath)) {
            return;
        }

        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);

            // Skip comments and empty lines
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            // Remove leading 'export ' if present
            if (str_starts_with($line, 'export ')) {
                $line = trim(substr($line, 7));
            }

            if (strpos($line, '=') === false) {
                continue;
            }

            [$name, $value] = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);

            // Strip inline comments if not inside quotes
            if (!str_starts_with($value, '"') && !str_starts_with($value, "'")) {
                $commentPos = strpos($value, ' #');
                if ($commentPos !== false) {
                    $value = trim(substr($value, 0, $commentPos));
                }
            }

            // Strip surrounding quotes
            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            // Populate environment if not already explicitly set in system
            if (getenv($name) === false && !array_key_exists($name, $_ENV)) {
                putenv(sprintf('%s=%s', $name, $value));
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
    }
}

// Load root .env file if available
$rootEnvPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
loadEnvFile($rootEnvPath);

// Helper to read environment variable with fallback
$getEnvVar = static function (string $key, ?string $default = null): ?string {
    $val = getenv($key);
    if ($val !== false && $val !== '') {
        return $val;
    }
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return (string)$_ENV[$key];
    }
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        return (string)$_SERVER[$key];
    }
    return $default;
};

// Detect whether running inside a Docker container
$isDocker = file_exists('/.dockerenv') || (getenv('DOCKER_CONTAINER') !== false);

// Default DB host:
// - Inside Docker container: 'postgres' (container service name)
// - Outside Docker on host: 'localhost'
$defaultDbHost = $isDocker ? 'postgres' : 'localhost';
$dbHost = $getEnvVar('DB_HOST', $defaultDbHost);

// Handle edge case where DB_HOST=postgres in .env but script is executed on Windows host directly
if (!$isDocker && $dbHost === 'postgres') {
    // If running on host and 'postgres' does not resolve, fallback to localhost
    $resolved = @gethostbyname('postgres');
    if ($resolved === 'postgres') {
        $dbHost = 'localhost';
    }
}

$dbPort = $getEnvVar('DB_PORT', '5432');
$dbName = $getEnvVar('DB_NAME', 'rhu_queue_system');
$dbUser = $getEnvVar('DB_USER', 'postgres');
$dbPassword = $getEnvVar('DB_PASSWORD', 'postgres');

$adminUsername = $getEnvVar('ADMIN_USERNAME', 'admin');
$adminPassword = $getEnvVar('ADMIN_PASSWORD', 'admin123');
$legacyAdminPassword = $getEnvVar('LEGACY_ADMIN_PASSWORD', 'admin123');
$doctorUsername = $getEnvVar('DOCTOR_USERNAME', 'renz');
$doctorPassword = $getEnvVar('DOCTOR_PASSWORD', 'renzsale');
$superadminUsername = $getEnvVar('SUPERADMIN_USERNAME', 'superadmin');
$superadminPassword = $getEnvVar('SUPERADMIN_PASSWORD', 'superadmin123');
$allowedOrigins = $getEnvVar('ALLOWED_ORIGINS', '*');

return [
    'db_host'               => $dbHost,
    'db_port'               => $dbPort,
    'db_name'               => $dbName,
    'db_user'               => $dbUser,
    'db_password'           => $dbPassword,
    'admin_username'        => $adminUsername,
    'admin_password'        => $adminPassword,
    'legacy_admin_password' => $legacyAdminPassword,
    'doctor_username'       => $doctorUsername,
    'doctor_password'       => $doctorPassword,
    'superadmin_username'   => $superadminUsername,
    'superadmin_password'   => $superadminPassword,
    'allowed_origins'       => $allowedOrigins,
    'dsn'                   => sprintf('pgsql:host=%s;port=%s;dbname=%s', $dbHost, $dbPort, $dbName),
];
