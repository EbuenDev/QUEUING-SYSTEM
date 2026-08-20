<?php
/**
 * Database Connection Test Script
 * This script tests the PostgreSQL database connection and basic functionality
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>PostgreSQL Database Connection Test</h1>";

try {
    // Include database files
    require_once 'backend/database/Database.php';
    require_once 'backend/database/config.php';
    
    echo "<p style='color: green;'>✓ Database files loaded successfully</p>";
    
    // Test database connection
    echo "<h2>Testing Database Connection...</h2>";
    $db = Database::getInstance()->getConnection();
    echo "<p style='color: green;'>✓ Database connection successful!</p>";
    
    // Test if tables exist
    echo "<h2>Checking Database Tables...</h2>";
    
    $tables = ['patients', 'consultation_history', 'queue_management'];
    foreach ($tables as $table) {
        $stmt = $db->prepare("SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = :table
        )");
        $stmt->execute([':table' => $table]);
        $exists = $stmt->fetchColumn();
        
        if ($exists) {
            echo "<p style='color: green;'>✓ Table '$table' exists</p>";
        } else {
            echo "<p style='color: red;'>✗ Table '$table' does not exist</p>";
        }
    }
    
    // Test basic queries
    echo "<h2>Testing Basic Queries...</h2>";
    
    // Test patient count
    $stmt = $db->query("SELECT COUNT(*) FROM patients");
    $patientCount = $stmt->fetchColumn();
    echo "<p>Current patients in database: <strong>$patientCount</strong></p>";
    
    // Test consultation history count
    $stmt = $db->query("SELECT COUNT(*) FROM consultation_history");
    $historyCount = $stmt->fetchColumn();
    echo "<p>Consultation history entries: <strong>$historyCount</strong></p>";
    
    // Test queue management
    $stmt = $db->query("SELECT next_queue_number FROM queue_management WHERE id = 1");
    $queueNumber = $stmt->fetchColumn();
    echo "<p>Next queue number: <strong>$queueNumber</strong></p>";
    
    // Test inserting a sample patient
    echo "<h2>Testing Patient Insert...</h2>";
    $testPatientId = bin2hex(random_bytes(8));
    $stmt = $db->prepare("INSERT INTO patients (id, name, phil_health_id, queue_number, status, patient_status, phil_health_status) 
                          VALUES (:id, :name, :philHealthId, :queueNumber, :status, :patientStatus, :philHealthStatus)");
    
    $result = $stmt->execute([
        ':id' => $testPatientId,
        ':name' => 'Test Patient',
        ':philHealthId' => 'TEST123',
        ':queueNumber' => 9999,
        ':status' => 'waiting',
        ':patientStatus' => 'regular',
        ':philHealthStatus' => 'no-philhealth'
    ]);
    
    if ($result) {
        echo "<p style='color: green;'>✓ Test patient inserted successfully</p>";
        
        // Clean up test patient
        $stmt = $db->prepare("DELETE FROM patients WHERE id = :id");
        $stmt->execute([':id' => $testPatientId]);
        echo "<p style='color: green;'>✓ Test patient cleaned up</p>";
    } else {
        echo "<p style='color: red;'>✗ Failed to insert test patient</p>";
    }
    
    echo "<h2 style='color: green;'>All Tests Completed Successfully!</h2>";
    echo "<p>Your PostgreSQL database is ready for use with the RHU II Patient Queuing System.</p>";
    
} catch (Exception $e) {
    echo "<h2 style='color: red;'>Database Connection Failed</h2>";
    echo "<p style='color: red;'>Error: " . htmlspecialchars($e->getMessage()) . "</p>";
    echo "<h3>Troubleshooting Steps:</h3>";
    echo "<ul>";
    echo "<li>Ensure PostgreSQL is installed and running</li>";
    echo "<li>Check that the database 'rhu_queue_system' exists</li>";
    echo "<li>Verify your credentials in backend/database/config.php</li>";
    echo "<li>Make sure the PHP PostgreSQL extension is enabled</li>";
    echo "<li>Run the schema.sql file to create the required tables</li>";
    echo "</ul>";
}
?>