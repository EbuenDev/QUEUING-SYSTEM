<?php
require_once 'backend/Database.php';
$db = Database::getInstance()->getConnection();
$stmt = $db->prepare("SELECT COUNT(*) FROM notifications");
$stmt->execute();
echo "Notifications count: " . $stmt->fetchColumn() . PHP_EOL;
