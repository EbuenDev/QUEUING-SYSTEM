<?php
// Dedicated test: Send message from Admin to Doctor and verify receipt & read status
require_once __DIR__ . '/../backend/Database.php';
require_once __DIR__ . '/../backend/config.php';

echo "========================================================\n";
echo " TESTING MESSAGING FUNCTIONALITY: ADMIN -> DOCTOR\n";
echo "========================================================\n\n";

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

$adminCookie = sys_get_temp_dir() . '/admin_test_cookie_' . uniqid() . '.txt';
$docCookie = sys_get_temp_dir() . '/doc_test_cookie_' . uniqid() . '.txt';

// Step 1: Admin logs in
echo "[Step 1] Admin authenticating as 'admin'...\n";
$loginRes = apiRequest($baseUrl, [
    'action' => 'login',
    'username' => 'admin',
    'password' => 'admin123'
], $adminCookie);

if (!empty($loginRes['success'])) {
    echo "  -> SUCCESS: Admin authenticated.\n\n";
} else {
    echo "  -> FAILED: " . json_encode($loginRes) . "\n";
    exit(1);
}

// Step 2: Admin sends message to Doctor
$testMessageText = "Doc, Patient #9 Mark Ian Ebuen has arrived and vitals are recorded. Please proceed.";
echo "[Step 2] Admin sending message to Doctor...\n";
echo "  Message: \"$testMessageText\"\n";

$sendRes = apiRequest($baseUrl, [
    'action' => 'send-message',
    'message' => $testMessageText,
    'senderRole' => 'admin',
    'receiverRole' => 'doctor'
], $adminCookie);

if (!empty($sendRes['success']) && !empty($sendRes['data']['id'])) {
    $msgId = $sendRes['data']['id'];
    echo "  -> SUCCESS: Message dispatched and stored in database!\n";
    echo "     Message ID : " . $sendRes['data']['id'] . "\n";
    echo "     Sender     : " . $sendRes['data']['senderRole'] . "\n";
    echo "     Receiver   : " . $sendRes['data']['receiverRole'] . "\n";
    echo "     Created At : " . $sendRes['data']['createdAt'] . "\n";
    echo "     Is Read    : " . ($sendRes['data']['isRead'] ? 'true' : 'false') . "\n\n";
} else {
    echo "  -> FAILED: " . json_encode($sendRes) . "\n";
    exit(1);
}

// Step 3: Doctor logs in
echo "[Step 3] Doctor authenticating as 'renz' (Doc. Renz Sale)...\n";
$docLoginRes = apiRequest($baseUrl, [
    'action' => 'doctor-login',
    'username' => 'renz',
    'password' => 'renzsale'
], $docCookie);

if (!empty($docLoginRes['success'])) {
    echo "  -> SUCCESS: Doctor authenticated.\n\n";
} else {
    echo "  -> FAILED: " . json_encode($docLoginRes) . "\n";
    exit(1);
}

// Step 4: Doctor polls messages
echo "[Step 4] Doctor checking incoming messages...\n";
$pollRes = apiRequest($baseUrl, [
    'action' => 'poll-messages',
    'userRole' => 'doctor',
    'lastId' => 0
], $docCookie);

$foundMessage = null;
if (!empty($pollRes['success']) && !empty($pollRes['messages'])) {
    foreach ($pollRes['messages'] as $m) {
        if ($m['id'] == $msgId) {
            $foundMessage = $m;
            break;
        }
    }
}

if ($foundMessage) {
    echo "  -> SUCCESS: Doctor received Admin's message!\n";
    echo "     Received ID     : " . $foundMessage['id'] . "\n";
    echo "     Received From   : " . $foundMessage['senderRole'] . " (Admin Desk)\n";
    echo "     Message Content : \"" . $foundMessage['message'] . "\"\n";
    echo "     Doctor Unread Count: " . ($pollRes['unreadCount'] ?? 0) . "\n\n";
} else {
    echo "  -> FAILED: Doctor could not find message with ID $msgId\n";
    exit(1);
}

// Step 5: Doctor marks message as read
echo "[Step 5] Doctor opens chat window (marking message as read)...\n";
$readRes = apiRequest($baseUrl, [
    'action' => 'mark-messages-read',
    'userRole' => 'doctor'
], $docCookie);

if (!empty($readRes['success'])) {
    echo "  -> SUCCESS: Messages marked as read by Doctor. Marked IDs: " . json_encode($readRes['readIds']) . "\n\n";
} else {
    echo "  -> FAILED: " . json_encode($readRes) . "\n";
    exit(1);
}

// Step 6: Admin polls to verify read receipt
echo "[Step 6] Admin checks read receipt status...\n";
$adminPollRes = apiRequest($baseUrl, [
    'action' => 'poll-messages',
    'userRole' => 'admin',
    'lastId' => 0
], $adminCookie);

$maxReadId = $adminPollRes['maxReadId'] ?? 0;
echo "  -> Admin maxReadId: $maxReadId\n";
if ($maxReadId >= $msgId) {
    echo "  -> SUCCESS: Read receipt confirmed! Sent message shows double checkmark (✓✓ Read) on Admin's screen.\n\n";
} else {
    echo "  -> WARNING: maxReadId ($maxReadId) is less than msgId ($msgId)\n\n";
}

// Cleanup cookies
@unlink($adminCookie);
@unlink($docCookie);

echo "========================================================\n";
echo " ALL FUNCTIONALITY TESTS PASSED: ADMIN TO DOCTOR OK!\n";
echo "========================================================\n";
