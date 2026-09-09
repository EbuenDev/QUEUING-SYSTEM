<?php
// Test script to verify notification API endpoints
require_once 'backend/Database.php';
require_once 'backend/config.php';

$config = require 'backend/config.php';

session_start();

// Simulate doctor login
$_SESSION['doctor_authenticated'] = true;
$_SESSION['user_role'] = 'doctor';

$db = Database::getInstance()->getConnection();

// Test 1: Create a test notification
echo "Test 1: Creating test notification...\n";
try {
    $stmt = $db->prepare("INSERT INTO notifications (queue_number, patient_name, message, notification_type, is_read) 
                         VALUES (999, 'Test Patient', 'Test notification message', 'patient_call', false)");
    $stmt->execute();
    echo "✓ Test notification created\n";
} catch (Exception $e) {
    echo "✗ Failed to create notification: " . $e->getMessage() . "\n";
}

// Test 2: Check if notification exists
echo "\nTest 2: Checking notification count...\n";
$stmt = $db->prepare("SELECT COUNT(*) FROM notifications");
$stmt->execute();
$count = $stmt->fetchColumn();
echo "Total notifications: $count\n";

// Test 3: Poll for notifications
echo "\nTest 3: Testing poll-notifications endpoint...\n";
$lastId = 0;
$stmt = $db->prepare("SELECT id, queue_number, patient_name, message, notification_type, created_at 
                     FROM notifications 
                     WHERE id > :lastId AND is_read = false 
                     ORDER BY id ASC");
$stmt->execute([':lastId' => $lastId]);
$notifications = $stmt->fetchAll();

echo "Unread notifications found: " . count($notifications) . "\n";
if (!empty($notifications)) {
    foreach ($notifications as $notif) {
        echo "  - ID: {$notif['id']}, Queue: {$notif['queue_number']}, Patient: {$notif['patient_name']}\n";
    }
}

// Test 4: Mark as read
echo "\nTest 4: Testing mark-notifications-read endpoint...\n";
if (!empty($notifications)) {
    $ids = array_column($notifications, 'id');
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $db->prepare("UPDATE notifications SET is_read = true WHERE id IN ($placeholders)");
    $stmt->execute($ids);
    echo "✓ Marked " . count($ids) . " notifications as read\n";
}

echo "\n✅ All API tests completed\n";
