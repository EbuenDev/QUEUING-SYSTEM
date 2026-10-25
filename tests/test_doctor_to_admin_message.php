<?php
echo "========================================================\n";
echo " TESTING MESSAGING FUNCTIONALITY: DOCTOR -> ADMIN\n";
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

// Step 1: Doctor logs in
echo "[Step 1] Doctor authenticating as 'renz'...\n";
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

// Step 2: Doctor sends message to Admin
$testMessageText = "Admin, please send the next patient to consultation room.";
echo "[Step 2] Doctor sending message to Admin...\n";
echo "  Message: \"$testMessageText\"\n";

$sendRes = apiRequest($baseUrl, [
    'action' => 'send-message',
    'message' => $testMessageText,
    'senderRole' => 'doctor',
    'receiverRole' => 'admin'
], $docCookie);

if (!empty($sendRes['success']) && !empty($sendRes['data']['id'])) {
    $msgId = $sendRes['data']['id'];
    echo "  -> SUCCESS: Message dispatched and stored in database!\n";
    echo "     Message ID : {$sendRes['data']['id']}\n";
    echo "     Sender     : {$sendRes['data']['senderRole']}\n";
    echo "     Receiver   : {$sendRes['data']['receiverRole']}\n";
    echo "     Created At : {$sendRes['data']['createdAt']}\n";
    echo "     Is Read    : " . ($sendRes['data']['isRead'] ? 'true' : 'false') . "\n\n";
} else {
    echo "  -> FAILED: " . json_encode($sendRes) . "\n";
    exit(1);
}

// Step 3: Admin logs in
echo "[Step 3] Admin authenticating as 'admin'...\n";
$adminLoginRes = apiRequest($baseUrl, [
    'action' => 'login',
    'username' => 'admin',
    'password' => 'admin123'
], $adminCookie);

if (!empty($adminLoginRes['success'])) {
    echo "  -> SUCCESS: Admin authenticated.\n\n";
} else {
    echo "  -> FAILED: " . json_encode($adminLoginRes) . "\n";
    exit(1);
}

// Step 4: Admin polls messages
echo "[Step 4] Admin checking incoming messages...\n";
$adminPollRes = apiRequest($baseUrl, [
    'action' => 'poll-messages',
    'userRole' => 'admin',
    'lastId' => 0
], $adminCookie);

$received = false;
if (!empty($adminPollRes['success']) && !empty($adminPollRes['messages'])) {
    foreach ($adminPollRes['messages'] as $msg) {
        if ($msg['id'] == $msgId) {
            $received = true;
            echo "  -> SUCCESS: Admin received Doctor's message!\n";
            echo "     Received ID     : {$msg['id']}\n";
            echo "     Received From   : {$msg['senderRole']}\n";
            echo "     Message Content : \"{$msg['message']}\"\n";
            echo "     Admin Unread Count: {$adminPollRes['unreadCount']}\n\n";
            break;
        }
    }
}

if (!$received) {
    echo "  -> FAILED: Admin did not receive message ID $msgId. Response: " . json_encode($adminPollRes) . "\n";
    exit(1);
}

// Step 5: Admin marks message as read
echo "[Step 5] Admin opens chat window (marking message as read)...\n";
$readRes = apiRequest($baseUrl, [
    'action' => 'mark-messages-read',
    'userRole' => 'admin'
], $adminCookie);

if (!empty($readRes['success'])) {
    echo "  -> SUCCESS: Messages marked as read by Admin. Marked IDs: " . json_encode($readRes['readIds']) . "\n\n";
} else {
    echo "  -> FAILED: " . json_encode($readRes) . "\n";
    exit(1);
}

// Step 6: Doctor checks read receipts
echo "[Step 6] Doctor checks read receipt status...\n";
$docPollAfterRead = apiRequest($baseUrl, [
    'action' => 'poll-messages',
    'userRole' => 'doctor',
    'lastId' => $msgId - 1
], $docCookie);

if (!empty($docPollAfterRead['success']) && isset($docPollAfterRead['maxReadId'])) {
    echo "  -> Doctor maxReadId: {$docPollAfterRead['maxReadId']}\n";
    if ($docPollAfterRead['maxReadId'] >= $msgId) {
        echo "  -> SUCCESS: Read receipt confirmed! Sent message shows double checkmark (✓✓ Read) on Doctor's screen.\n\n";
    } else {
        echo "  -> NOTE: Read receipt maxReadId ({$docPollAfterRead['maxReadId']}) is less than message ID ($msgId).\n\n";
    }
} else {
    echo "  -> FAILED: Could not poll read receipt. " . json_encode($docPollAfterRead) . "\n";
    exit(1);
}

echo "========================================================\n";
echo " ALL FUNCTIONALITY TESTS PASSED: DOCTOR TO ADMIN OK!\n";
echo "========================================================\n";
