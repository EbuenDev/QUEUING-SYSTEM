<?php

// Copy this file to backend/config.php and set your own credentials.
// backend/config.php is gitignored and must never be committed.
//
// Prefer 'admin_password_hash' (generate with:
//   php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"
// ). If 'admin_password_hash' is set, 'admin_password' is ignored.

return [
    'admin_username' => 'admin',
    'admin_password' => '',
    'admin_password_hash' => '',
];
