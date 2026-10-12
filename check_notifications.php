<?php
// Debug script to check notifications table
require_once __DIR__ . '/backend/Database.php';
require_once __DIR__ . '/backend/config.php';

try {
    $db = Database::getInstance()->getConnection();
    
    // Check if table exists
    $stmt = $db->prepare("SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
    )");
    $stmt->execute();
    $tableExists = $stmt->fetchColumn();
    
    echo "Notifications table exists: " . ($tableExists ? 'YES' : 'NO') . "\n\n";
    
    if (!$tableExists) {
        echo "ERROR: Notifications table was not created!\n";
        echo "Please run the migration again.\n";
        exit(1);
    }
    
    // Count notifications
    $stmt = $db->prepare("SELECT COUNT(*) FROM notifications");
    $stmt->execute();
    $count = $stmt->fetchColumn();
    
    echo "Total notifications in database: $count\n\n";
    
    // Show recent notifications
    $stmt = $db->prepare("SELECT id, queue_number, patient_name, message, notification_type, is_read, created_at 
                         FROM notifications 
                         ORDER BY id DESC 
                         LIMIT 10");
    $stmt->execute();
    $notifications = $stmt->fetchAll();
    
    if (empty($notifications)) {
        echo "No notifications found in database.\n";
        echo "This is expected if you haven't called any patients yet.\n\n";
        echo "To test:\n";
        echo "1. Add a patient in Admin\n";
        echo "2. Click 'Next Patient' (NOT 'Add Patient')\n";
        echo "3. Check this script again\n";
    } else {
        echo "Recent notifications:\n";
        echo str_repeat("-", 80) . "\n";
        foreach ($notifications as $notif) {
            echo "ID: {$notif['id']}\n";
            echo "Queue: {$notif['queue_number']}\n";
            echo "Patient: {$notif['patient_name']}\n";
            echo "Message: {$notif['message']}\n";
            echo "Type: {$notif['notification_type']}\n";
            echo "Read: " . ($notif['is_read'] ? 'YES' : 'NO') . "\n";
            echo "Created: {$notif['created_at']}\n";
            echo str_repeat("-", 80) . "\n";
        }
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
