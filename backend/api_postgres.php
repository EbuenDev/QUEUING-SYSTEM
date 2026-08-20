<?php

// PostgreSQL-based API for RHU II Patient Queuing System
header('Content-Type: application/json');

// CORS configuration for LAN access
// Set allowed origins - configure via ALLOWED_ORIGINS env var or default to all for LAN
$allowedOrigins = getenv('ALLOWED_ORIGINS') ? explode(',', getenv('ALLOWED_ORIGINS')) : ['*'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array('*', $allowedOrigins) || in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . (in_array('*', $allowedOrigins) ? '*' : $origin));
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');
}

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Configure session for LAN access
ini_set('session.cookie_samesite', 'Lax');
if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    ini_set('session.cookie_secure', '1');
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/database/Database.php';
require_once __DIR__ . '/database/config.php';

$config = require __DIR__ . '/database/config.php';

$adminUsername = $config['admin_username'];
$adminPassword = $config['admin_password'];
$legacyAdminPass = $config['legacy_admin_password'];

function getDefaultState(): array {
    return [
        'patients' => [],
        'nextQueueNumber' => 1,
        'consultationHistory' => [],
    ];
}

function loadStateFromDatabase(PDO $db): array {
    try {
        // Load patients
        $stmt = $db->prepare("SELECT id, name, phil_health_id as philHealthId, queue_number as queueNumber, 
                                    status, patient_status as patientStatus, patient_status as type, 
                                    phil_health_status as philHealthStatus, follow_up_status as followUpStatus, 
                                    follow_up_reason as followUpReason
                             FROM patients ORDER BY queue_number ASC");
        $stmt->execute();
        $patients = $stmt->fetchAll();
        
        // Convert array keys to match expected format
        $patients = array_map(function($patient) {
            return [
                'id' => $patient['id'],
                'name' => $patient['name'],
                'philHealthId' => $patient['philhealthid'],
                'queueNumber' => (int)$patient['queuenumber'],
                'status' => $patient['status'],
                'patientStatus' => $patient['patientstatus'],
                'type' => $patient['type'],
                'philHealthStatus' => $patient['philhealthstatus'],
                'followUpStatus' => $patient['followupstatus'] ?? 'none',
                'followUpReason' => $patient['followupreason'] ?? '',
            ];
        }, $patients);
        
        // Load consultation history
        $stmt = $db->prepare("SELECT id, name, queue_number as queueNumber, phil_health_id as philHealthId, 
                                    patient_status as patientStatus, phil_health_status as philHealthStatus, 
                                    icd_code as icdCode, consultation_details as consultationDetails, 
                                    finished_at as finishedAt 
                             FROM consultation_history ORDER BY finished_at DESC");
        $stmt->execute();
        $consultationHistory = $stmt->fetchAll();
        
        // Convert array keys to match expected format
        $consultationHistory = array_map(function($entry) {
            return [
                'id' => $entry['id'],
                'name' => $entry['name'],
                'queueNumber' => (int)$entry['queuenumber'],
                'philHealthId' => $entry['philhealthid'],
                'patientStatus' => $entry['patientstatus'],
                'philHealthStatus' => $entry['philhealthstatus'],
                'icdCode' => $entry['icdcode'],
                'consultationDetails' => $entry['consultationdetails'],
                'finishedAt' => $entry['finishedat'],
            ];
        }, $consultationHistory);
        
        // Load next queue number
        $stmt = $db->prepare("SELECT next_queue_number as nextQueueNumber FROM queue_management WHERE id = 1");
        $stmt->execute();
        $queueManagement = $stmt->fetch();
        $nextQueueNumber = $queueManagement ? (int)$queueManagement['nextqueuenumber'] : 1;
        
        return [
            'patients' => $patients,
            'nextQueueNumber' => $nextQueueNumber,
            'consultationHistory' => $consultationHistory,
        ];
    } catch (PDOException $e) {
        error_log('Error loading state from database: ' . $e->getMessage());
        return getDefaultState();
    }
}

function savePatientToDatabase(PDO $db, array $patient): void {
    try {
        $stmt = $db->prepare("INSERT INTO patients (id, name, phil_health_id, queue_number, status, patient_status, phil_health_status, follow_up_status, follow_up_reason) 
                             VALUES (:id, :name, :philHealthId, :queueNumber, :status, :patientStatus, :philHealthStatus, :followUpStatus, :followUpReason)
                             ON CONFLICT (id) DO UPDATE 
                             SET name = EXCLUDED.name,
                                 phil_health_id = EXCLUDED.phil_health_id,
                                 status = EXCLUDED.status,
                                 patient_status = EXCLUDED.patient_status,
                                 phil_health_status = EXCLUDED.phil_health_status,
                                 follow_up_status = EXCLUDED.follow_up_status,
                                 follow_up_reason = EXCLUDED.follow_up_reason");
        
        $stmt->execute([
            ':id' => $patient['id'],
            ':name' => $patient['name'],
            ':philHealthId' => $patient['philHealthId'],
            ':queueNumber' => $patient['queueNumber'],
            ':status' => $patient['status'],
            ':patientStatus' => $patient['patientStatus'],
            ':philHealthStatus' => $patient['philHealthStatus'],
            ':followUpStatus' => $patient['followUpStatus'] ?? 'none',
            ':followUpReason' => $patient['followUpReason'] ?? '',
        ]);
    } catch (PDOException $e) {
        error_log('Error saving patient to database: ' . $e->getMessage());
        throw $e;
    }
}

function deletePatientFromDatabase(PDO $db, string $id): void {
    try {
        $stmt = $db->prepare("DELETE FROM patients WHERE id = :id");
        $stmt->execute([':id' => $id]);
    } catch (PDOException $e) {
        error_log('Error deleting patient from database: ' . $e->getMessage());
        throw $e;
    }
}

function saveConsultationToDatabase(PDO $db, array $consultation): void {
    try {
        $stmt = $db->prepare("INSERT INTO consultation_history 
                             (id, name, queue_number, phil_health_id, patient_status, phil_health_status, icd_code, consultation_details, finished_at) 
                             VALUES (:id, :name, :queueNumber, :philHealthId, :patientStatus, :philHealthStatus, :icdCode, :consultationDetails, :finishedAt)
                             ON CONFLICT (id) DO UPDATE 
                             SET icd_code = EXCLUDED.icd_code,
                                 consultation_details = EXCLUDED.consultation_details");
        
        $stmt->execute([
            ':id' => $consultation['id'],
            ':name' => $consultation['name'],
            ':queueNumber' => $consultation['queueNumber'],
            ':philHealthId' => $consultation['philHealthId'],
            ':patientStatus' => $consultation['patientStatus'],
            ':philHealthStatus' => $consultation['philHealthStatus'],
            ':icdCode' => $consultation['icdCode'],
            ':consultationDetails' => $consultation['consultationDetails'],
            ':finishedAt' => $consultation['finishedAt'],
        ]);
    } catch (PDOException $e) {
        error_log('Error saving consultation to database: ' . $e->getMessage());
        throw $e;
    }
}

function updateQueueNumber(PDO $db, int $nextQueueNumber): void {
    try {
        $stmt = $db->prepare("UPDATE queue_management SET next_queue_number = :nextQueueNumber WHERE id = 1");
        $stmt->execute([':nextQueueNumber' => $nextQueueNumber]);
    } catch (PDOException $e) {
        error_log('Error updating queue number: ' . $e->getMessage());
        throw $e;
    }
}

function jsonResponse(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
}

function isAdminAuthenticated(): bool {
    return !empty($_SESSION['admin_authenticated']);
}

try {
    $db = Database::getInstance()->getConnection();
} catch (Exception $e) {
    jsonResponse(['success' => false, 'message' => 'Database connection failed'], 500);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$state = loadStateFromDatabase($db);

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
$requiresAdminAuth = in_array($action, ['add', 'edit', 'delete'], true);

if ($requiresAdminAuth && !isAdminAuthenticated()) {
    jsonResponse(['success' => false, 'message' => 'Admin authentication required'], 401);
    exit;
}

try {
    switch ($action) {
        case 'login':
            $username = trim((string) ($payload['username'] ?? ''));
            $password = (string) ($payload['password'] ?? '');
            $isValidLogin = ($username === $adminUsername && $password === $adminPassword)
                || ($username === $adminUsername && $password === $legacyAdminPass);

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

            $newPatient = [
                'id' => bin2hex(random_bytes(8)),
                'name' => $name,
                'philHealthId' => $philHealthId,
                'queueNumber' => $state['nextQueueNumber'],
                'status' => 'waiting',
                'patientStatus' => $type,
                'type' => $type,
                'philHealthStatus' => $philHealthStatus,
            ];

            savePatientToDatabase($db, $newPatient);
            updateQueueNumber($db, $state['nextQueueNumber'] + 1);
            
            $state = loadStateFromDatabase($db);
            jsonResponse(['success' => true, 'state' => $state]);
            break;

        case 'serve-next':
            $completedPatient = null;
            foreach ($state['patients'] as $index => $patient) {
                if (($patient['status'] ?? '') === 'serving') {
                    $completedPatient = $patient;
                    deletePatientFromDatabase($db, $patient['id']);
                    break;
                }
            }

            if ($completedPatient !== null) {
                $consultationEntry = [
                    'id' => $completedPatient['id'],
                    'name' => $completedPatient['name'],
                    'queueNumber' => $completedPatient['queueNumber'],
                    'philHealthId' => $completedPatient['philHealthId'] ?? '',
                    'patientStatus' => $completedPatient['patientStatus'] ?? ($completedPatient['type'] ?? 'regular'),
                    'philHealthStatus' => $completedPatient['philHealthStatus'] ?? 'no-philhealth',
                    'icdCode' => '',
                    'consultationDetails' => '',
                    'finishedAt' => date('Y-m-d H:i:s'),
                ];
                saveConsultationToDatabase($db, $consultationEntry);
            }

            // Reload state to get current patients
            $state = loadStateFromDatabase($db);
            
            // Update next patient to serving
            $nextPatient = null;
            foreach ($state['patients'] as $patient) {
                if (($patient['status'] ?? '') === 'waiting') {
                    $nextPatient = $patient;
                    break;
                }
            }

            if ($nextPatient) {
                $nextPatient['status'] = 'serving';
                savePatientToDatabase($db, $nextPatient);
            }

            $state = loadStateFromDatabase($db);
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
                    deletePatientFromDatabase($db, $patient['id']);
                    break;
                }
            }

            if ($completedPatient !== null) {
                $consultationEntry = [
                    'id' => $completedPatient['id'],
                    'name' => $completedPatient['name'],
                    'queueNumber' => $completedPatient['queueNumber'],
                    'philHealthId' => $completedPatient['philHealthId'] ?? '',
                    'patientStatus' => $completedPatient['patientStatus'] ?? ($completedPatient['type'] ?? 'regular'),
                    'philHealthStatus' => $completedPatient['philHealthStatus'] ?? 'no-philhealth',
                    'icdCode' => '',
                    'consultationDetails' => '',
                    'finishedAt' => date('Y-m-d H:i:s'),
                ];
                saveConsultationToDatabase($db, $consultationEntry);
            }

            // Reload state to get current patients
            $state = loadStateFromDatabase($db);
            
            // Set specified patient to serving
            foreach ($state['patients'] as $patient) {
                if (($patient['id'] ?? '') === $id) {
                    $patient['status'] = 'serving';
                    savePatientToDatabase($db, $patient);
                    break;
                }
            }

            $state = loadStateFromDatabase($db);
            jsonResponse(['success' => true, 'state' => $state]);
            break;

        case 'finish':
            $id = (string) ($payload['id'] ?? '');
            $icdCode = trim((string) ($payload['icdCode'] ?? ''));
            $consultationDetails = trim((string) ($payload['consultationDetails'] ?? ''));
            if ($id === '') {
                jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
                exit;
            }

            $completedPatient = null;
            foreach ($state['patients'] as $patient) {
                if (($patient['id'] ?? '') === $id) {
                    $completedPatient = $patient;
                    deletePatientFromDatabase($db, $patient['id']);
                    break;
                }
            }

            if ($completedPatient !== null) {
                $consultationEntry = [
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
                saveConsultationToDatabase($db, $consultationEntry);
            }

            $state = loadStateFromDatabase($db);
            jsonResponse(['success' => true, 'state' => $state]);
            break;

        case 'skip':
            $id = (string) ($payload['id'] ?? '');
            if ($id === '') {
                jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
                exit;
            }

            foreach ($state['patients'] as $patient) {
                if (($patient['id'] ?? '') === $id) {
                    $patient['status'] = 'skipped';
                    savePatientToDatabase($db, $patient);
                    break;
                }
            }

            $state = loadStateFromDatabase($db);
            jsonResponse(['success' => true, 'state' => $state]);
            break;

        case 'recall':
            $id = (string) ($payload['id'] ?? '');
            if ($id === '') {
                jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
                exit;
            }

            foreach ($state['patients'] as $patient) {
                if (($patient['id'] ?? '') === $id) {
                    $patient['status'] = 'waiting';
                    savePatientToDatabase($db, $patient);
                    break;
                }
            }

            $state = loadStateFromDatabase($db);
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
            foreach ($state['consultationHistory'] as $entry) {
                if (($entry['id'] ?? '') === $id) {
                    $consultationEntry = [
                        'id' => $entry['id'],
                        'name' => $entry['name'],
                        'queueNumber' => $entry['queueNumber'],
                        'philHealthId' => $entry['philHealthId'] ?? '',
                        'patientStatus' => $entry['patientStatus'] ?? 'regular',
                        'philHealthStatus' => $entry['philHealthStatus'] ?? 'no-philhealth',
                        'icdCode' => $icdCode,
                        'consultationDetails' => $consultationDetails,
                        'finishedAt' => $entry['finishedAt'],
                    ];
                    saveConsultationToDatabase($db, $consultationEntry);
                    $historyUpdated = true;
                    break;
                }
            }

            if (!$historyUpdated) {
                jsonResponse(['success' => false, 'message' => 'History entry not found'], 404);
                exit;
            }

            $state = loadStateFromDatabase($db);
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

            foreach ($state['patients'] as $patient) {
                if (($patient['id'] ?? '') === $id) {
                    $patient['name'] = $name;
                    $patient['philHealthId'] = $philHealthId;
                    $patient['patientStatus'] = $type;
                    $patient['type'] = $type;
                    $patient['philHealthStatus'] = $philHealthStatus;
                    savePatientToDatabase($db, $patient);
                    break;
                }
            }

            $state = loadStateFromDatabase($db);
            jsonResponse(['success' => true, 'state' => $state]);
            break;

        case 'delete':
            $id = (string) ($payload['id'] ?? '');
            if ($id === '') {
                jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
                exit;
            }

            deletePatientFromDatabase($db, $id);
            $state = loadStateFromDatabase($db);
            jsonResponse(['success' => true, 'state' => $state]);
            break;

        case 'reset':
            // Delete all patients
            $db->exec("DELETE FROM patients");
            // Reset queue number
            updateQueueNumber($db, 1);
            // Note: consultation history is preserved
            $state = loadStateFromDatabase($db);
            jsonResponse(['success' => true, 'state' => $state]);
            break;

        case 'send-to-followup':
            $id = (string) ($payload['id'] ?? '');
            $followUpReason = trim((string) ($payload['followUpReason'] ?? ''));
            
            if ($id === '') {
                jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
                exit;
            }

            $allowedReasons = ['Laboratory', 'Pharmacy', 'X-Ray', 'Other'];
            if (!in_array($followUpReason, $allowedReasons, true)) {
                $followUpReason = 'Other';
            }

            foreach ($state['patients'] as $patient) {
                if (($patient['id'] ?? '') === $id) {
                    $patient['status'] = 'follow-up';
                    $patient['followUpStatus'] = 'needs_lab';
                    $patient['followUpReason'] = $followUpReason;
                    savePatientToDatabase($db, $patient);
                    break;
                }
            }

            $state = loadStateFromDatabase($db);
            jsonResponse(['success' => true, 'state' => $state]);
            break;

        case 'ready-for-doctor':
            $id = (string) ($payload['id'] ?? '');
            
            if ($id === '') {
                jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
                exit;
            }

            foreach ($state['patients'] as $patient) {
                if (($patient['id'] ?? '') === $id) {
                    $patient['followUpStatus'] = 'ready_for_doctor';
                    savePatientToDatabase($db, $patient);
                    break;
                }
            }

            $state = loadStateFromDatabase($db);
            jsonResponse(['success' => true, 'state' => $state]);
            break;

        case 'call-followup':
            $id = (string) ($payload['id'] ?? '');
            
            if ($id === '') {
                jsonResponse(['success' => false, 'message' => 'Patient ID is required'], 400);
                exit;
            }

            // First, complete any currently serving patient
            $completedPatient = null;
            foreach ($state['patients'] as $patient) {
                if (($patient['status'] ?? '') === 'serving') {
                    $completedPatient = $patient;
                    break;
                }
            }

            if ($completedPatient !== null) {
                // Move the completed patient to consultation history if needed
                if (($completedPatient['followUpStatus'] ?? 'none') === 'none') {
                    // This was a normal patient, move to history
                    $consultationEntry = [
                        'id' => $completedPatient['id'],
                        'name' => $completedPatient['name'],
                        'queueNumber' => $completedPatient['queueNumber'],
                        'philHealthId' => $completedPatient['philHealthId'] ?? '',
                        'patientStatus' => $completedPatient['patientStatus'] ?? ($completedPatient['type'] ?? 'regular'),
                        'philHealthStatus' => $completedPatient['philHealthStatus'] ?? 'no-philhealth',
                        'icdCode' => '',
                        'consultationDetails' => '',
                        'finishedAt' => date('Y-m-d H:i:s'),
                    ];
                    saveConsultationToDatabase($db, $consultationEntry);
                    deletePatientFromDatabase($db, $completedPatient['id']);
                } else {
                    // This was a follow-up patient, just update status back to needs_lab
                    $completedPatient['status'] = 'follow-up';
                    $completedPatient['followUpStatus'] = 'needs_lab';
                    savePatientToDatabase($db, $completedPatient);
                }
            }

            // Reload state to get current patients
            $state = loadStateFromDatabase($db);
            
            // Now call the follow-up patient
            foreach ($state['patients'] as $patient) {
                if (($patient['id'] ?? '') === $id) {
                    $patient['status'] = 'serving';
                    $patient['followUpStatus'] = 'ready_for_doctor';
                    savePatientToDatabase($db, $patient);
                    break;
                }
            }

            $state = loadStateFromDatabase($db);
            jsonResponse(['success' => true, 'state' => $state]);
            break;

        default:
            jsonResponse(['success' => false, 'message' => 'Unknown action'], 400);
            break;
    }
} catch (PDOException $e) {
    error_log('Database error: ' . $e->getMessage());
    jsonResponse(['success' => false, 'message' => 'Database operation failed'], 500);
} catch (Exception $e) {
    error_log('General error: ' . $e->getMessage());
    jsonResponse(['success' => false, 'message' => 'Operation failed'], 500);
}