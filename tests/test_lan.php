<?php
// Simple test file to diagnose LAN connectivity issues
header('Content-Type: application/json');

// Add CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$testResult = [
    'success' => true,
    'message' => 'LAN connectivity test successful',
    'timestamp' => date('Y-m-d H:i:s'),
    'server_info' => [
        'request_method' => $_SERVER['REQUEST_METHOD'],
        'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'server_name' => $_SERVER['SERVER_NAME'] ?? 'unknown',
        'http_host' => $_SERVER['HTTP_HOST'] ?? 'unknown',
        'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
    ],
    'php_info' => [
        'version' => phpversion(),
        'session_status' => session_status(),
    ]
];

echo json_encode($testResult);
