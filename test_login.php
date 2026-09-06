<?php
require_once 'backend/Database.php';
require_once 'backend/config.php';

$config = require 'backend/config.php';

$adminUsername = $config['admin_username'];
$adminPassword = $config['admin_password'];

echo "Config credentials: $adminUsername / $adminPassword" . PHP_EOL;

try {
    $db = Database::getInstance()->getConnection();
    echo "DB Connection: Success" . PHP_EOL;
    
    // Test database authentication
    $username = 'admin';
    $password = 'admin123';
    
    $stmt = $db->prepare("SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = :username");
    $stmt->execute([':username' => $username]);
    $user = $stmt->fetch();
    
    if ($user) {
        echo "User found: " . $user['username'] . " (role: " . $user['role'] . ", active: " . ($user['is_active'] ? 'yes' : 'no') . ")" . PHP_EOL;
        echo "Password hash: " . $user['password_hash'] . PHP_EOL;
        
        $verified = password_verify($password, $user['password_hash']);
        echo "Password verification: " . ($verified ? 'SUCCESS' : 'FAILED') . PHP_EOL;
        
        if ($verified && $user['is_active'] && in_array($user['role'], ['admin', 'super_admin'])) {
            echo "Authentication: SUCCESS" . PHP_EOL;
        } else {
            echo "Authentication: FAILED" . PHP_EOL;
        }
    } else {
        echo "User not found in database" . PHP_EOL;
    }
    
    // Test config-based authentication
    $configAuth = ($username === $adminUsername && $password === $adminPassword);
    echo "Config-based auth: " . ($configAuth ? 'SUCCESS' : 'FAILED') . PHP_EOL;
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
