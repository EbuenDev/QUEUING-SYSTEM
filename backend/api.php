<?php

// only tells the browser that the response is JSON, so it can be handled properly by the frontend
header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$stateFile = __DIR__ . '/queue.json';
$adminUsername = 'admin';
$adminPassword = 'admin123';

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

function isAdminAuthenticated(): bool {
    return !empty($_SESSION['admin_authenticated']);
}

function cleanPatientNumber($value): string {
    return substr(preg_replace('/\D/', '', (string) $value), 0, 12);
}

function cleanPatientType($value): string {
    $type = strtolower(trim((string) $value));
    $allowedTypes = ['regular', 'pwd', 'senior', 'emergency'];

    return in_array($type, $allowedTypes, true) ? $type : 'regular';
}

function cleanRegistrationStatus($value): string {
    $status = strtolower(trim((string) $value));
    $allowedStatuses = ['yakap-registered', 'not-registered', 'no-philhealth', 'other-facilities'];

    return in_array($status, $allowedStatuses, true) ? $status : '';
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
$requiresAdminAuth = !in_array($action, ['login', 'logout', 'add', 'serve-next', 'serve', 'finish'], true);

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
        $type = cleanPatientType($payload['type'] ?? 'regular');
        $patientNumber = cleanPatientNumber($payload['patientNumber'] ?? '');
        $registrationStatus = cleanRegistrationStatus($payload['registrationStatus'] ?? '');
        if ($name === '') {
            jsonResponse(['success' => false, 'message' => 'Patient name is required'], 400);
            exit;
        }

        $state['patients'][] = [
            'id' => bin2hex(random_bytes(8)),
            'name' => $name,
            'queueNumber' => $state['nextQueueNumber'],
            'status' => 'waiting',
            'type' => $type,
            'patientNumber' => $patientNumber,
            'registrationStatus' => $registrationStatus,
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
                'patientNumber' => $completedPatient['patientNumber'] ?? '',
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
                'patientNumber' => $completedPatient['patientNumber'] ?? '',
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
                'patientNumber' => $completedPatient['patientNumber'] ?? '',
                'finishedAt' => date('Y-m-d H:i:s'),
            ];
        }

        $state['patients'] = array_values($state['patients']);

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'edit':
        $id = (string) ($payload['id'] ?? '');
        $name = trim((string) ($payload['name'] ?? ''));
        $type = cleanPatientType($payload['type'] ?? 'regular');
        $patientNumber = cleanPatientNumber($payload['patientNumber'] ?? '');
        $registrationStatus = cleanRegistrationStatus($payload['registrationStatus'] ?? '');
        if ($id === '' || $name === '') {
            jsonResponse(['success' => false, 'message' => 'Patient ID and a new name are required'], 400);
            exit;
        }

        foreach ($state['patients'] as &$patient) {
            if (($patient['id'] ?? '') === $id) {
                $patient['name'] = $name;
                $patient['type'] = $type;
                $patient['patientNumber'] = $patientNumber;
                $patient['registrationStatus'] = $registrationStatus;
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
