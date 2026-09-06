<?php
// Test the API login endpoint directly
require_once 'backend/Database.php';
require_once 'backend/config.php';

$config = require 'backend/config.php';

// Simulate POST request with login action
$_SERVER['REQUEST_METHOD'] = 'POST';
$rawInput = json_encode(['action' => 'login', 'username' => 'admin', 'password' => 'admin123']);
$payload = json_decode($rawInput, true);

echo "Simulated payload: " . $rawInput . PHP_EOL;
echo "Action: " . ($payload['action'] ?? 'none') . PHP_EOL;
echo "Username: " . ($payload['username'] ?? 'none') . PHP_EOL;
echo "Password: " . ($payload['password'] ?? 'none') . PHP_EOL;

// Test the login logic
$action = $payload['action'] ?? '';
$username = trim((string) ($payload['username'] ?? ''));
$password = (string) ($payload['password'] ?? '');

$adminUsername = $config['admin_username'];
$adminPassword = $config['admin_password'];

echo "Config credentials: $adminUsername / $adminPassword" . PHP_EOL;

if ($action === 'login') {
    echo "Action matches 'login'" . PHP_EOL;
    
    try {
        $db = Database::getInstance()->getConnection();
        
        // Try database authentication first
        $stmt = $db->prepare("SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = :username");
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password, $user['password_hash']) && $user['is_active'] && in_array($user['role'], ['admin', 'super_admin'])) {
            echo "Database authentication: SUCCESS" . PHP_EOL;
            echo "Expected response: " . json_encode(['success' => true, 'message' => 'Login successful', 'user' => $user]) . PHP_EOL;
        } else {
            echo "Database authentication: FAILED, trying config-based" . PHP_EOL;
            
            // Fallback to old config-based authentication
            $isValidLogin = ($username === $adminUsername && $password === $adminPassword)
                || ($username === $adminUsername && $password === $config['legacy_admin_password']);
            
            if ($isValidLogin) {
                echo "Config-based authentication: SUCCESS" . PHP_EOL;
                echo "Expected response: " . json_encode(['success' => true, 'message' => 'Login successful']) . PHP_EOL;
            } else {
                echo "Config-based authentication: FAILED" . PHP_EOL;
                echo "Expected response: " . json_encode(['success' => false, 'message' => 'Invalid username or password']) . PHP_EOL;
            }
        }
    } catch (Exception $e) {
        echo "Error: " . $e->getMessage() . PHP_EOL;
    }
} else {
    echo "Action does not match 'login'" . PHP_EOL;
}
