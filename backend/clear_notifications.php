<?php
require_once 'Database.php';
$db = Database::getInstance()->getConnection();
$db->exec('DELETE FROM notifications');
echo "Cleared all notifications\n";
