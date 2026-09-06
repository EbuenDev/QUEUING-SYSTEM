<?php
require 'backend/Database.php';
require 'backend/config.php';

$config = require 'backend/config.php';

echo "Testing direct authentication with database\n";
echo "===========================================\n";

try {
    $db = Database::getInstance()->getConnection();
    echo "Database connection successful\n\n";

    // Test superadmin login
    echo "Testing superadmin/superadmin123:\n";
    $stmt = $db->prepare("SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = 'superadmin'");
    $stmt->execute();
    $user = $stmt->fetch();

    if ($user) {
        echo "User found: " . $user['username'] . " (" . $user['role'] . ")\n";
        echo "Password hash: " . $user['password_hash'] . "\n";
        echo "Password verification: " . (password_verify('superadmin123', $user['password_hash']) ? "SUCCESS" : "FAILED") . "\n";
    } else {
        echo "User not found\n";
    }

    echo "\n";

    // Test admin login
    echo "Testing admin/admin123:\n";
    $stmt = $db->prepare("SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = 'admin'");
    $stmt->execute();
    $user = $stmt->fetch();

    if ($user) {
        echo "User found: " . $user['username'] . " (" . $user['role'] . ")\n";
        echo "Password verification: " . (password_verify('admin123', $user['password_hash']) ? "SUCCESS" : "FAILED") . "\n";
    } else {
        echo "User not found\n";
    }

    echo "\n";

    // Test doctor login
    echo "Testing renz/renzsale:\n";
    $stmt = $db->prepare("SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = 'renz'");
    $stmt->execute();
    $user = $stmt->fetch();

    if ($user) {
        echo "User found: " . $user['username'] . " (" . $user['role'] . ")\n";
        echo "Password verification: " . (password_verify('renzsale', $user['password_hash']) ? "SUCCESS" : "FAILED") . "\n";
    } else {
        echo "User not found\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
