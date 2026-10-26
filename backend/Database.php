<?php

/**
 * RHU II Patient Queuing System - Database Connection Class
 *
 * Provides a PDO PostgreSQL connection with singleton access via Database::getInstance()->getConnection().
 * Also supports direct instantiation: new Database($host, $name, $user, $password, $port)
 * for backward compatibility with existing migration and testing scripts.
 */

class Database {
    private static ?Database $instance = null;
    private PDO $connection;

    public function __construct(
        ?string $host = null,
        ?string $dbName = null,
        ?string $user = null,
        ?string $password = null,
        ?string $port = null
    ) {
        $config = require __DIR__ . '/config.php';

        $dbHost = $host ?? $config['db_host'];
        $dbPort = $port ?? $config['db_port'];
        $dbName = $dbName ?? $config['db_name'];
        $dbUser = $user ?? $config['db_user'];
        $dbPass = $password ?? $config['db_password'];

        $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', $dbHost, $dbPort, $dbName);

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_TIMEOUT            => 5,
        ];

        try {
            $this->connection = new PDO($dsn, $dbUser, $dbPass, $options);
        } catch (PDOException $e) {
            $errorMessage = sprintf(
                "Database connection failed: %s (Host: %s, Port: %s, Database: %s, User: %s)",
                $e->getMessage(),
                $dbHost,
                $dbPort,
                $dbName,
                $dbUser
            );
            error_log($errorMessage);
            throw new Exception($errorMessage, (int)$e->getCode(), $e);
        }
    }

    public static function getInstance(): Database {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection(): PDO {
        return $this->connection;
    }

    private function __clone() {}

    public function __wakeup() {
        throw new Exception('Cannot unserialize singleton');
    }
}
