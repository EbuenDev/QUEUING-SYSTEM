<?php
// Manual test to create a notification
require_once 'Database.php';
require_once 'config.php';

try {
    $db = Database::getInstance()->getConnection();
    
    // Get the highest queue number
    $stmt = $db->prepare("SELECT MAX(queue_number) as max_queue FROM patients");
    $stmt->execute();
    $result = $stmt->fetch();
    $queueNumber = ($result['max_queue'] ?? 0) + 1;
    
    // Create a test notification
    $stmt = $db->prepare("INSERT INTO notifications (queue_number, patient_name, message, notification_type, is_read) 
                         VALUES (:queueNumber, :patientName, :message, :notificationType, :isRead)");
    
    $stmt->execute([
        ':queueNumber' => $queueNumber,
        ':patientName' => 'Test Patient Manual',
        ':message' => 'Manual test notification - patient arrived',
        ':notificationType' => 'patient_arrival',
        ':isRead' => false,  // Boolean
    ]);
    
    echo "✓ Test notification created successfully!\n";
    echo "Queue Number: $queueNumber\n";
    echo "Patient: Test Patient Manual\n";
    
    // Check total notifications
    $stmt = $db->prepare("SELECT COUNT(*) FROM notifications");
    $stmt->execute();
    $count = $stmt->fetchColumn();
    echo "Total notifications in database: $count\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
