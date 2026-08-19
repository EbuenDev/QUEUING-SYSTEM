<?php

// only tells the browser that the response is JSON, so it can be handled properly by the frontend
header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require __DIR__ . '/queue-helpers.php';

$stateFile = __DIR__ . '/queue.json';

$config = require __DIR__ . '/config.php';

$adminUsername = $config['admin_username'];
$adminPassword = $config['admin_password'];
$legacyAdminPassword = $config['legacy_admin_password'];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$state = loadState($stateFile);

if ($method === 'GET') {
    jsonResponse(['success' => true, 'state' => $state]);
    exit;
}

if ($method !== 'POST') {
    jsonError('Method not allowed', 405);
    exit;
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);
if (!is_array($payload)) {
    $payload = $_POST;
}

$action = $payload['action'] ?? '';
$requiresAdminAuth = in_array($action, ['add', 'edit', 'delete'], true);

if ($requiresAdminAuth && !isAdminAuthenticated()) {
    jsonError('Admin authentication required', 401);
    exit;
}

switch ($action) {
    case 'login':
        $username = trim((string) ($payload['username'] ?? ''));
        $password = (string) ($payload['password'] ?? '');
        $isValidLogin = $username === $adminUsername
            && ($password === $adminPassword || $password === $legacyAdminPassword);

        if ($isValidLogin) {
            $_SESSION['admin_authenticated'] = true;
            jsonResponse(['success' => true, 'message' => 'Login successful']);
        } else {
            $_SESSION['admin_authenticated'] = false;
            jsonError('Invalid username or password', 401);
        }
        break;

    case 'logout':
        unset($_SESSION['admin_authenticated']);
        jsonResponse(['success' => true, 'message' => 'Logged out']);
        break;

    case 'add':
        $fields = normalizePatientInput($payload);
        if ($fields['name'] === '') {
            jsonError('Patient name is required');
            exit;
        }

        $state['patients'][] = [
            'id' => bin2hex(random_bytes(8)),
            'name' => $fields['name'],
            'philHealthId' => $fields['philHealthId'],
            'queueNumber' => $state['nextQueueNumber'],
            'status' => 'waiting',
            'patientStatus' => $fields['type'],
            'type' => $fields['type'],
            'philHealthStatus' => $fields['philHealthStatus'],
        ];
        $state['nextQueueNumber']++;
        respondWithState($stateFile, $state);
        break;

    case 'serve-next':
        completeServingPatient($state);
        promoteFirstPatientWithStatus($state, 'waiting', 'serving');
        respondWithState($stateFile, $state);
        break;

    case 'serve':
        $id = requireId($payload);
        completeServingPatient($state);
        setPatientStatus($state, $id, 'serving');
        respondWithState($stateFile, $state);
        break;

    case 'finish':
        $id = requireId($payload);
        $completedPatient = takePatientBy($state, 'id', $id);

        if ($completedPatient !== null) {
            appendConsultationEntry($state, $completedPatient, [
                'philHealthId' => $completedPatient['philHealthId'] ?? '',
                'patientStatus' => $completedPatient['patientStatus'] ?? ($completedPatient['type'] ?? 'regular'),
                'philHealthStatus' => $completedPatient['philHealthStatus'] ?? 'no-philhealth',
                'icdCode' => trim((string) ($payload['icdCode'] ?? '')),
                'consultationDetails' => trim((string) ($payload['consultationDetails'] ?? '')),
            ]);
        }

        respondWithState($stateFile, $state);
        break;

    case 'skip':
        $id = requireId($payload);
        setPatientStatus($state, $id, 'skipped');
        respondWithState($stateFile, $state);
        break;

    case 'recall':
        $id = requireId($payload);
        setPatientStatus($state, $id, 'waiting');
        respondWithState($stateFile, $state);
        break;

    case 'edit-history':
        $id = requireId($payload, 'History ID is required');
        $icdCode = trim((string) ($payload['icdCode'] ?? ''));
        $consultationDetails = trim((string) ($payload['consultationDetails'] ?? ''));

        $historyUpdated = updateHistoryEntry($state, $id, function (array &$entry) use ($icdCode, $consultationDetails): void {
            $entry['icdCode'] = $icdCode;
            $entry['consultationDetails'] = $consultationDetails;
        });

        if (!$historyUpdated) {
            jsonError('History entry not found', 404);
            exit;
        }

        respondWithState($stateFile, $state);
        break;

    case 'edit':
        $id = (string) ($payload['id'] ?? '');
        $fields = normalizePatientInput($payload);

        if ($id === '' || $fields['name'] === '') {
            jsonError('Patient ID and a new name are required');
            exit;
        }

        updatePatientBy($state, 'id', $id, function (array &$patient) use ($fields): void {
            $patient['name'] = $fields['name'];
            $patient['philHealthId'] = $fields['philHealthId'];
            $patient['patientStatus'] = $fields['type'];
            $patient['type'] = $fields['type'];
            $patient['philHealthStatus'] = $fields['philHealthStatus'];
        });

        respondWithState($stateFile, $state);
        break;

    case 'delete':
        $id = requireId($payload);
        $state['patients'] = array_values(array_filter($state['patients'], function ($patient) use ($id) {
            return ($patient['id'] ?? '') !== $id;
        }));

        respondWithState($stateFile, $state);
        break;

    case 'reset':
        $state = getDefaultState();
        respondWithState($stateFile, $state);
        break;

    default:
        jsonError('Unknown action');
        break;
}
