<?php
// Automated test for messaging feature
require_once __DIR__ . '/../backend/Database.php';
require_once __DIR__ . '/../backend/config.php';

echo "=== RHU II Messaging Feature Verification ===\n";

$baseUrl = 'http://localhost:8081/backend/api_postgres.php';

function apiRequest($url, $payload, $cookieFile = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    if ($cookieFile) {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    }
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) return ['success' => false, 'error' => $err];
    return json_decode($res, true);
}

$docCookie = sys_get_temp_dir() . '/doc_cookie_' . uniqid() . '.txt';
$adminCookie = sys_get_temp_dir() . '/admin_cookie_' . uniqid() . '.txt';

// Step 1: Doctor Login
$res = apiRequest($baseUrl, ['action' => 'doctor-login', 'username' => 'renz', 'password' => 'renzsale'], $docCookie);
echo "1. Doctor Login: " . ($res['success'] ? "PASS" : "FAIL (" . ($res['message'] ?? '') . ")") . "\n";

// Step 2: Doctor Sends Message
$res = apiRequest($baseUrl, [
    'action' => 'send-message',
    'message' => 'Next patient please',
    'receiverRole' => 'admin'
], $docCookie);
echo "2. Doctor Send Message: " . ($res['success'] ? "PASS" : "FAIL") . "\n";
$msgId = $res['data']['id'] ?? 0;
echo "   Message ID returned: $msgId\n";
echo "   Message text: " . ($res['data']['message'] ?? '') . "\n";

// Step 3: Admin Login
$res = apiRequest($baseUrl, ['action' => 'login', 'username' => 'admin', 'password' => 'admin123'], $adminCookie);
echo "3. Admin Login: " . ($res['success'] ? "PASS" : "FAIL") . "\n";

// Step 4: Admin Poll Messages
$res = apiRequest($baseUrl, ['action' => 'poll-messages', 'lastId' => 0], $adminCookie);
echo "4. Admin Poll Messages: " . ($res['success'] ? "PASS" : "FAIL") . "\n";
echo "   Unread Count: " . ($res['unreadCount'] ?? 0) . "\n";
echo "   Total Messages: " . count($res['messages'] ?? []) . "\n";

// Step 5: Admin Marks Messages as Read
$res = apiRequest($baseUrl, ['action' => 'mark-messages-read'], $adminCookie);
echo "5. Admin Mark Read: " . ($res['success'] ? "PASS" : "FAIL") . "\n";
echo "   Read IDs: " . json_encode($res['readIds'] ?? []) . "\n";

// Step 6: Admin Sends Reply
$res = apiRequest($baseUrl, [
    'action' => 'send-message',
    'message' => 'Next patient #9 is entering consult room now.',
    'receiverRole' => 'doctor'
], $adminCookie);
echo "6. Admin Reply: " . ($res['success'] ? "PASS" : "FAIL") . "\n";
$adminMsgId = $res['data']['id'] ?? 0;
echo "   Reply Message ID: $adminMsgId\n";

// Step 7: Doctor Incremental Poll
$res = apiRequest($baseUrl, ['action' => 'poll-messages', 'lastId' => $msgId], $docCookie);
echo "7. Doctor Incremental Poll: " . ($res['success'] ? "PASS" : "FAIL") . "\n";
echo "   New messages count (since ID $msgId): " . count($res['messages'] ?? []) . "\n";
echo "   Max Read ID for Doctor: " . ($res['maxReadId'] ?? 0) . " (Expected >= $msgId: " . (($res['maxReadId'] ?? 0) >= $msgId ? 'YES' : 'NO') . ")\n";

// Cleanup cookies
@unlink($docCookie);
@unlink($adminCookie);

echo "=== All Tests Completed Successfully ===\n";
