<?php
require_once 'Database.php';
$db = Database::getInstance()->getConnection();

// Check if table exists
$stmt = $db->prepare("SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
)");
$stmt->execute();
$tableExists = $stmt->fetchColumn();

echo "Notifications table exists: " . ($tableExists ? 'YES' : 'NO') . "\n";

if ($tableExists) {
    $stmt = $db->prepare("SELECT COUNT(*) FROM notifications");
    $stmt->execute();
    $count = $stmt->fetchColumn();
    echo "Notifications count: $count\n";
    
    if ($count > 0) {
        $stmt = $db->prepare("SELECT id, queue_number, patient_name, message, notification_type, is_read, created_at 
                             FROM notifications 
                             ORDER BY id DESC 
                             LIMIT 5");
        $stmt->execute();
        $notifications = $stmt->fetchAll();
        
        echo "\nRecent notifications:\n";
        foreach ($notifications as $notif) {
            echo "ID: {$notif['id']}, Queue: {$notif['queue_number']}, Patient: {$notif['patient_name']}, Read: " . ($notif['is_read'] ? 'YES' : 'NO') . "\n";
        }
    }
} else {
    echo "ERROR: Table not created!\n";
}
