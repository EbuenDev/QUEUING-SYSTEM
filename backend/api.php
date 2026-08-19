<?php

// only tells the browser that the response is JSON, so it can be handled properly by the frontend
header('Content-Type: application/json');

// Errors must never leak into the JSON body; they are logged and reported through jsonResponse instead.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

class ApiException extends RuntimeException {
    private int $statusCode;

    public function __construct(string $message, int $statusCode = 500, ?Throwable $previous = null) {
        parent::__construct($message, 0, $previous);
        $this->statusCode = $statusCode;
    }

    public function getStatusCode(): int {
        return $this->statusCode;
    }
}

$responseSent = false;

function jsonResponse(array $payload, int $status = 200): void {
    global $responseSent;

    $encoded = json_encode($payload);
    if ($encoded === false) {
        error_log('Unable to encode API response: ' . json_last_error_msg());
        $status = 500;
        $encoded = json_encode(['success' => false, 'message' => 'Unable to encode server response']);
    }

    if (!headers_sent()) {
        http_response_code($status);
    }

    $responseSent = true;
    echo $encoded;
}

function reportFailure(string $message, int $status, ?Throwable $error = null): void {
    global $responseSent;

    if ($error !== null) {
        error_log('Queue API failure: ' . $error->getMessage());
    } else {
        error_log('Queue API failure: ' . $message);
    }

    if ($responseSent) {
        return;
    }

    jsonResponse(['success' => false, 'message' => $message], $status);
}

// Warnings such as an unwritable data file must not be ignored: they become exceptions and a 500 response.
set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }

    if (in_array($severity, [E_DEPRECATED, E_USER_DEPRECATED], true)) {
        return false;
    }

    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(function (Throwable $error): void {
    if ($error instanceof ApiException) {
        reportFailure($error->getMessage(), $error->getStatusCode(), $error);
        return;
    }

    reportFailure('Unexpected server error while handling the request', 500, $error);
});

// Fatal errors bypass the exception handler, so the shutdown hook keeps the response valid JSON.
register_shutdown_function(function (): void {
    global $responseSent;

    $lastError = error_get_last();
    $isFatal = $lastError !== null
        && in_array($lastError['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true);

    if ($responseSent || !$isFatal) {
        return;
    }

    error_log('Queue API fatal error: ' . $lastError['message']);
    jsonResponse(['success' => false, 'message' => 'Unexpected server error while handling the request'], 500);
});

function loadConfig(string $configFile): array {
    if (!is_readable($configFile)) {
        throw new ApiException(
            'Server configuration is missing. Copy backend/config.example.php to backend/config.php and set the admin credentials.',
            500
        );
    }

    $config = require $configFile;
    if (!is_array($config)) {
        throw new ApiException('Server configuration is invalid: backend/config.php must return an array.', 500);
    }

    foreach (['admin_username', 'admin_password'] as $requiredKey) {
        if (!isset($config[$requiredKey]) || !is_string($config[$requiredKey]) || $config[$requiredKey] === '') {
            throw new ApiException("Server configuration is invalid: '$requiredKey' is missing.", 500);
        }
    }

    return $config;
}

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
        saveState($stateFile, $initialState);
        return $initialState;
    }

    $contents = file_get_contents($stateFile);
    if ($contents === false) {
        throw new ApiException('Unable to read the queue data file', 500);
    }

    if (trim($contents) === '') {
        return getDefaultState();
    }

    $decoded = json_decode($contents, true);
    // Never fall back to an empty queue here: the next save would overwrite the existing patient data.
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
        throw new ApiException('Queue data file is corrupted and was not overwritten. Please restore it from a backup.', 500);
    }

    return [
        'patients' => is_array($decoded['patients'] ?? null) ? $decoded['patients'] : [],
        'nextQueueNumber' => max(1, (int) ($decoded['nextQueueNumber'] ?? 1)),
        'consultationHistory' => is_array($decoded['consultationHistory'] ?? null) ? $decoded['consultationHistory'] : [],
    ];
}

function saveState(string $stateFile, array $state): void {
    $encoded = json_encode($state, JSON_PRETTY_PRINT);
    if ($encoded === false) {
        throw new ApiException('Unable to encode the queue data: ' . json_last_error_msg(), 500);
    }

    $written = @file_put_contents($stateFile, $encoded, LOCK_EX);
    if ($written === false || $written !== strlen($encoded)) {
        throw new ApiException('Unable to save the queue data. The change was not persisted.', 500);
    }
}

function isAdminAuthenticated(): bool {
    return !empty($_SESSION['admin_authenticated']);
}

/**
 * @param array<int, array<string, mixed>> $patients
 */
function findPatientIndex(array $patients, string $id): ?int {
    foreach ($patients as $index => $patient) {
        if (($patient['id'] ?? '') === $id) {
            return (int) $index;
        }
    }

    return null;
}

function requirePatientId(array $payload): string {
    $id = (string) ($payload['id'] ?? '');
    if ($id === '') {
        throw new ApiException('Patient ID is required', 400);
    }

    return $id;
}

$stateFile = __DIR__ . '/queue.json';
$config = loadConfig(__DIR__ . '/config.php');

$adminUsername = $config['admin_username'];
$adminPassword = $config['admin_password'];
$legacyAdminPassword = (string) ($config['legacy_admin_password'] ?? '');

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
if ($rawInput === false) {
    throw new ApiException('Unable to read the request body', 400);
}

if (trim($rawInput) === '') {
    $payload = $_POST;
} else {
    $payload = json_decode($rawInput, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($payload)) {
        if (empty($_POST)) {
            throw new ApiException('Request body is not valid JSON: ' . json_last_error_msg(), 400);
        }

        // Form-encoded submissions stay supported.
        $payload = $_POST;
    }
}

$action = $payload['action'] ?? '';
$requiresAdminAuth = in_array($action, ['add', 'edit', 'delete'], true);

if ($requiresAdminAuth && !isAdminAuthenticated()) {
    jsonResponse(['success' => false, 'message' => 'Admin authentication required'], 401);
    exit;
}

switch ($action) {
    case 'login':
        $username = trim((string) ($payload['username'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        $isValidLogin = $username === $adminUsername
            && ($password === $adminPassword
                || ($legacyAdminPassword !== '' && $password === $legacyAdminPassword));

        if ($isValidLogin) {
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
        $philHealthId = trim((string) ($payload['philHealthId'] ?? ''));
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
        $id = requirePatientId($payload);

        if (findPatientIndex($state['patients'], $id) === null) {
            jsonResponse(['success' => false, 'message' => 'Patient not found in the queue'], 404);
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
        $id = requirePatientId($payload);
        $icdCode = trim((string) ($payload['icdCode'] ?? ''));
        $consultationDetails = trim((string) ($payload['consultationDetails'] ?? ''));

        $patientIndex = findPatientIndex($state['patients'], $id);
        if ($patientIndex === null) {
            jsonResponse(['success' => false, 'message' => 'Patient not found in the queue'], 404);
            exit;
        }

        $completedPatient = $state['patients'][$patientIndex];
        unset($state['patients'][$patientIndex]);

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

        $state['patients'] = array_values($state['patients']);

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'skip':
        $id = requirePatientId($payload);

        $patientIndex = findPatientIndex($state['patients'], $id);
        if ($patientIndex === null) {
            jsonResponse(['success' => false, 'message' => 'Patient not found in the queue'], 404);
            exit;
        }

        $state['patients'][$patientIndex]['status'] = 'skipped';

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'recall':
        $id = requirePatientId($payload);

        $patientIndex = findPatientIndex($state['patients'], $id);
        if ($patientIndex === null) {
            jsonResponse(['success' => false, 'message' => 'Patient not found in the queue'], 404);
            exit;
        }

        $state['patients'][$patientIndex]['status'] = 'waiting';

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'edit-history':
        $id = (string) ($payload['id'] ?? '');
        $icdCode = trim((string) ($payload['icdCode'] ?? ''));
        $consultationDetails = trim((string) ($payload['consultationDetails'] ?? ''));

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
        $name = trim((string) ($payload['name'] ?? ''));
        $philHealthId = trim((string) ($payload['philHealthId'] ?? ''));
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

        $patientIndex = findPatientIndex($state['patients'], $id);
        if ($patientIndex === null) {
            jsonResponse(['success' => false, 'message' => 'Patient not found in the queue'], 404);
            exit;
        }

        $state['patients'][$patientIndex]['name'] = $name;
        $state['patients'][$patientIndex]['philHealthId'] = $philHealthId;
        $state['patients'][$patientIndex]['patientStatus'] = $type;
        $state['patients'][$patientIndex]['type'] = $type;
        $state['patients'][$patientIndex]['philHealthStatus'] = $philHealthStatus;

        saveState($stateFile, $state);
        jsonResponse(['success' => true, 'state' => $state]);
        break;

    case 'delete':
        $id = requirePatientId($payload);

        if (findPatientIndex($state['patients'], $id) === null) {
            jsonResponse(['success' => false, 'message' => 'Patient not found in the queue'], 404);
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
