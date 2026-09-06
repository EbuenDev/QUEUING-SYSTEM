<?php
require_once 'backend/Database.php';
require_once 'backend/config.php';

$config = require 'backend/config.php';

echo "Config loaded: " . ($config ? 'Yes' : 'No') . PHP_EOL;
echo "DB Host: " . $config['db_host'] . PHP_EOL;
echo "DB Name: " . $config['db_name'] . PHP_EOL;
echo "DB User: " . $config['db_user'] . PHP_EOL;

try {
    $db = Database::getInstance()->getConnection();
    echo "DB Connection: Success" . PHP_EOL;
    
    // Test query
    $stmt = $db->query("SELECT COUNT(*) FROM users");
    $count = $stmt->fetchColumn();
    echo "Users count: " . $count . PHP_EOL;
    
    // Test admin user
    $stmt = $db->prepare("SELECT username, role, is_active FROM users WHERE username = 'admin'");
    $stmt->execute();
    $user = $stmt->fetch();
    echo "Admin user: " . ($user ? $user['username'] . ' (' . $user['role'] . ')' : 'Not found') . PHP_EOL;
    
} catch (Exception $e) {
    echo "DB Connection: Failed" . PHP_EOL;
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
