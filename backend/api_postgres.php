<?php

// PostgreSQL-based API for RHU II Patient Queuing System
header('Content-Type: application/json');

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/config.php';
$config = require __DIR__ . '/config.php';

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

$adminUsername = $config['admin_username'];
$adminPassword = $config['admin_password'];
$legacyAdminPass = $config['legacy_admin_password'];
$doctorUsername = $config['doctor_username'];
$doctorPassword = $config['doctor_password'];

// User management functions
function authenticateUser(?PDO $db, string $username, string $password): ?array {
    try {
        if ($db === null) {
            return null;
        }

        $stmt = $db->prepare("SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = :username");
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch();

        if ($user && $user['is_active'] && password_verify($password, $user['password_hash'])) {
            return [
                'id' => $user['id'],
                'username' => $user['username'],
                'full_name' => $user['full_name'],
                'role' => $user['role']
            ];
        }
        return null;
    } catch (PDOException $e) {
        error_log('User authentication error: ' . $e->getMessage());
        return null;
    }
}

function isSuperAdminAuthenticated(?PDO $db): bool {
    if (empty($_SESSION['user_id']) || empty($_SESSION['user_role'])) {
        return false;
    }
    return $_SESSION['user_role'] === 'super_admin';
}

function isAdminAuthenticated(): bool {
    // Check both old session-based and new database-based authentication
    if (!empty($_SESSION['admin_authenticated'])) {
        return true;
    }
    if (!empty($_SESSION['user_role']) && in_array($_SESSION['user_role'], ['admin', 'super_admin'])) {
        return true;
    }
    return false;
}

function isDoctorAuthenticated(): bool {
    // Check both old session-based and new database-based authentication
    if (!empty($_SESSION['doctor_authenticated'])) {
        return true;
    }
    if (!empty($_SESSION['user_role']) && $_SESSION['user_role'] === 'doctor') {
        return true;
    }
    return false;
}

function getDefaultState(): array {
    return [
        'patients' => [],
        'nextQueueNumber' => 1,
        'consultationHistory' => [],
        'videoConfig' => [
            'id' => 1,
            'playlistId' => '',
            'playlistTitle' => '',
            'playlistUrl' => '',
            'isEnabled' => false,
            'updatedAt' => null,
            'updatedBy' => null
        ],
    ];
}

function loadStateFromDatabase(?PDO $db): array {
    try {
        if ($db === null) {
            return getDefaultState();
        }

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
                'philHealthId' => $patient['philhealthid'] ?? '',
                'queueNumber' => (int)$patient['queuenumber'],
                'status' => $patient['status'],
                'patientStatus' => $patient['patientstatus'],
                'type' => $patient['patientstatus'], // Use patientStatus as type
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

        // Load video configuration
        $videoConfig = loadVideoConfig($db);

        return [
            'patients' => $patients,
            'nextQueueNumber' => $nextQueueNumber,
            'consultationHistory' => $consultationHistory,
            'videoConfig' => $videoConfig,
        ];
    } catch (PDOException $e) {
        error_log('Error loading state from database: ' . $e->getMessage());
        return getDefaultState();
    }
}

function savePatientToDatabase(?PDO $db, array $patient): void {
    try {
        if ($db === null) {
            error_log('Database not available - cannot save patient');
            return;
        }

        $stmt = $db->prepare("INSERT INTO patients (id, name, phil_health_id, queue_number, status, patient_status, phil_health_status, follow_up_status, follow_up_reason)
                             VALUES (:id, :name, :philHealthId, :queueNumber, :status, :patientStatus, :philHealthStatus, :followUpStatus, :followUpReason)
                             ON CONFLICT (id) DO UPDATE
                             SET name = EXCLUDED.name,
                                 phil_health_id = EXCLUDED.phil_health_id,
                                 queue_number = EXCLUDED.queue_number,
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

function deletePatientFromDatabase(?PDO $db, string $id): void {
    try {
        if ($db === null) {
            error_log('Database not available - cannot delete patient');
            return;
        }

        $stmt = $db->prepare("DELETE FROM patients WHERE id = :id");
        $stmt->execute([':id' => $id]);
    } catch (PDOException $e) {
        error_log('Error deleting patient from database: ' . $e->getMessage());
        throw $e;
    }
}

function saveConsultationToDatabase(?PDO $db, array $consultation): void {
    try {
        if ($db === null) {
            error_log('Database not available - cannot save consultation');
            return;
        }

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

function updateQueueNumber(?PDO $db, int $nextQueueNumber): void {
    try {
        if ($db === null) {
            error_log('Database not available - cannot update queue number');
            return;
        }

        $stmt = $db->prepare("UPDATE queue_management SET next_queue_number = :nextQueueNumber WHERE id = 1");
        $stmt->execute([':nextQueueNumber' => $nextQueueNumber]);
    } catch (PDOException $e) {
        error_log('Error updating queue number: ' . $e->getMessage());
        throw $e;
    }
}

function ensureMessagesTable(?PDO $db): void {
    if ($db === null) return;
    try {
        $db->exec("CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            sender_role VARCHAR(50) NOT NULL,
            receiver_role VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");
    } catch (Exception $e) {}
}


function loadMessagesFromDatabase(?PDO $db, string $userRole, int $lastId = 0): array {
    try {
        if ($db === null) {
            return [];
        }

        ensureMessagesTable($db);

        if ($lastId > 0) {
            $stmt = $db->prepare("SELECT id, sender_role, receiver_role, message, is_read, created_at
                                 FROM messages
                                 WHERE (sender_role = :userRole OR receiver_role = :userRole)
                                   AND id > :lastId
                                 ORDER BY id ASC");
            $stmt->execute([
                ':userRole' => $userRole,
                ':lastId' => $lastId
            ]);
            $messages = $stmt->fetchAll();
        } else {
            // Fetch recent 100 messages chronologically
            $stmt = $db->prepare("SELECT id, sender_role, receiver_role, message, is_read, created_at
                                 FROM (
                                     SELECT id, sender_role, receiver_role, message, is_read, created_at
                                     FROM messages
                                     WHERE (sender_role = :userRole OR receiver_role = :userRole)
                                     ORDER BY id DESC
                                     LIMIT 100
                                 ) sub
                                 ORDER BY id ASC");
            $stmt->execute([':userRole' => $userRole]);
            $messages = $stmt->fetchAll();
        }

        return array_map(function($message) {
            return [
                'id' => (int)$message['id'],
                'senderRole' => $message['sender_role'],
                'receiverRole' => $message['receiver_role'],
                'message' => $message['message'],
                'isRead' => (bool)$message['is_read'],
                'createdAt' => $message['created_at']
            ];
        }, $messages);
    } catch (PDOException $e) {
        error_log('Error loading messages from database: ' . $e->getMessage());
        return [];
    }
}

function saveMessageToDatabase(?PDO $db, string $senderRole, string $receiverRole, string $message): array {
    try {
        if ($db === null) {
            error_log('Database not available - cannot save message');
            throw new Exception('Database unavailable');
        }

        ensureMessagesTable($db);

        $stmt = $db->prepare("INSERT INTO messages (sender_role, receiver_role, message, is_read, created_at)
                             VALUES (:senderRole, :receiverRole, :message, false, CURRENT_TIMESTAMP)
                             RETURNING id, sender_role, receiver_role, message, is_read, created_at");
        $stmt->execute([
            ':senderRole' => $senderRole,
            ':receiverRole' => $receiverRole,
            ':message' => $message
        ]);
        $saved = $stmt->fetch();
        if ($saved) {
            return [
                'id' => (int)$saved['id'],
                'senderRole' => $saved['sender_role'],
                'receiverRole' => $saved['receiver_role'],
                'message' => $saved['message'],
                'isRead' => (bool)$saved['is_read'],
                'createdAt' => $saved['created_at']
            ];
        }
        return [];
    } catch (PDOException $e) {
        error_log('Error saving message to database: ' . $e->getMessage());
        throw $e;
    }
}

function markMessagesAsRead(?PDO $db, string $userRole): array {
    try {
        if ($db === null) {
            return [];
        }

        $stmt = $db->prepare("UPDATE messages SET is_read = true
                             WHERE receiver_role = :userRole AND is_read = false
                             RETURNING id");
        $stmt->execute([':userRole' => $userRole]);
        $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);
        return array_map('intval', $rows ?: []);
    } catch (PDOException $e) {
        error_log('Error marking messages as read: ' . $e->getMessage());
        return [];
    }
}

function getMaxReadMessageId(?PDO $db, string $senderRole): int {
    try {
        if ($db === null) {
            return 0;
        }

        $stmt = $db->prepare("SELECT COALESCE(MAX(id), 0) as max_id FROM messages
                             WHERE sender_role = :senderRole AND is_read = true");
        $stmt->execute([':senderRole' => $senderRole]);
        $result = $stmt->fetch();
        return (int)($result['max_id'] ?? 0);
    } catch (PDOException $e) {
        error_log('Error getting max read message id: ' . $e->getMessage());
        return 0;
    }
}

function getUnreadMessageCount(?PDO $db, string $userRole): int {
    try {
        if ($db === null) {
            return 0;
        }

        $stmt = $db->prepare("SELECT COUNT(*) as count FROM messages
                             WHERE receiver_role = :userRole AND is_read = false");
        $stmt->execute([':userRole' => $userRole]);
        $result = $stmt->fetch();
        return (int)($result['count'] ?? 0);
    } catch (PDOException $e) {
        error_log('Error getting unread message count: ' . $e->getMessage());
        return 0;
    }
}

function cleanupOldMessages(?PDO $db): void {
    try {
        if ($db === null) {
            return;
        }

        // Delete messages older than 24 hours
        $stmt = $db->prepare("DELETE FROM messages
                             WHERE created_at < NOW() - INTERVAL '24 hours'");
        $stmt->execute();
        error_log('Cleaned up old messages');
    } catch (PDOException $e) {
        error_log('Error cleaning up old messages: ' . $e->getMessage());
    }
}

function loadVideoConfig(?PDO $db): array {
    try {
        if ($db === null) {
            return [
                'id' => 1,
                'playlistId' => '',
                'playlistTitle' => '',
                'playlistUrl' => '',
                'isEnabled' => false,
                'updatedAt' => null,
                'updatedBy' => null
            ];
        }

        // Create table if it does not exist
        $db->exec("CREATE TABLE IF NOT EXISTS video_config (
            id INT PRIMARY KEY DEFAULT 1,
            playlist_id TEXT,
            playlist_title VARCHAR(255),
            playlist_url TEXT,
            is_enabled BOOLEAN DEFAULT FALSE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_by VARCHAR(50),
            last_command VARCHAR(50) DEFAULT '',
            command_seq BIGINT DEFAULT 0,
            is_paused BOOLEAN DEFAULT FALSE
        )");

        // Add columns and migrate column types if table already existed
        try {
            $db->exec("ALTER TABLE video_config ALTER COLUMN playlist_id TYPE TEXT");
            $db->exec("ALTER TABLE video_config ALTER COLUMN playlist_url TYPE TEXT");
            $db->exec("ALTER TABLE video_config ADD COLUMN IF NOT EXISTS last_command VARCHAR(50) DEFAULT ''");
            $db->exec("ALTER TABLE video_config ADD COLUMN IF NOT EXISTS command_seq BIGINT DEFAULT 0");
            $db->exec("ALTER TABLE video_config ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE");
        } catch (Exception $e) {}

        $stmt = $db->prepare("SELECT id, playlist_id, playlist_title, playlist_url, is_enabled, updated_at, updated_by, last_command, command_seq, is_paused
                             FROM video_config
                             WHERE id = 1");
        $stmt->execute();
        $config = $stmt->fetch();

        if ($config) {
            $playlistId = $config['playlist_id'] ?? '';

            // Auto-heal / resolve legacy or raw playlist IDs (e.g. PL..., UU..., etc.) to playable video IDs
            if ($playlistId !== '' && preg_match('/^(PL|UU|FL|RD|OL|TL)[a-zA-Z0-9_-]{10,}$/i', $playlistId)) {
                $resolvedIds = fetchPlaylistVideoIds($playlistId);
                if (!empty($resolvedIds)) {
                    $playlistId = implode(',', $resolvedIds);
                    try {
                        $upStmt = $db->prepare("UPDATE video_config SET playlist_id = :pId WHERE id = 1");
                        $upStmt->execute([':pId' => $playlistId]);
                    } catch (Exception $e) {}
                }
            }

            return [
                'id' => (int)$config['id'],
                'playlistId' => $playlistId,
                'playlistTitle' => $config['playlist_title'],
                'playlistUrl' => $config['playlist_url'],
                'isEnabled' => (bool)$config['is_enabled'],
                'updatedAt' => $config['updated_at'],
                'updatedBy' => $config['updated_by'],
                'lastCommand' => $config['last_command'] ?? '',
                'commandSeq' => (int)($config['command_seq'] ?? 0),
                'isPaused' => (bool)($config['is_paused'] ?? false),
            ];
        }

        return [
            'id' => 1,
            'playlistId' => '',
            'playlistTitle' => '',
            'playlistUrl' => '',
            'isEnabled' => false,
            'updatedAt' => null,
            'updatedBy' => null,
            'lastCommand' => '',
            'commandSeq' => 0,
            'isPaused' => false
        ];
    } catch (PDOException $e) {
        error_log('Error loading video config: ' . $e->getMessage());
        return [
            'id' => 1,
            'playlistId' => '',
            'playlistTitle' => '',
            'playlistUrl' => '',
            'isEnabled' => false,
            'updatedAt' => null,
            'updatedBy' => null,
            'lastCommand' => '',
            'commandSeq' => 0,
            'isPaused' => false
        ];
    }
}

function saveVideoConfig(?PDO $db, array $config): void {
    try {
        if ($db === null) {
            error_log('Database not available - cannot save video config');
            return;
        }

        $stmt = $db->prepare("INSERT INTO video_config (id, playlist_id, playlist_title, playlist_url, is_enabled, updated_by, last_command, command_seq, is_paused)
                             VALUES (1, :playlistId, :playlistTitle, :playlistUrl, :isEnabled, :updatedBy, :lastCommand, 1, false)
                             ON CONFLICT (id) DO UPDATE
                             SET playlist_id = EXCLUDED.playlist_id,
                                 playlist_title = EXCLUDED.playlist_title,
                                 playlist_url = EXCLUDED.playlist_url,
                                 is_enabled = EXCLUDED.is_enabled,
                                 updated_by = EXCLUDED.updated_by,
                                 updated_at = CURRENT_TIMESTAMP,
                                 last_command = EXCLUDED.last_command,
                                 command_seq = COALESCE(video_config.command_seq, 0) + 1,
                                 is_paused = false");

        $stmt->execute([
            ':playlistId' => $config['playlistId'],
            ':playlistTitle' => $config['playlistTitle'],
            ':playlistUrl' => $config['playlistUrl'],
            ':isEnabled' => $config['isEnabled'] ? 'true' : 'false',
            ':updatedBy' => $config['updatedBy'],
            ':lastCommand' => $config['isEnabled'] ? 'play' : 'stop'
        ]);
    } catch (PDOException $e) {
        error_log('Error saving video config: ' . $e->getMessage());
        throw $e;
    }
}

function fetchPlaylistVideoIds(string $playlistId): array {
    $cleanId = trim($playlistId);
    if ($cleanId === '') {
        return [];
    }

    $url = "https://www.youtube.com/playlist?list=" . urlencode($cleanId);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!$html || $httpCode !== 200) {
        return [];
    }

    // Match all videoId occurrences in YouTube playlist page initialData
    preg_match_all('/"videoId":"([a-zA-Z0-9_-]{11})"/', $html, $matches);
    if (empty($matches[1])) {
        return [];
    }

    $uniqueIds = [];
    foreach ($matches[1] as $id) {
        if (!in_array($id, $uniqueIds, true)) {
            $uniqueIds[] = $id;
        }
    }

    // Cap at 50 videos to keep embed URL length well within HTTP GET safety limits
    if (count($uniqueIds) > 50) {
        $uniqueIds = array_slice($uniqueIds, 0, 50);
    }

    return $uniqueIds;
}

function extractYoutubePlaylistId(string $url): ?string {
    $input = trim($url);
    if ($input === '') {
        return null;
    }

    // 1. YouTube playlist query param: ?list=... or &list=...
    if (preg_match('/[?&]list=([a-zA-Z0-9_-]+)/', $input, $matches)) {
        $rawPlaylistId = $matches[1];
        $videoIds = fetchPlaylistVideoIds($rawPlaylistId);
        if (!empty($videoIds)) {
            return implode(',', $videoIds);
        }
        return $rawPlaylistId;
    }

    // 2. Direct YouTube playlist ID (e.g. PL..., UU..., FL..., RD..., etc.)
    if (preg_match('/^(PL|UU|FL|RD|OL|TL)[a-zA-Z0-9_-]{10,}$/i', $input)) {
        $videoIds = fetchPlaylistVideoIds($input);
        if (!empty($videoIds)) {
            return implode(',', $videoIds);
        }
        return $input;
    }

    // 3. Multiple video URLs or video IDs (separated by comma, newline, pipe, or space)
    $tokens = preg_split('/[\s,\|\n\r]+/', $input);
    $extractedVideos = [];
    foreach ($tokens as $token) {
        $token = trim($token);
        if ($token === '') continue;

        if (preg_match('#youtu\.be/([a-zA-Z0-9_-]{11})#', $token, $m)) {
            $extractedVideos[] = $m[1];
        } elseif (preg_match('/[?&]v=([a-zA-Z0-9_-]{11})/', $token, $m)) {
            $extractedVideos[] = $m[1];
        } elseif (preg_match('#/embed/([a-zA-Z0-9_-]{11})#', $token, $m)) {
            $extractedVideos[] = $m[1];
        } elseif (preg_match('/^[a-zA-Z0-9_-]{11}$/', $token)) {
            $extractedVideos[] = $token;
        }
    }

    if (!empty($extractedVideos)) {
        $unique = array_values(array_unique($extractedVideos));
        return implode(',', $unique);
    }

    // 4. Single video URL formats
    if (preg_match('/[?&]v=([a-zA-Z0-9_-]{11})/', $input, $matches)) {
        return $matches[1];
    }
    if (preg_match('#youtu\.be/([a-zA-Z0-9_-]{11})#', $input, $matches)) {
        return $matches[1];
    }
    if (preg_match('#/embed/([a-zA-Z0-9_-]{11})#', $input, $matches)) {
        return $matches[1];
    }

    return null;
}

// ========== Playlist Library Functions ==========

function loadPlaylistLibrary(?PDO $db): array {
    try {
        if ($db === null) {
            return [];
        }

        // Create table if it doesn't exist
        $db->exec("CREATE TABLE IF NOT EXISTS playlist_library (
            id SERIAL PRIMARY KEY,
            playlist_id TEXT NOT NULL,
            playlist_title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
            playlist_url TEXT NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            added_by VARCHAR(50) DEFAULT 'admin'
        )");

        try {
            $db->exec("ALTER TABLE playlist_library ALTER COLUMN playlist_id TYPE TEXT");
            $db->exec("ALTER TABLE playlist_library ALTER COLUMN playlist_url TYPE TEXT");
        } catch (Exception $e) {}

        $stmt = $db->prepare("SELECT id, playlist_id, playlist_title, playlist_url, added_at, added_by
                             FROM playlist_library
                             ORDER BY added_at DESC");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $library = [];
        foreach ($rows as $row) {
            $library[] = [
                'id' => (int)$row['id'],
                'playlistId' => $row['playlist_id'],
                'playlistTitle' => $row['playlist_title'],
                'playlistUrl' => $row['playlist_url'],
                'addedAt' => $row['added_at'],
                'addedBy' => $row['added_by']
            ];
        }

        return $library;
    } catch (PDOException $e) {
        error_log('Error loading playlist library: ' . $e->getMessage());
        return [];
    }
}

function addToPlaylistLibrary(?PDO $db, array $playlist): ?int {
    try {
        if ($db === null) {
            error_log('Database not available - cannot add to playlist library');
            return null;
        }

        // Create table if it doesn't exist
        $db->exec("CREATE TABLE IF NOT EXISTS playlist_library (
            id SERIAL PRIMARY KEY,
            playlist_id VARCHAR(100) NOT NULL,
            playlist_title VARCHAR(255) NOT NULL DEFAULT 'Untitled',
            playlist_url VARCHAR(500) NOT NULL,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            added_by VARCHAR(50) DEFAULT 'admin'
        )");

        // Check if playlist already exists
        $checkStmt = $db->prepare("SELECT id FROM playlist_library WHERE playlist_id = :playlistId");
        $checkStmt->execute([':playlistId' => $playlist['playlistId']]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            // Update existing entry
            $stmt = $db->prepare("UPDATE playlist_library
                                 SET playlist_title = :playlistTitle,
                                     playlist_url = :playlistUrl,
                                     added_by = :addedBy
                                 WHERE playlist_id = :playlistId");
            $stmt->execute([
                ':playlistTitle' => $playlist['playlistTitle'],
                ':playlistUrl' => $playlist['playlistUrl'],
                ':addedBy' => $playlist['addedBy'],
                ':playlistId' => $playlist['playlistId']
            ]);
            return (int)$existing['id'];
        }

        $stmt = $db->prepare("INSERT INTO playlist_library (playlist_id, playlist_title, playlist_url, added_by)
                             VALUES (:playlistId, :playlistTitle, :playlistUrl, :addedBy)
                             RETURNING id");
        $stmt->execute([
            ':playlistId' => $playlist['playlistId'],
            ':playlistTitle' => $playlist['playlistTitle'],
            ':playlistUrl' => $playlist['playlistUrl'],
            ':addedBy' => $playlist['addedBy']
        ]);
        $result = $stmt->fetch();
        return $result ? (int)$result['id'] : null;
    } catch (PDOException $e) {
        error_log('Error adding to playlist library: ' . $e->getMessage());
        throw $e;
    }
}

function deleteFromPlaylistLibrary(?PDO $db, int $id): bool {
    try {
        if ($db === null) {
            return false;
        }

        $stmt = $db->prepare("DELETE FROM playlist_library WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return $stmt->rowCount() > 0;
    } catch (PDOException $e) {
        error_log('Error deleting from playlist library: ' . $e->getMessage());
        return false;
    }
}

function createNotification(?PDO $db, array $notification): void {
    try {
        if ($db === null) {
            error_log('Database not available - cannot create notification');
            return;
        }

        error_log('Creating notification: ' . json_encode($notification));
        $stmt = $db->prepare("INSERT INTO notifications (queue_number, patient_name, message, notification_type, is_read)
                             VALUES (:queueNumber, :patientName, :message, :notificationType, :isRead)");

        $stmt->execute([
            ':queueNumber' => $notification['queueNumber'] ?? null,
            ':patientName' => $notification['patientName'] ?? '',
            ':message' => $notification['message'] ?? '',
            ':notificationType' => $notification['notificationType'] ?? 'patient_call',
            ':isRead' => false,  // Boolean, not string
        ]);
        error_log('Notification created successfully');
    } catch (PDOException $e) {
        error_log('Error creating notification: ' . $e->getMessage());
        // Don't throw - notifications should not break the main flow
    }
}

function getUnreadNotifications(?PDO $db, int $lastNotificationId = 0): array {
    try {
        if ($db === null) {
            return [];
        }

        $stmt = $db->prepare("SELECT id, queue_number, patient_name, message, notification_type, created_at
                             FROM notifications
                             WHERE id > :lastNotificationId AND is_read = false
                             ORDER BY id ASC");
        $stmt->execute([':lastNotificationId' => $lastNotificationId]);
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        error_log('Error fetching notifications: ' . $e->getMessage());
        return [];
    }
}

function markNotificationsAsRead(?PDO $db, array $notificationIds): void {
    try {
        if (empty($notificationIds) || $db === null) {
            return;
        }
        $placeholders = implode(',', array_fill(0, count($notificationIds), '?'));
        $stmt = $db->prepare("UPDATE notifications SET is_read = true WHERE id IN ($placeholders)");
        $stmt->execute($notificationIds);
    } catch (PDOException $e) {
        error_log('Error marking notifications as read: ' . $e->getMessage());
    }
}

function ensurePrescriptionsTable(?PDO $db): void {
    if ($db === null) return;
    try {
        $db->exec("CREATE TABLE IF NOT EXISTS yakap_prescriptions (
            id VARCHAR(50) PRIMARY KEY,
            rx_number VARCHAR(50) NOT NULL UNIQUE,
            patient_id VARCHAR(50),
            patient_name VARCHAR(255) NOT NULL,
            patient_age INTEGER,
            patient_sex VARCHAR(20),
            patient_address VARCHAR(255),
            phil_health_id VARCHAR(50),
            patient_classification VARCHAR(30) DEFAULT 'regular',
            diagnosis TEXT,
            clinical_notes TEXT,
            medications TEXT NOT NULL DEFAULT '[]',
            doctor_name VARCHAR(255) DEFAULT 'Doc. Renz Sale, MD',
            doctor_prc VARCHAR(50) DEFAULT 'PRC No. 0148921',
            doctor_ptr VARCHAR(50) DEFAULT 'PTR No. 8392104',
            doctor_s2 VARCHAR(50),
            file_name VARCHAR(255),
            pdf_path TEXT,
            png_path TEXT,
            png_paths TEXT,
            queue_number INTEGER,
            status VARCHAR(30) DEFAULT 'active',
            printed_at TIMESTAMP,
            printed_by VARCHAR(100),
            dispensed_at TIMESTAMP,
            dispensed_by VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        // Add columns if table already existed without them
        $db->exec("ALTER TABLE yakap_prescriptions ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)");
        $db->exec("ALTER TABLE yakap_prescriptions ADD COLUMN IF NOT EXISTS pdf_path TEXT");
        $db->exec("ALTER TABLE yakap_prescriptions ADD COLUMN IF NOT EXISTS png_path TEXT");
        $db->exec("ALTER TABLE yakap_prescriptions ADD COLUMN IF NOT EXISTS png_paths TEXT");
        $db->exec("ALTER TABLE yakap_prescriptions ADD COLUMN IF NOT EXISTS queue_number INTEGER");
        $db->exec("ALTER TABLE yakap_prescriptions ADD COLUMN IF NOT EXISTS printed_at TIMESTAMP");
        $db->exec("ALTER TABLE yakap_prescriptions ADD COLUMN IF NOT EXISTS printed_by VARCHAR(100)");

        $db->exec("CREATE INDEX IF NOT EXISTS idx_yakap_prescriptions_rx ON yakap_prescriptions(rx_number)");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_yakap_prescriptions_patient ON yakap_prescriptions(patient_name)");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_yakap_prescriptions_status ON yakap_prescriptions(status)");
        $db->exec("CREATE INDEX IF NOT EXISTS idx_yakap_prescriptions_created ON yakap_prescriptions(created_at)");
    } catch (Exception $e) {
        error_log('Error ensuring prescriptions table: ' . $e->getMessage());
    }
}

function loadPrescriptionsFromDatabase(?PDO $db): array {
    try {
        if ($db === null) {
            return [];
        }
        ensurePrescriptionsTable($db);

        $stmt = $db->prepare("SELECT id, rx_number, patient_id, patient_name, patient_age, patient_sex,
                                     patient_address, phil_health_id, patient_classification, diagnosis,
                                     clinical_notes, medications, doctor_name, doctor_prc, doctor_ptr,
                                     doctor_s2, file_name, pdf_path, png_path, png_paths, queue_number,
                                     status, printed_at, printed_by, dispensed_at, dispensed_by, created_at, updated_at
                              FROM yakap_prescriptions
                              ORDER BY created_at DESC");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        return array_map(function($row) {
            $meds = json_decode($row['medications'] ?? '[]', true);
            if (!is_array($meds)) $meds = [];
            $pngPages = json_decode($row['png_paths'] ?? '[]', true);
            if (!is_array($pngPages)) {
                $pngPages = !empty($row['png_path']) ? [$row['png_path']] : [];
            }
            return [
                'id' => $row['id'],
                'rxNumber' => $row['rx_number'],
                'patientId' => $row['patient_id'] ?? '',
                'patientName' => $row['patient_name'],
                'patientAge' => $row['patient_age'] ? (int)$row['patient_age'] : null,
                'patientSex' => $row['patient_sex'] ?? '',
                'patientAddress' => $row['patient_address'] ?? '',
                'philHealthId' => $row['phil_health_id'] ?? '',
                'patientClassification' => $row['patient_classification'] ?? 'regular',
                'diagnosis' => $row['diagnosis'] ?? '',
                'clinicalNotes' => $row['clinical_notes'] ?? '',
                'medications' => $meds,
                'doctorName' => $row['doctor_name'] ?? 'Doc. Renz Sale, MD',
                'doctorPrc' => $row['doctor_prc'] ?? 'PRC No. 0148921',
                'doctorPtr' => $row['doctor_ptr'] ?? 'PTR No. 8392104',
                'doctorS2' => $row['doctor_s2'] ?? '',
                'fileName' => $row['file_name'] ?? '',
                'pdfPath' => $row['pdf_path'] ?? '',
                'pngPath' => $row['png_path'] ?? '',
                'pngPaths' => $pngPages,
                'queueNumber' => !empty($row['queue_number']) ? (int)$row['queue_number'] : null,
                'status' => $row['status'] ?? 'active',
                'printedAt' => $row['printed_at'] ?? null,
                'printedBy' => $row['printed_by'] ?? null,
                'dispensedAt' => $row['dispensed_at'] ?? null,
                'dispensedBy' => $row['dispensed_by'] ?? null,
                'createdAt' => $row['created_at'],
                'updatedAt' => $row['updated_at']
            ];
        }, $rows);
    } catch (PDOException $e) {
        error_log('Error loading prescriptions: ' . $e->getMessage());
        return [];
    }
}

function uploadPrescriptionPdf(?PDO $db, array $payload): array {
    ensurePrescriptionsTable($db);

    $id = 'rx_' . uniqid() . bin2hex(random_bytes(2));
    $rxNumber = 'YK-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

    $patientName = trim((string)($payload['patientName'] ?? ''));
    if ($patientName === '') {
        $patientName = 'Patient ' . date('h:i A');
    }
    $queueNumber = !empty($payload['queueNumber']) ? (int)$payload['queueNumber'] : null;
    $notes = trim((string)($payload['notes'] ?? ''));
    $fileName = trim((string)($payload['fileName'] ?? 'yakap_prescription.pdf'));
    $doctorName = trim((string)($payload['doctorName'] ?? 'Doc. Renz Sale, MD'));

    // Upload folder inside public/uploads/prescriptions
    $uploadDir = __DIR__ . '/../public/uploads/prescriptions';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0777, true);
    }

    $pdfPath = '';
    if (!empty($payload['pdfBase64'])) {
        $pdfData = $payload['pdfBase64'];
        if (strpos($pdfData, ';base64,') !== false) {
            $pdfData = explode(';base64,', $pdfData)[1];
        }
        $decodedPdf = base64_decode($pdfData);
        if ($decodedPdf !== false) {
            $pdfFileName = $id . '.pdf';
            @file_put_contents($uploadDir . '/' . $pdfFileName, $decodedPdf);
            $pdfPath = 'uploads/prescriptions/' . $pdfFileName;
        }
    }

    $pngPaths = [];
    $rawPngPages = $payload['pngPages'] ?? [];
    if (is_array($rawPngPages)) {
        foreach ($rawPngPages as $idx => $pngDataUrl) {
            if (empty($pngDataUrl)) continue;
            $pngData = $pngDataUrl;
            if (strpos($pngData, ';base64,') !== false) {
                $pngData = explode(';base64,', $pngData)[1];
            }
            $decodedPng = base64_decode($pngData);
            if ($decodedPng !== false) {
                $pngFileName = $id . '_page_' . ($idx + 1) . '.png';
                @file_put_contents($uploadDir . '/' . $pngFileName, $decodedPng);
                $pngPaths[] = 'uploads/prescriptions/' . $pngFileName;
            }
        }
    }

    $primaryPng = !empty($pngPaths) ? $pngPaths[0] : '';

    if ($db !== null) {
        $stmt = $db->prepare("INSERT INTO yakap_prescriptions
            (id, rx_number, patient_name, queue_number, clinical_notes, file_name,
             pdf_path, png_path, png_paths, doctor_name, status, created_at, updated_at)
            VALUES
            (:id, :rx_number, :patient_name, :queue_number, :clinical_notes, :file_name,
             :pdf_path, :png_path, :png_paths, :doctor_name, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");

        $stmt->execute([
            ':id' => $id,
            ':rx_number' => $rxNumber,
            ':patient_name' => $patientName,
            ':queue_number' => $queueNumber,
            ':clinical_notes' => $notes,
            ':file_name' => $fileName,
            ':pdf_path' => $pdfPath,
            ':png_path' => $primaryPng,
            ':png_paths' => json_encode($pngPaths),
            ':doctor_name' => $doctorName
        ]);
    }

    return [
        'id' => $id,
        'rxNumber' => $rxNumber,
        'patientName' => $patientName,
        'queueNumber' => $queueNumber,
        'clinicalNotes' => $notes,
        'fileName' => $fileName,
        'pdfPath' => $pdfPath,
        'pngPath' => $primaryPng,
        'pngPaths' => $pngPaths,
        'doctorName' => $doctorName,
        'status' => 'active',
        'createdAt' => date('Y-m-d H:i:s')
    ];
}

function markPrescriptionPrinted(?PDO $db, string $id, ?string $printedBy = null): bool {
    if ($db === null) return false;
    ensurePrescriptionsTable($db);
    $stmt = $db->prepare("UPDATE yakap_prescriptions
                         SET status = 'printed', printed_at = CURRENT_TIMESTAMP, printed_by = :printedBy, updated_at = CURRENT_TIMESTAMP
                         WHERE id = :id");
    return $stmt->execute([
        ':id' => $id,
        ':printedBy' => $printedBy ?: ($_SESSION['username'] ?? 'Admin')
    ]);
}

function savePrescriptionToDatabase(?PDO $db, array $rx): array {
    if ($db === null) {
        throw new Exception('Database unavailable');
    }
    ensurePrescriptionsTable($db);

    $id = trim($rx['id'] ?? '');
    if ($id === '') {
        $id = 'rx_' . uniqid() . bin2hex(random_bytes(2));
    }

    $rxNumber = trim($rx['rxNumber'] ?? '');
    if ($rxNumber === '') {
        $rxNumber = 'YK-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));
    }

    $medications = $rx['medications'] ?? [];
    $medsJson = is_string($medications) ? $medications : json_encode($medications);

    $stmt = $db->prepare("INSERT INTO yakap_prescriptions
        (id, rx_number, patient_id, patient_name, patient_age, patient_sex, patient_address,
         phil_health_id, patient_classification, diagnosis, clinical_notes, medications,
         doctor_name, doctor_prc, doctor_ptr, doctor_s2, status, created_at, updated_at)
        VALUES
        (:id, :rx_number, :patient_id, :patient_name, :patient_age, :patient_sex, :patient_address,
         :phil_health_id, :patient_classification, :diagnosis, :clinical_notes, :medications,
         :doctor_name, :doctor_prc, :doctor_ptr, :doctor_s2, :status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE
        SET patient_name = EXCLUDED.patient_name,
            patient_age = EXCLUDED.patient_age,
            patient_sex = EXCLUDED.patient_sex,
            patient_address = EXCLUDED.patient_address,
            phil_health_id = EXCLUDED.phil_health_id,
            patient_classification = EXCLUDED.patient_classification,
            diagnosis = EXCLUDED.diagnosis,
            clinical_notes = EXCLUDED.clinical_notes,
            medications = EXCLUDED.medications,
            doctor_name = EXCLUDED.doctor_name,
            doctor_prc = EXCLUDED.doctor_prc,
            doctor_ptr = EXCLUDED.doctor_ptr,
            doctor_s2 = EXCLUDED.doctor_s2,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id, rx_number, patient_name, diagnosis, status, created_at");

    $stmt->execute([
        ':id' => $id,
        ':rx_number' => $rxNumber,
        ':patient_id' => $rx['patientId'] ?? '',
        ':patient_name' => $rx['patientName'] ?? 'Unnamed Patient',
        ':patient_age' => !empty($rx['patientAge']) ? (int)$rx['patientAge'] : null,
        ':patient_sex' => $rx['patientSex'] ?? '',
        ':patient_address' => $rx['patientAddress'] ?? '',
        ':phil_health_id' => $rx['philHealthId'] ?? '',
        ':patient_classification' => $rx['patientClassification'] ?? 'regular',
        ':diagnosis' => $rx['diagnosis'] ?? '',
        ':clinical_notes' => $rx['clinicalNotes'] ?? '',
        ':medications' => $medsJson,
        ':doctor_name' => $rx['doctorName'] ?? 'Doc. Renz Sale, MD',
        ':doctor_prc' => $rx['doctorPrc'] ?? 'PRC No. 0148921',
        ':doctor_ptr' => $rx['doctorPtr'] ?? 'PTR No. 8392104',
        ':doctor_s2' => $rx['doctorS2'] ?? '',
        ':status' => $rx['status'] ?? 'active'
    ]);

    $saved = $stmt->fetch();
    return [
        'id' => $saved['id'] ?? $id,
        'rxNumber' => $saved['rx_number'] ?? $rxNumber,
        'patientName' => $saved['patient_name'] ?? ($rx['patientName'] ?? ''),
        'status' => $saved['status'] ?? 'active',
        'createdAt' => $saved['created_at'] ?? date('Y-m-d H:i:s')
    ];
}

function updatePrescriptionStatusInDatabase(?PDO $db, string $id, string $status, ?string $dispensedBy = null): bool {
    if ($db === null) return false;
    ensurePrescriptionsTable($db);

    $sql = "UPDATE yakap_prescriptions SET status = :status, updated_at = CURRENT_TIMESTAMP";
    $params = [':id' => $id, ':status' => $status];

    if ($status === 'dispensed') {
        $sql .= ", dispensed_at = CURRENT_TIMESTAMP, dispensed_by = :dispensedBy";
        $params[':dispensedBy'] = $dispensedBy ?: ($_SESSION['username'] ?? 'Pharmacy Admin');
    }

    $sql .= " WHERE id = :id";
    $stmt = $db->prepare($sql);
    return $stmt->execute($params);
}

function deletePrescriptionFromDatabase(?PDO $db, string $id): bool {
    if ($db === null) return false;
    ensurePrescriptionsTable($db);
    $stmt = $db->prepare("DELETE FROM yakap_prescriptions WHERE id = :id");
    return $stmt->execute([':id' => $id]);
}

function jsonResponse(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
}



$db = null;
try {
    $db = Database::getInstance()->getConnection();
} catch (Exception $e) {
    // Database connection failed - will use config-based authentication as fallback
    error_log('Database connection failed: ' . $e->getMessage());
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$state = loadStateFromDatabase($db);

if ($method === 'GET') {
    // Determine user role for messages
    $userRole = 'guest';
    $requestedRole = trim((string)($_GET['role'] ?? ''));
    if ($requestedRole === 'admin' && (isAdminAuthenticated() || isDoctorAuthenticated())) {
        $userRole = 'admin';
    } elseif ($requestedRole === 'doctor' && (isAdminAuthenticated() || isDoctorAuthenticated())) {
        $userRole = 'doctor';
    } elseif (isAdminAuthenticated()) {
        $userRole = 'admin';
    } elseif (isDoctorAuthenticated()) {
        $userRole = 'doctor';
    }

    // Cleanup old messages (run periodically)
    // Random chance to run cleanup to avoid running on every request
    if (rand(1, 100) <= 5) { // 5% chance on each GET request
        cleanupOldMessages($db);
    }

    $messages = loadMessagesFromDatabase($db, $userRole);
    $unreadCount = getUnreadMessageCount($db, $userRole);
    $prescriptions = loadPrescriptionsFromDatabase($db);

    jsonResponse(['success' => true, 'state' => $state, 'messages' => $messages, 'unreadCount' => $unreadCount, 'prescriptions' => $prescriptions]);
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
$requiresDoctorAuth = in_array($action, ['serve', 'finish', 'skip', 'recall', 'serve-next', 'edit-history', 'send-to-followup', 'call-followup', 'ready-for-doctor', 'poll-notifications', 'mark-notifications-read', 'send-message', 'poll-messages', 'mark-messages-read', 'cleanup-messages', 'save-prescription', 'update-prescription-status', 'delete-prescription', 'get-prescriptions', 'upload-prescription-pdf', 'mark-prescription-printed'], true);
$requiresSuperAdminAuth = in_array($action, ['create-user', 'list-users', 'update-user', 'delete-user'], true);

if ($requiresAdminAuth && !isAdminAuthenticated()) {
    jsonResponse(['success' => false, 'message' => 'Admin authentication required'], 401);
    exit;
}

// Allow both admin and doctor authentication for serve-related actions
if ($requiresDoctorAuth && !isAdminAuthenticated() && !isDoctorAuthenticated()) {
    jsonResponse(['success' => false, 'message' => 'Admin or Doctor authentication required'], 401);
    exit;
}

if ($requiresSuperAdminAuth && !isSuperAdminAuthenticated($db)) {
    jsonResponse(['success' => false, 'message' => 'Super admin authentication required'], 401);
    exit;
}

try {
    switch ($action) {
        case 'login':
            $username = trim((string) ($payload['username'] ?? ''));
            $password = (string) ($payload['password'] ?? '');

            // Try database authentication first
            $user = authenticateUser($db, $username, $password);
            if ($user && in_array($user['role'], ['admin', 'super_admin'])) {
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['full_name'] = $user['full_name'];
                $_SESSION['user_role'] = $user['role'];
                $_SESSION['admin_authenticated'] = true;
                jsonResponse(['success' => true, 'message' => 'Login successful', 'user' => $user]);
                break;
            }

            // Fallback to old config-based authentication
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
            unset($_SESSION['user_id']);
            unset($_SESSION['username']);
            unset($_SESSION['full_name']);
            unset($_SESSION['user_role']);
            session_destroy();
            jsonResponse(['success' => true, 'message' => 'Logged out']);
            break;

        case 'doctor-login':
            $username = trim((string) ($payload['username'] ?? ''));
            $password = (string) ($payload['password'] ?? '');

            // Try database authentication first
            $user = authenticateUser($db, $username, $password);
            if ($user && $user['role'] === 'doctor') {
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                $_SESSION['full_name'] = $user['full_name'];
                $_SESSION['user_role'] = $user['role'];
                $_SESSION['doctor_authenticated'] = true;
                jsonResponse(['success' => true, 'message' => 'Login successful', 'user' => $user]);
                break;
            }

            // Fallback to old config-based authentication
            $isValidLogin = ($username === $doctorUsername && $password === $doctorPassword);

            if ($isValidLogin) {
                $_SESSION['doctor_authenticated'] = true;
                jsonResponse(['success' => true, 'message' => 'Login successful']);
            } else {
                $_SESSION['doctor_authenticated'] = false;
                jsonResponse(['success' => false, 'message' => 'Invalid username or password'], 401);
            }
            break;

        case 'doctor-logout':
            unset($_SESSION['doctor_authenticated']);
            unset($_SESSION['user_id']);
            unset($_SESSION['username']);
            unset($_SESSION['full_name']);
            unset($_SESSION['user_role']);
            session_destroy();
            jsonResponse(['success' => true, 'message' => 'Logged out']);
            break;

        case 'add':
            error_log('ADD action called');
            $name = trim((string) ($payload['name'] ?? ''));
            $philHealthId = trim((string) ($payload['philHealthId'] ?? ''));
            $type = strtolower(trim((string) ($payload['patientStatus'] ?? $payload['type'] ?? 'regular')));
            $philHealthStatus = strtolower(trim((string) ($payload['philHealthStatus'] ?? 'no-philhealth')));
            $allowedTypes = ['regular', 'pwd', 'senior', 'emergency'];
            $allowedPhilHealthStatus = ['no-philhealth', 'registered', 'not-registered', 'other-facility'];

            error_log('Adding patient: ' . $name);

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

            error_log('Saving patient to database');
            savePatientToDatabase($db, $newPatient);
            updateQueueNumber($db, $state['nextQueueNumber'] + 1);
            
            error_log('Creating notification for patient: ' . $newPatient['name']);
            // Create notification for doctor when patient is added
            createNotification($db, [
                'queueNumber' => $newPatient['queueNumber'],
                'patientName' => $newPatient['name'],
                'message' => 'New patient arrived and ready for consultation.',
                'notificationType' => 'patient_arrival'
            ]);
            
            error_log('Reloading state');
            $state = loadStateFromDatabase($db);
            error_log('Sending response');
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

        // User management endpoints (super admin only)
        case 'list-users':
            try {
                $stmt = $db->prepare("SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at DESC");
                $stmt->execute();
                $users = $stmt->fetchAll();
                jsonResponse(['success' => true, 'users' => $users]);
            } catch (PDOException $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to fetch users'], 500);
            }
            break;

        case 'create-user':
            $username = trim((string) ($payload['username'] ?? ''));
            $password = (string) ($payload['password'] ?? '');
            $fullName = trim((string) ($payload['full_name'] ?? ''));
            $role = trim((string) ($payload['role'] ?? ''));

            if ($username === '' || $password === '' || $fullName === '' || $role === '') {
                jsonResponse(['success' => false, 'message' => 'All fields are required'], 400);
                exit;
            }

            if (!in_array($role, ['admin', 'doctor'], true)) {
                jsonResponse(['success' => false, 'message' => 'Invalid role'], 400);
                exit;
            }

            try {
                $passwordHash = password_hash($password, PASSWORD_DEFAULT);
                $stmt = $db->prepare("INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (:username, :password_hash, :full_name, :role, true)");
                $stmt->execute([
                    ':username' => $username,
                    ':password_hash' => $passwordHash,
                    ':full_name' => $fullName,
                    ':role' => $role
                ]);
                jsonResponse(['success' => true, 'message' => 'User created successfully']);
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'unique constraint') !== false) {
                    jsonResponse(['success' => false, 'message' => 'Username already exists'], 409);
                } else {
                    jsonResponse(['success' => false, 'message' => 'Failed to create user'], 500);
                }
            }
            break;

        case 'update-user':
            $userId = (int) ($payload['id'] ?? 0);
            $fullName = trim((string) ($payload['full_name'] ?? ''));
            $role = trim((string) ($payload['role'] ?? ''));
            $isActive = isset($payload['is_active']) ? (bool) $payload['is_active'] : null;
            $newPassword = (string) ($payload['new_password'] ?? '');

            if ($userId === 0) {
                jsonResponse(['success' => false, 'message' => 'User ID is required'], 400);
                exit;
            }

            if ($userId === $_SESSION['user_id']) {
                jsonResponse(['success' => false, 'message' => 'Cannot modify your own account'], 400);
                exit;
            }

            try {
                $updateFields = [];
                $params = [':id' => $userId];

                if ($fullName !== '') {
                    $updateFields[] = "full_name = :full_name";
                    $params[':full_name'] = $fullName;
                }

                if ($role !== '' && in_array($role, ['admin', 'doctor'], true)) {
                    $updateFields[] = "role = :role";
                    $params[':role'] = $role;
                }

                if ($isActive !== null) {
                    $updateFields[] = "is_active = :is_active";
                    $params[':is_active'] = $isActive ? 'true' : 'false';
                }

                if ($newPassword !== '') {
                    $updateFields[] = "password_hash = :password_hash";
                    $params[':password_hash'] = password_hash($newPassword, PASSWORD_DEFAULT);
                }

                if (empty($updateFields)) {
                    jsonResponse(['success' => false, 'message' => 'No fields to update'], 400);
                    exit;
                }

                $sql = "UPDATE users SET " . implode(', ', $updateFields) . " WHERE id = :id";
                $stmt = $db->prepare($sql);
                $stmt->execute($params);

                jsonResponse(['success' => true, 'message' => 'User updated successfully']);
            } catch (PDOException $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to update user'], 500);
            }
            break;

        case 'delete-user':
            $userId = (int) ($payload['id'] ?? 0);

            if ($userId === 0) {
                jsonResponse(['success' => false, 'message' => 'User ID is required'], 400);
                exit;
            }

            if ($userId === $_SESSION['user_id']) {
                jsonResponse(['success' => false, 'message' => 'Cannot delete your own account'], 400);
                exit;
            }

            try {
                $stmt = $db->prepare("DELETE FROM users WHERE id = :id");
                $stmt->execute([':id' => $userId]);
                jsonResponse(['success' => true, 'message' => 'User deleted successfully']);
            } catch (PDOException $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to delete user'], 500);
            }
            break;

        case 'poll-notifications':
            $lastNotificationId = (int) ($payload['lastNotificationId'] ?? 0);
            $notifications = getUnreadNotifications($db, $lastNotificationId);
            jsonResponse(['success' => true, 'notifications' => $notifications]);
            break;

        case 'mark-notifications-read':
            $notificationIds = $payload['notificationIds'] ?? [];
            if (!is_array($notificationIds)) {
                jsonResponse(['success' => false, 'message' => 'Invalid notification IDs'], 400);
                exit;
            }
            markNotificationsAsRead($db, $notificationIds);
            jsonResponse(['success' => true, 'message' => 'Notifications marked as read']);
            break;

        case 'send-message':
            $message = trim((string) ($payload['message'] ?? ''));
            $receiverRole = trim((string) ($payload['receiverRole'] ?? ''));

            if ($message === '') {
                jsonResponse(['success' => false, 'message' => 'Message is required'], 400);
                exit;
            }

            if (!in_array($receiverRole, ['admin', 'doctor'], true)) {
                $receiverRole = '';
            }

            // Determine sender role
            $senderRole = '';
            $requestedRole = trim((string)($payload['senderRole'] ?? $payload['userRole'] ?? ''));
            if ($requestedRole === 'admin' && (isAdminAuthenticated() || isDoctorAuthenticated())) {
                $senderRole = 'admin';
            } elseif ($requestedRole === 'doctor' && (isAdminAuthenticated() || isDoctorAuthenticated())) {
                $senderRole = 'doctor';
            } elseif (isAdminAuthenticated()) {
                $senderRole = 'admin';
            } elseif (isDoctorAuthenticated()) {
                $senderRole = 'doctor';
            } else {
                jsonResponse(['success' => false, 'message' => 'Authentication required'], 401);
                exit;
            }

            // Ensure receiver is the other role
            if (empty($receiverRole) || $receiverRole === $senderRole) {
                $receiverRole = ($senderRole === 'admin') ? 'doctor' : 'admin';
            }

            try {
                $savedMessage = saveMessageToDatabase($db, $senderRole, $receiverRole, $message);
                jsonResponse([
                    'success' => true,
                    'message' => 'Message sent successfully',
                    'data' => $savedMessage
                ]);
            } catch (Exception $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to send message: ' . $e->getMessage()], 500);
            }
            break;

        case 'poll-messages':
            $userRole = '';
            $requestedRole = trim((string)($payload['userRole'] ?? $payload['senderRole'] ?? ''));
            if ($requestedRole === 'admin' && (isAdminAuthenticated() || isDoctorAuthenticated())) {
                $userRole = 'admin';
            } elseif ($requestedRole === 'doctor' && (isAdminAuthenticated() || isDoctorAuthenticated())) {
                $userRole = 'doctor';
            } elseif (isAdminAuthenticated()) {
                $userRole = 'admin';
            } elseif (isDoctorAuthenticated()) {
                $userRole = 'doctor';
            } else {
                jsonResponse(['success' => false, 'message' => 'Authentication required'], 401);
                exit;
            }

            $lastId = isset($payload['lastId']) ? (int)$payload['lastId'] : 0;
            $newMessages = loadMessagesFromDatabase($db, $userRole, $lastId);
            $unreadCount = getUnreadMessageCount($db, $userRole);
            $maxReadId = getMaxReadMessageId($db, $userRole);

            jsonResponse([
                'success' => true,
                'messages' => $newMessages,
                'unreadCount' => $unreadCount,
                'maxReadId' => $maxReadId
            ]);
            break;

        case 'mark-messages-read':
            // Determine user role
            $userRole = '';
            $requestedRole = trim((string)($payload['userRole'] ?? $payload['senderRole'] ?? ''));
            if ($requestedRole === 'admin' && (isAdminAuthenticated() || isDoctorAuthenticated())) {
                $userRole = 'admin';
            } elseif ($requestedRole === 'doctor' && (isAdminAuthenticated() || isDoctorAuthenticated())) {
                $userRole = 'doctor';
            } elseif (isAdminAuthenticated()) {
                $userRole = 'admin';
            } elseif (isDoctorAuthenticated()) {
                $userRole = 'doctor';
            } else {
                jsonResponse(['success' => false, 'message' => 'Authentication required'], 401);
                exit;
            }

            $readIds = markMessagesAsRead($db, $userRole);
            jsonResponse([
                'success' => true,
                'message' => 'Messages marked as read',
                'readIds' => $readIds
            ]);
            break;

        case 'cleanup-messages':
            cleanupOldMessages($db);
            jsonResponse(['success' => true, 'message' => 'Old messages cleaned up']);
            break;


        case 'get-video-config':
            $videoConfig = loadVideoConfig($db);
            jsonResponse(['success' => true, 'videoConfig' => $videoConfig]);
            break;

        case 'save-video-config':
            if (!isAdminAuthenticated()) {
                jsonResponse(['success' => false, 'message' => 'Admin authentication required'], 401);
                exit;
            }

            $playlistUrl = trim((string) ($payload['playlistUrl'] ?? ''));
            $playlistTitle = trim((string) ($payload['playlistTitle'] ?? ''));
            $isEnabled = (bool) ($payload['isEnabled'] ?? false);

            if ($playlistUrl !== '') {
                $playlistId = extractYoutubePlaylistId($playlistUrl);
                if (!$playlistId) {
                    jsonResponse(['success' => false, 'message' => 'Invalid YouTube playlist URL'], 400);
                    exit;
                }
            } else {
                $playlistId = '';
            }

            try {
                $updatedBy = $_SESSION['username'] ?? 'admin';
                saveVideoConfig($db, [
                    'playlistId' => $playlistId,
                    'playlistTitle' => $playlistTitle,
                    'playlistUrl' => $playlistUrl,
                    'isEnabled' => $isEnabled,
                    'updatedBy' => $updatedBy
                ]);
                $state = loadStateFromDatabase($db);
                jsonResponse([
                    'success' => true,
                    'message' => 'Video configuration saved successfully',
                    'state' => $state,
                    'videoConfig' => $state['videoConfig']
                ]);
            } catch (Exception $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to save video configuration'], 500);
            }
            break;

        case 'video-control':
            $command = trim((string) ($payload['command'] ?? ''));
            $allowedCommands = ['pause', 'resume', 'next', 'prev', 'unmute', 'play', 'stop'];
            if (!in_array($command, $allowedCommands, true)) {
                jsonResponse(['success' => false, 'message' => 'Invalid video control command'], 400);
                exit;
            }

            try {
                $seq = !empty($payload['seq']) ? (int)$payload['seq'] : (int)(microtime(true) * 1000);
                $sql = "UPDATE video_config 
                        SET last_command = :cmd, 
                            command_seq = :seq,
                            updated_at = CURRENT_TIMESTAMP";
                $params = [
                    ':cmd' => $command,
                    ':seq' => $seq
                ];

                if ($command === 'pause') {
                    $sql .= ", is_paused = true";
                } elseif ($command === 'resume' || $command === 'play') {
                    $sql .= ", is_paused = false";
                } elseif ($command === 'stop') {
                    $sql .= ", is_paused = false, is_enabled = false";
                }

                $sql .= " WHERE id = 1";
                $stmt = $db->prepare($sql);
                $stmt->execute($params);

                $state = loadStateFromDatabase($db);
                jsonResponse([
                    'success' => true,
                    'message' => 'Video command recorded',
                    'state' => $state,
                    'videoConfig' => $state['videoConfig']
                ]);
            } catch (Exception $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to execute video command'], 500);
            }
            break;

        case 'get-playlist-library':
            $library = loadPlaylistLibrary($db);
            jsonResponse(['success' => true, 'library' => $library]);
            break;

        case 'add-to-playlist-library':
            if (!isAdminAuthenticated()) {
                jsonResponse(['success' => false, 'message' => 'Admin authentication required'], 401);
                exit;
            }

            $playlistUrl = trim((string) ($payload['playlistUrl'] ?? ''));
            $playlistTitle = trim((string) ($payload['playlistTitle'] ?? ''));

            if ($playlistUrl === '') {
                jsonResponse(['success' => false, 'message' => 'Playlist URL is required'], 400);
                exit;
            }

            $playlistId = extractYoutubePlaylistId($playlistUrl);
            if (!$playlistId) {
                jsonResponse(['success' => false, 'message' => 'Invalid YouTube playlist URL'], 400);
                exit;
            }

            try {
                $addedBy = $_SESSION['username'] ?? 'admin';
                $id = addToPlaylistLibrary($db, [
                    'playlistId' => $playlistId,
                    'playlistTitle' => $playlistTitle ?: 'Untitled Playlist',
                    'playlistUrl' => $playlistUrl,
                    'addedBy' => $addedBy
                ]);
                jsonResponse(['success' => true, 'message' => 'Playlist added to library', 'id' => $id]);
            } catch (Exception $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to add playlist to library'], 500);
            }
            break;

        case 'delete-from-playlist-library':
            if (!isAdminAuthenticated()) {
                jsonResponse(['success' => false, 'message' => 'Admin authentication required'], 401);
                exit;
            }

            $deleteId = (int) ($payload['id'] ?? 0);
            if ($deleteId <= 0) {
                jsonResponse(['success' => false, 'message' => 'Invalid playlist ID'], 400);
                exit;
            }

            $deleted = deleteFromPlaylistLibrary($db, $deleteId);
            if ($deleted) {
                jsonResponse(['success' => true, 'message' => 'Playlist removed from library']);
            } else {
                jsonResponse(['success' => false, 'message' => 'Playlist not found'], 404);
            }
            break;

        case 'get-prescriptions':
            $prescriptions = loadPrescriptionsFromDatabase($db);
            jsonResponse(['success' => true, 'prescriptions' => $prescriptions]);
            break;

        case 'save-prescription':
            $rxData = $payload['prescription'] ?? [];
            if (empty($rxData) || empty($rxData['patientName'])) {
                jsonResponse(['success' => false, 'message' => 'Patient name is required'], 400);
                exit;
            }
            try {
                $saved = savePrescriptionToDatabase($db, $rxData);
                $allPrescriptions = loadPrescriptionsFromDatabase($db);
                jsonResponse(['success' => true, 'message' => 'Prescription saved successfully', 'prescription' => $saved, 'prescriptions' => $allPrescriptions]);
            } catch (Exception $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to save prescription: ' . $e->getMessage()], 500);
            }
            break;

        case 'update-prescription-status':
            $rxId = trim((string)($payload['id'] ?? ''));
            $status = trim((string)($payload['status'] ?? 'active'));
            $dispensedBy = trim((string)($payload['dispensedBy'] ?? ''));
            if ($rxId === '') {
                jsonResponse(['success' => false, 'message' => 'Prescription ID required'], 400);
                exit;
            }
            try {
                updatePrescriptionStatusInDatabase($db, $rxId, $status, $dispensedBy);
                $allPrescriptions = loadPrescriptionsFromDatabase($db);
                jsonResponse(['success' => true, 'message' => 'Status updated successfully', 'prescriptions' => $allPrescriptions]);
            } catch (Exception $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to update prescription status'], 500);
            }
            break;

        case 'delete-prescription':
            $rxId = trim((string)($payload['id'] ?? ''));
            if ($rxId === '') {
                jsonResponse(['success' => false, 'message' => 'Prescription ID required'], 400);
                exit;
            }
            try {
                deletePrescriptionFromDatabase($db, $rxId);
                $allPrescriptions = loadPrescriptionsFromDatabase($db);
                jsonResponse(['success' => true, 'message' => 'Prescription deleted successfully', 'prescriptions' => $allPrescriptions]);
            } catch (Exception $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to delete prescription'], 500);
            }
            break;

        case 'upload-prescription-pdf':
            $rawPngPages = $payload['pngPages'] ?? [];
            if (empty($rawPngPages) && empty($payload['pdfBase64'])) {
                jsonResponse(['success' => false, 'message' => 'No PDF or converted PNG pages received'], 400);
                exit;
            }
            try {
                $savedRx = uploadPrescriptionPdf($db, $payload);
                $allPrescriptions = loadPrescriptionsFromDatabase($db);
                jsonResponse([
                    'success' => true,
                    'message' => 'Prescription uploaded and converted successfully',
                    'prescription' => $savedRx,
                    'prescriptions' => $allPrescriptions
                ]);
            } catch (Exception $e) {
                error_log('Error uploading prescription: ' . $e->getMessage());
                jsonResponse(['success' => false, 'message' => 'Failed to upload prescription: ' . $e->getMessage()], 500);
            }
            break;

        case 'mark-prescription-printed':
            $rxId = trim((string)($payload['id'] ?? ''));
            $printedBy = trim((string)($payload['printedBy'] ?? ''));
            if ($rxId === '') {
                jsonResponse(['success' => false, 'message' => 'Prescription ID required'], 400);
                exit;
            }
            try {
                markPrescriptionPrinted($db, $rxId, $printedBy);
                $allPrescriptions = loadPrescriptionsFromDatabase($db);
                jsonResponse(['success' => true, 'message' => 'Prescription marked as printed', 'prescriptions' => $allPrescriptions]);
            } catch (Exception $e) {
                jsonResponse(['success' => false, 'message' => 'Failed to mark as printed'], 500);
            }
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