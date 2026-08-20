<?php

class Database {
    private static $instance = null;
    private $connection;
    
    private function __construct() {
        $config = require __DIR__ . '/config.php';
        
        try {
            $this->connection = new PDO(
                $config['dsn'],
                $config['db_user'],
                $config['db_password'],
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        } catch (PDOException $e) {
            $errorMessage = 'Database connection failed: ' . $e->getMessage();
            error_log($errorMessage);
            error_log('DSN: ' . $config['dsn']);
            error_log('User: ' . $config['db_user']);
            throw new Exception($errorMessage);
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
    
    // Prevent cloning
    private function __clone() {}
    
    // Prevent unserialization
    public function __wakeup() {
        throw new Exception('Cannot unserialize singleton');
    }
}