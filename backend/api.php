<?php

// only tells the browser that the response is JSON, so it can be handled properly by the frontend
header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$stateFile = __DIR__ . '/queue.json';
$adminUsername = 'admin';
$adminPassword = 'rhu2admin';

function getDefaultState(): array {
    return [
        'patients' => [],
        'nextQueueNumber' => 1,
    ];
}

function loadState(string $stateFile): array {
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

    return [
        'patients' => is_array($decoded['patients'] ?? null) ? $decoded['patients'] : [],
        'nextQueueNumber' => max(1, (int) ($decoded['nextQueueNumber'] ?? 1)),
    ];
}

function saveState(string $stateFile, array $state): void {
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT), LOCK_EX);
}

function jsonResponse(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
}

function isAdminAuthenticated(): bool {
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
$requiresAdminAuth = !in_array($action, ['login', 'logout'], true);

if ($requiresAdminAuth && !isAdminAuthenticated()) {
    jsonResponse(['success' => false, 'message' => 'Admin authentication required'], 401);
    exit;
}

switch ($action) {
    case 'login':
        $username = trim((string) ($payload['username'] ?? ''));
        $password = (string) ($payload['password'] ?? '');

        if ($username === $adminUsername && $password === $adminPassword) {
            $_SESSION['admin_authenticated'] = true;
            jsonResponse(['success' => true, 'message' => 'Login successful']);
        } else {
            $_SESSION['admin_authenticated'] = false;
            jsonResponse(['success' => false, 'message' => 'Invalid username or password'], 401);
        }
        break;

    case 'logout':
        unset($_SESSION['admin_authenticated']);
        jsonResponse(['success' => true, 'message' => 'Logged out']);
        break;
    case 'add':
        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '') {
            jsonResponse(['success' => false, 'message' => 'Patient name is required'], 400);
            exit;
        }

        $state['patients'][] = [
            'id' => bin2hex(random_bytes(8)),
            'name' => $name,
            'queueNumber' => $state['nextQueueNumber'],
            'status' => 'waiting',
        ];
        $state['nextQueueNumber']++;
        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'serve-next':
        $currentServingPatient = null;
        foreach ($state['patients'] as &$patient) {
            if (($patient['status'] ?? '') === 'serving') {
                $currentServingPatient = &$patient;
                $patient['status'] = 'done';
            }
        }
        unset($patient);

        foreach ($state['patients'] as &$patient) {
            if (($patient['status'] ?? '') === 'waiting') {
                $patient['status'] = 'serving';
                break;
            }
        }
        unset($patient);

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'serve':
        $id = (string) ($payload['id'] ?? '');
        if ($id === '') {
            jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
            exit;
        }

        foreach ($state['patients'] as &$patient) {
            if (($patient['status'] ?? '') === 'serving') {
                $patient['status'] = 'done';
            }
        }
        unset($patient);

        foreach ($state['patients'] as &$patient) {
            if (($patient['id'] ?? '') === $id) {
                $patient['status'] = 'serving';
                break;
            }
        }
        unset($patient);

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'edit':
        $id = (string) ($payload['id'] ?? '');
        $name = trim((string) ($payload['name'] ?? ''));
        if ($id === '' || $name === '') {
            jsonResponse(['success' => false, 'message' => 'Patient ID and a new name are required'], 400);
            exit;
        }

        foreach ($state['patients'] as &$patient) {
            if (($patient['id'] ?? '') === $id) {
                $patient['name'] = $name;
                break;
            }
        }
        unset($patient);

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'delete':
        $id = (string) ($payload['id'] ?? '');
        if ($id === '') {
            jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
            exit;
        }

        $state['patients'] = array_values(array_filter($state['patients'], function ($patient) use ($id) {
            return ($patient['id'] ?? '') !== $id;
        }));

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'reset':
        $state = getDefaultState();
        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    default:
        jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
        break;
}
