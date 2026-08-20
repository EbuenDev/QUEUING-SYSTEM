<?php
// Test login API directly
header('Content-Type: application/json');

// Add CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Use POST method']);
    exit;
}

require_once 'backend/database/Database.php';
require_once 'backend/database/config.php';

$config = require __DIR__ . '/backend/database/config.php';

$adminUsername = $config['admin_username'];
$adminPassword = $config['admin_password'];

// Get login credentials
$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);

$username = trim((string) ($payload['username'] ?? ''));
$password = (string) ($payload['password'] ?? '');

$isValidLogin = ($username === $adminUsername && $password === $adminPassword);

if ($isValidLogin) {
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'test_info' => [
            'username_received' => $username,
            'expected_username' => $adminUsername,
            'password_match' => true
        ]
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid username or password',
        'test_info' => [
            'username_received' => $username,
            'expected_username' => $adminUsername,
            'password_match' => false
        ]
    ]);
}
