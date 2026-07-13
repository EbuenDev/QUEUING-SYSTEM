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

        // Determines which category should go first
        // when alternating Senior and Regular.
        'nextAlternatingType' => 'senior',

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
    'patients' => is_array($decoded['patients'] ?? null)
        ? $decoded['patients']
        : [],

    'nextQueueNumber' => max(
        1,
        (int) ($decoded['nextQueueNumber'] ?? 1)
    ),

    'nextAlternatingType' => in_array(
        $decoded['nextAlternatingType'] ?? '',
        ['senior', 'regular'],
        true
    )
        ? $decoded['nextAlternatingType']
        : 'senior',

    'consultationHistory' => is_array($decoded['consultationHistory'] ?? null)
        ? $decoded['consultationHistory']
        : [],
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

/**
 * Generate prioritized queue based on patient categories
 * 
 * Priority Order:
 * 1. Emergency (FIFO)
 * 2. PWD (FIFO)
 * 3. Alternate Senior and Regular (FIFO)
 * 4. Remaining Senior patients
 * 5. Remaining Regular patients
 * 
 * @param array $patients Array of patient records
 * @return array Prioritized queue with position numbers
 */
function generatePrioritizedQueue(
    array $patients,
    string $nextAlternatingType = 'senior'
    ): array {
    // Filter only waiting patients
    $waitingPatients = array_filter($patients, function ($patient) {
        return ($patient['status'] ?? '') === 'waiting';
    });

    // If no waiting patients, return empty array
    if (empty($waitingPatients)) {
        return [];
    }

    // Separate patients by category (preserving FIFO order)
    $emergencyQueue = [];
    $pwdQueue = [];
    $seniorQueue = [];
    $regularQueue = [];

    foreach ($waitingPatients as $patient) {
        $type = $patient['type'] ?? 'regular';
        switch ($type) {
            case 'emergency':
                $emergencyQueue[] = $patient;
                break;
            case 'pwd':
                $pwdQueue[] = $patient;
                break;
            case 'senior':
                $seniorQueue[] = $patient;
                break;
            default:
                $regularQueue[] = $patient;
                break;
        }
    }

    // Generate prioritized queue (sorted by priority, not by queue number)
    $prioritizedQueue = [];
    $position = 1;

    // 1. Add Emergency patients (FIFO)
    foreach ($emergencyQueue as $patient) {
        $patient['position'] = $position++;
        $prioritizedQueue[] = $patient;
    }

    // 2. Add PWD patients (FIFO)
    foreach ($pwdQueue as $patient) {
        $patient['position'] = $position++;
        $prioritizedQueue[] = $patient;
    }

    // 3. Alternate Senior and Regular patients (FIFO)
    $seniorIndex = 0;
    $regularIndex = 0;
    $seniorCount = count($seniorQueue);
    $regularCount = count($regularQueue);

    // Alternate between senior and regular while both have patients
    $turn = $nextAlternatingType;

while ($seniorIndex < $seniorCount && $regularIndex < $regularCount) {

    if ($turn === 'senior') {

        $seniorQueue[$seniorIndex]['position'] = $position++;
        $prioritizedQueue[] = $seniorQueue[$seniorIndex];
        $seniorIndex++;

        $turn = 'regular';

    } else {

        $regularQueue[$regularIndex]['position'] = $position++;
        $prioritizedQueue[] = $regularQueue[$regularIndex];
        $regularIndex++;

        $turn = 'senior';
    }
}

    // 4. Append remaining Senior patients
    while ($seniorIndex < $seniorCount) {
        $seniorQueue[$seniorIndex]['position'] = $position++;
        $prioritizedQueue[] = $seniorQueue[$seniorIndex];
        $seniorIndex++;
    }

    // 5. Append remaining Regular patients
    while ($regularIndex < $regularCount) {
        $regularQueue[$regularIndex]['position'] = $position++;
        $prioritizedQueue[] = $regularQueue[$regularIndex];
        $regularIndex++;
    }

    return $prioritizedQueue;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$state = loadState($stateFile);


// Generate prioritized queue for waiting patients
$prioritizedQueue = generatePrioritizedQueue($state['patients'],$state['nextAlternatingType']);

if ($method === 'GET') {
    // Return state with prioritized queue
    $responseState = $state;
    $responseState['prioritizedQueue'] = $prioritizedQueue;
    jsonResponse(['success' => true, 'state' => $responseState]);
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

        // Add new patient to the queue and increment this with the next queue number
        $state['patients'][] = [
            'id' => bin2hex(random_bytes(8)),
            'name' => $name,
            'queueNumber' => $state['nextQueueNumber'],
            'status' => 'waiting',
            'type' => $type,
            'patientNumber' => $patientNumber,
            'registrationStatus' => $registrationStatus,
        ];

        //This will increment the queue number for the next patient to be added
        $state['nextQueueNumber']++;
        saveState($stateFile, $state);
        
        // Generate prioritized queue
        $prioritizedQueue = generatePrioritizedQueue($state['patients'],$state['nextAlternatingType']);
        $responseState = $state;
        $responseState['prioritizedQueue'] = $prioritizedQueue;
        jsonResponse(['success' => true, 'state' => $responseState]);
        break;

    case 'serve-next':
        $nextPatientId = (string) ($payload['id'] ?? '');
        
        // Complete any currently serving patient
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

        // Serve the specific patient passed from frontend (the one at top of displayed queue)
        if ($nextPatientId !== '') {
            foreach ($state['patients'] as $index => $patient) {
                if (($patient['id'] ?? '') === $nextPatientId) {
                    // Add to consultation history before removing
                    $state['consultationHistory'][] = [
                        'id' => $patient['id'],
                        'name' => $patient['name'],
                        'queueNumber' => $patient['queueNumber'],
                        'patientNumber' => $patient['patientNumber'] ?? '',
                        'finishedAt' => date('Y-m-d H:i:s'),
                    ];
                    unset($state['patients'][$index]);
                    break;
                }
            }
        }

        $state['patients'] = array_values($state['patients']);

        saveState($stateFile, $state);
        
        // Generate prioritized queue (served patient is now removed)
        $prioritizedQueue = generatePrioritizedQueue($state['patients'], $state['nextAlternatingType']);
        $responseState = $state;
        $responseState['prioritizedQueue'] = $prioritizedQueue;
        jsonResponse(['success' => true, 'state' => $responseState]);
        break;

    case 'serve':
        $id = (string) ($payload['id'] ?? '');
        if ($id === '') {
            jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
            exit;
        }

        // Complete any currently serving patient
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

        // Serve the specific patient - REMOVE them from the queue entirely
        $prioritizedQueue = generatePrioritizedQueue($state['patients'], $state['nextAlternatingType']);
        $prioritizedIds = array_column($prioritizedQueue, 'id');
        
        // Only serve if the patient is in the prioritized queue (is actually waiting)
        if (in_array($id, $prioritizedIds, true)) {
            // Find and REMOVE the patient from the array (not just change status)
            foreach ($state['patients'] as $index => $patient) {
                if (($patient['id'] ?? '') === $id) {
                    // Add to consultation history before removing
                    $state['consultationHistory'][] = [
                        'id' => $patient['id'],
                        'name' => $patient['name'],
                        'queueNumber' => $patient['queueNumber'],
                        'patientNumber' => $patient['patientNumber'] ?? '',
                        'finishedAt' => date('Y-m-d H:i:s'),
                    ];
                    unset($state['patients'][$index]);
                    break;
                }
            }
        }

        $state['patients'] = array_values($state['patients']);

        saveState($stateFile, $state);
        
        // Generate prioritized queue (served patient is now removed)
        $prioritizedQueue = generatePrioritizedQueue($state['patients'], $state['nextAlternatingType']);
        $responseState = $state;
        $responseState['prioritizedQueue'] = $prioritizedQueue;
        jsonResponse(['success' => true, 'state' => $responseState]);
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
        
        // Generate prioritized queue
        $prioritizedQueue = generatePrioritizedQueue($state['patients'], $state['nextAlternatingType']);
        $responseState = $state;
        $responseState['prioritizedQueue'] = $prioritizedQueue;
        jsonResponse(['success' => true, 'state' => $responseState]);
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
        
        // Generate prioritized queue
        $prioritizedQueue = generatePrioritizedQueue($state['patients'], $state['nextAlternatingType']);
        $responseState = $state;
        $responseState['prioritizedQueue'] = $prioritizedQueue;
        jsonResponse(['success' => true, 'state' => $responseState]);
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
        
        // Generate prioritized queue
        $prioritizedQueue = generatePrioritizedQueue($state['patients'], $state['nextAlternatingType']);
        $responseState = $state;
        $responseState['prioritizedQueue'] = $prioritizedQueue;
        jsonResponse(['success' => true, 'state' => $responseState]);
        break;

    case 'reset':
        $state = getDefaultState();
        saveState($stateFile, $state);
        
        // Generate prioritized queue (will be empty)
        $prioritizedQueue = generatePrioritizedQueue($state['patients'], $state['nextAlternatingType']);
        $responseState = $state;
        $responseState['prioritizedQueue'] = $prioritizedQueue;
        jsonResponse(['success' => true, 'state' => $responseState]);
        break;

    default:
        jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
        break;
}
