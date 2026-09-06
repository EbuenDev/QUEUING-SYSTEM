<?php
// Test the API login endpoint directly
$_SERVER['REQUEST_METHOD'] = 'POST';

// Simulate POST data
$payload = json_encode([
    'action' => 'login',
    'username' => 'admin',
    'password' => 'admin123'
]);

// Save to temp file
$tempFile = tempnam(sys_get_temp_dir(), 'api_test');
file_put_contents($tempFile, $payload);

// Override php://input by modifying the input stream
$GLOBALS['HTTP_RAW_POST_DATA'] = $payload;

// Directly include the API file
require 'backend/api_postgres.php';
