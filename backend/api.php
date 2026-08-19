<?php

// only tells the browser that the response is JSON, so it can be handled properly by the frontend
header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_start();
}

$stateFile = __DIR__ . '/queue.json';

$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server configuration missing. Copy backend/config.example.php to backend/config.php and set credentials.']);
    exit;
}

$config = require $configFile;

$adminUsername = (string) ($config['admin_username'] ?? '');
$adminPassword = (string) ($config['admin_password'] ?? '');
$adminPasswordHash = (string) ($config['admin_password_hash'] ?? '');

function getDefaultState(): array {
    return [
        'patients' => [],
        'nextQueueNumber' => 1,
        'consultationHistory' => [],
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
        'consultationHistory' => is_array($decoded['consultationHistory'] ?? null) ? $decoded['consultationHistory'] : [],
    ];
}

function saveState(string $stateFile, array $state): void {
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT), LOCK_EX);
}

function jsonResponse(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
}

function limitLength(string $value, int $maxLength): string {
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength);
    }
    return substr($value, 0, $maxLength);
}

function isAdminAuthenticated(): bool {
    return !empty($_SESSION['admin_authenticated']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST' && !empty($_SERVER['HTTP_ORIGIN']) && !empty($_SERVER['HTTP_HOST'])) {
    $originHost = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST);
    $originPort = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_PORT);
    $expectedHost = $originPort !== null ? $originHost . ':' . $originPort : $originHost;
    if ($originHost !== null && strcasecmp($expectedHost, $_SERVER['HTTP_HOST']) !== 0 && strcasecmp((string) $originHost, $_SERVER['HTTP_HOST']) !== 0) {
        jsonResponse(['success' => false, 'message' => 'Cross-origin requests are not allowed'], 403);
        exit;
    }
}

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
$requiresAdminAuth = in_array($action, ['add', 'edit', 'delete', 'reset'], true);

if ($requiresAdminAuth && !isAdminAuthenticated()) {
    jsonResponse(['success' => false, 'message' => 'Admin authentication required'], 401);
    exit;
}

switch ($action) {
    case 'login':
        $username = trim((string) ($payload['username'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        $usernameMatches = $adminUsername !== '' && hash_equals($adminUsername, $username);
        $passwordMatches = false;
        if ($adminPasswordHash !== '') {
            $passwordMatches = password_verify($password, $adminPasswordHash);
        } elseif ($adminPassword !== '') {
            $passwordMatches = hash_equals($adminPassword, $password);
        }
        $isValidLogin = $usernameMatches && $passwordMatches;

        if ($isValidLogin) {
            session_regenerate_id(true);
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
        $name = limitLength(trim((string) ($payload['name'] ?? '')), 200);
        $philHealthId = limitLength(trim((string) ($payload['philHealthId'] ?? '')), 50);
        $type = strtolower(trim((string) ($payload['patientStatus'] ?? $payload['type'] ?? 'regular')));
        $philHealthStatus = strtolower(trim((string) ($payload['philHealthStatus'] ?? 'no-philhealth')));
        $allowedTypes = ['regular', 'pwd', 'senior', 'emergency'];
        $allowedPhilHealthStatus = ['no-philhealth', 'registered', 'not-registered', 'other-facility'];

        if ($name === '') {
            jsonResponse(['success' => false, 'message' => 'Patient name is required'], 400);
            exit;
        }

        if (!in_array($type, $allowedTypes, true)) {
            $type = 'regular';
        }

        if (!in_array($philHealthStatus, $allowedPhilHealthStatus, true)) {
            $philHealthStatus = 'no-philhealth';
        }

        $state['patients'][] = [
            'id' => bin2hex(random_bytes(8)),
            'name' => $name,
            'philHealthId' => $philHealthId,
            'queueNumber' => $state['nextQueueNumber'],
            'status' => 'waiting',
            'patientStatus' => $type,
            'type' => $type,
            'philHealthStatus' => $philHealthStatus,
        ];
        $state['nextQueueNumber']++;
        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'serve-next':
        $completedPatient = null;
        foreach ($state['patients'] as $index => $patient) {
            if (($patient['status'] ?? '') === 'serving') {
                $completedPatient = $patient;
                unset($state['patients'][$index]);
                break;
            }
        }

        if ($completedPatient !== null) {
            $state['consultationHistory'][] = [
                'id' => $completedPatient['id'],
                'name' => $completedPatient['name'],
                'queueNumber' => $completedPatient['queueNumber'],
                'finishedAt' => date('Y-m-d H:i:s'),
            ];
        }

        $state['patients'] = array_values($state['patients']);

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

        $completedPatient = null;
        foreach ($state['patients'] as $index => $patient) {
            if (($patient['status'] ?? '') === 'serving') {
                $completedPatient = $patient;
                unset($state['patients'][$index]);
                break;
            }
        }

        if ($completedPatient !== null) {
            $state['consultationHistory'][] = [
                'id' => $completedPatient['id'],
                'name' => $completedPatient['name'],
                'queueNumber' => $completedPatient['queueNumber'],
                'finishedAt' => date('Y-m-d H:i:s'),
            ];
        }

        $state['patients'] = array_values($state['patients']);

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

    case 'finish':
        $id = (string) ($payload['id'] ?? '');
        $icdCode = limitLength(trim((string) ($payload['icdCode'] ?? '')), 50);
        $consultationDetails = limitLength(trim((string) ($payload['consultationDetails'] ?? '')), 5000);
        if ($id === '') {
            jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
            exit;
        }

        $completedPatient = null;
        foreach ($state['patients'] as $index => $patient) {
            if (($patient['id'] ?? '') === $id) {
                $completedPatient = $patient;
                unset($state['patients'][$index]);
                break;
            }
        }

        if ($completedPatient !== null) {
            $state['consultationHistory'][] = [
                'id' => $completedPatient['id'],
                'name' => $completedPatient['name'],
                'queueNumber' => $completedPatient['queueNumber'],
                'philHealthId' => $completedPatient['philHealthId'] ?? '',
                'patientStatus' => $completedPatient['patientStatus'] ?? ($completedPatient['type'] ?? 'regular'),
                'philHealthStatus' => $completedPatient['philHealthStatus'] ?? 'no-philhealth',
                'icdCode' => $icdCode,
                'consultationDetails' => $consultationDetails,
                'finishedAt' => date('Y-m-d H:i:s'),
            ];
        }

        $state['patients'] = array_values($state['patients']);

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'skip':
        $id = (string) ($payload['id'] ?? '');
        if ($id === '') {
            jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
            exit;
        }

        foreach ($state['patients'] as &$patient) {
            if (($patient['id'] ?? '') === $id) {
                $patient['status'] = 'skipped';
                break;
            }
        }
        unset($patient);

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'recall':
        $id = (string) ($payload['id'] ?? '');
        if ($id === '') {
            jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
            exit;
        }

        foreach ($state['patients'] as &$patient) {
            if (($patient['id'] ?? '') === $id) {
                $patient['status'] = 'waiting';
                break;
            }
        }
        unset($patient);

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'edit-history':
        $id = (string) ($payload['id'] ?? '');
        $icdCode = limitLength(trim((string) ($payload['icdCode'] ?? '')), 50);
        $consultationDetails = limitLength(trim((string) ($payload['consultationDetails'] ?? '')), 5000);

        if ($id === '') {
            jsonResponse(['success' => false, 'message' => 'History ID is required'], 400);
            exit;
        }

        $historyUpdated = false;
        foreach ($state['consultationHistory'] as &$entry) {
            if (($entry['id'] ?? '') === $id) {
                $entry['icdCode'] = $icdCode;
                $entry['consultationDetails'] = $consultationDetails;
                $historyUpdated = true;
                break;
            }
        }
        unset($entry);

        if (!$historyUpdated) {
            jsonResponse(['success' => false, 'message' => 'History entry not found'], 404);
            exit;
        }

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'edit':
        $id = (string) ($payload['id'] ?? '');
        $name = limitLength(trim((string) ($payload['name'] ?? '')), 200);
        $philHealthId = limitLength(trim((string) ($payload['philHealthId'] ?? '')), 50);
        $type = strtolower(trim((string) ($payload['patientStatus'] ?? $payload['type'] ?? 'regular')));
        $philHealthStatus = strtolower(trim((string) ($payload['philHealthStatus'] ?? 'no-philhealth')));
        $allowedTypes = ['regular', 'pwd', 'senior', 'emergency'];
        $allowedPhilHealthStatus = ['no-philhealth', 'registered', 'not-registered', 'other-facility'];

        if ($id === '' || $name === '') {
            jsonResponse(['success' => false, 'message' => 'Patient ID and a new name are required'], 400);
            exit;
        }

        if (!in_array($type, $allowedTypes, true)) {
            $type = 'regular';
        }

        if (!in_array($philHealthStatus, $allowedPhilHealthStatus, true)) {
            $philHealthStatus = 'no-philhealth';
        }

        foreach ($state['patients'] as &$patient) {
            if (($patient['id'] ?? '') === $id) {
                $patient['name'] = $name;
                $patient['philHealthId'] = $philHealthId;
                $patient['patientStatus'] = $type;
                $patient['type'] = $type;
                $patient['philHealthStatus'] = $philHealthStatus;
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
