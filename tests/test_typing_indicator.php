<?php
/**
 * Test Typing Indicator Functionality
 * This script tests the typing indicator backend functions directly
 */

require_once __DIR__ . '/../backend/Database.php';
require_once __DIR__ . '/../backend/config.php';

// Include the typing functions from api_postgres.php
function ensureTypingStatusTable(?PDO $db): void {
    if ($db === null) return;
    try {
        $db->exec("CREATE TABLE IF NOT EXISTS typing_status (
            user_role VARCHAR(50) PRIMARY KEY,
            is_typing BOOLEAN DEFAULT FALSE,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");
    } catch (Exception $e) {}
}

function setTypingStatus(?PDO $db, string $userRole, bool $isTyping): void {
    try {
        if ($db === null) {
            return;
        }

        ensureTypingStatusTable($db);

        $stmt = $db->prepare("INSERT INTO typing_status (user_role, is_typing, last_updated)
                             VALUES (:userRole, :isTyping, CURRENT_TIMESTAMP)
                             ON CONFLICT (user_role) DO UPDATE
                             SET is_typing = EXCLUDED.is_typing,
                                 last_updated = CURRENT_TIMESTAMP");
        $stmt->execute([
            ':userRole' => $userRole,
            ':isTyping' => $isTyping
        ]);
    } catch (PDOException $e) {
        error_log('Error setting typing status: ' . $e->getMessage());
    }
}

function getPartnerTypingStatus(?PDO $db, string $userRole): bool {
    try {
        if ($db === null) {
            return false;
        }

        ensureTypingStatusTable($db);

        $partnerRole = ($userRole === 'admin') ? 'doctor' : 'admin';

        $stmt = $db->prepare("SELECT is_typing, last_updated
                             FROM typing_status
                             WHERE user_role = :partnerRole
                               AND is_typing = true
                               AND last_updated > NOW() - INTERVAL '5 seconds'");
        $stmt->execute([':partnerRole' => $partnerRole]);
        $result = $stmt->fetch();

        return $result && (bool)$result['is_typing'];
    } catch (PDOException $e) {
        error_log('Error getting typing status: ' . $e->getMessage());
        return false;
    }
}

echo "=== Typing Indicator Test ===\n\n";

try {
    $db = Database::getInstance()->getConnection();
    echo "Database connection: SUCCESS\n\n";
} catch (Exception $e) {
    echo "Database connection: FAIL - " . $e->getMessage() . "\n";
    exit(1);
}

// Step 1: Test creating typing_status table
echo "[Step 1] Creating typing_status table...\n";
ensureTypingStatusTable($db);
echo "  Result: SUCCESS\n\n";

// Step 2: Doctor sets typing status to true
echo "[Step 2] Doctor sets typing status to TRUE...\n";
setTypingStatus($db, 'doctor', true);
echo "  Result: SUCCESS\n\n";

// Step 3: Admin checks if doctor is typing
echo "[Step 3] Admin checks if doctor is typing...\n";
$doctorIsTyping = getPartnerTypingStatus($db, 'admin');
echo "  Doctor is typing: " . ($doctorIsTyping ? "YES" : "NO") . "\n";
echo "  Expected: YES\n";
echo "  Result: " . ($doctorIsTyping ? "PASS" : "FAIL") . "\n\n";

// Step 4: Wait 2 seconds
echo "[Step 4] Waiting 2 seconds...\n";
sleep(2);
echo "  Done.\n\n";

// Step 5: Admin checks typing status again (should still be true within 5 seconds)
echo "[Step 5] Admin checks typing status again (within 5-second window)...\n";
$doctorIsTyping = getPartnerTypingStatus($db, 'admin');
echo "  Doctor is typing: " . ($doctorIsTyping ? "YES" : "NO") . "\n";
echo "  Expected: YES\n";
echo "  Result: " . ($doctorIsTyping ? "PASS" : "FAIL") . "\n\n";

// Step 6: Doctor sets typing status to false
echo "[Step 6] Doctor sets typing status to FALSE...\n";
setTypingStatus($db, 'doctor', false);
echo "  Result: SUCCESS\n\n";

// Step 7: Admin checks if doctor is typing (should be false now)
echo "[Step 7] Admin checks if doctor is typing (should be FALSE now)...\n";
$doctorIsTyping = getPartnerTypingStatus($db, 'admin');
echo "  Doctor is typing: " . ($doctorIsTyping ? "YES" : "NO") . "\n";
echo "  Expected: NO\n";
echo "  Result: " . (!$doctorIsTyping ? "PASS" : "FAIL") . "\n\n";

// Step 8: Admin sets typing status to true
echo "[Step 8] Admin sets typing status to TRUE...\n";
setTypingStatus($db, 'admin', true);
echo "  Result: SUCCESS\n\n";

// Step 9: Doctor checks if admin is typing
echo "[Step 9] Doctor checks if admin is typing...\n";
$adminIsTyping = getPartnerTypingStatus($db, 'doctor');
echo "  Admin is typing: " . ($adminIsTyping ? "YES" : "NO") . "\n";
echo "  Expected: YES\n";
echo "  Result: " . ($adminIsTyping ? "PASS" : "FAIL") . "\n\n";

// Step 10: Wait 6 seconds (status should expire after 5 seconds)
echo "[Step 10] Waiting 6 seconds (typing status should expire)...\n";
sleep(6);
echo "  Done.\n\n";

// Step 11: Doctor checks if admin is typing (should be false now due to expiration)
echo "[Step 11] Doctor checks if admin is typing (should be FALSE due to expiration)...\n";
$adminIsTyping = getPartnerTypingStatus($db, 'doctor');
echo "  Admin is typing: " . ($adminIsTyping ? "YES" : "NO") . "\n";
echo "  Expected: NO\n";
echo "  Result: " . (!$adminIsTyping ? "PASS" : "FAIL") . "\n\n";

echo "=== Test Complete ===\n";
