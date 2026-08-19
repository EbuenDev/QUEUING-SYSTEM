<?php

header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/queue_logic.php';

$stateFile = __DIR__ . '/queue.json';
$config = require __DIR__ . '/config.php';

function loadState(string $stateFile): array
{
    if (!file_exists($stateFile)) {
        $initialState = getDefaultState();
        file_put_contents($stateFile, json_encode($initialState, JSON_PRETTY_PRINT));
        return $initialState;
    }

    $contents = file_get_contents($stateFile);
    if ($contents === false || trim($contents) === '') {
        return getDefaultState();
    }

    $decoded = json_decode($contents, true);
    if (!is_array($decoded)) {
        return getDefaultState();
    }

    return normalizeState($decoded);
}

function saveState(string $stateFile, array $state): void
{
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT), LOCK_EX);
}

function jsonResponse(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
}

function isAdminAuthenticated(): bool
{
    return !empty($_SESSION['admin_authenticated']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$state = loadState($stateFile);

if ($method === 'GET') {
    jsonResponse(['success' => true, 'state' => $state]);
    exit;
}

if ($method !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
    exit;
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);
if (!is_array($payload)) {
    $payload = $_POST;
}

$action = $payload['action'] ?? '';
if ($action === 'login') {
    $username = trim((string) ($payload['username'] ?? ''));
    $password = (string) ($payload['password'] ?? '');
    if (validateCredentials($username, $password, $config)) {
        $_SESSION['admin_authenticated'] = true;
        jsonResponse(['success' => true, 'message' => 'Login successful']);
    } else {
        $_SESSION['admin_authenticated'] = false;
        jsonResponse(['success' => false, 'message' => 'Invalid username or password'], 401);
    }
    exit;
}

if ($action === 'logout') {
    unset($_SESSION['admin_authenticated']);
    jsonResponse(['success' => true, 'message' => 'Logged out']);
    exit;
}

if (in_array($action, ['add', 'edit', 'delete'], true) && !isAdminAuthenticated()) {
    jsonResponse(['success' => false, 'message' => 'Admin authentication required'], 401);
    exit;
}

$result = queueAction($state, $payload);
if ($result['persist']) {
    saveState($stateFile, $result['state']);
}
jsonResponse($result['body'], $result['status']);
