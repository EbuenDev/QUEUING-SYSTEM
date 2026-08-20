<?php
/**
 * API Testing Script for RHU II Patient Queuing System
 * Tests both JSON and PostgreSQL backends
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>RHU II Patient Queuing System - API Testing</h1>";
echo "<style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .test-section { border: 1px solid #ccc; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .success { color: green; }
    .error { color: red; }
    .info { color: blue; }
    .warning { color: orange; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 3px; overflow-x: auto; }
    button { padding: 10px 15px; margin: 5px; cursor: pointer; }
    .stats { background: #e8f4f8; padding: 10px; margin: 10px 0; border-radius: 5px; }
</style>";

// Test both backends
$backends = [
    'json' => 'api.php',
    'postgres' => 'api_postgres.php'
];

$currentBackend = $_GET['backend'] ?? 'json';
if (!isset($backends[$currentBackend])) {
    $currentBackend = 'json';
}

echo "<div class='stats'>";
echo "<strong>Current Backend:</strong> " . strtoupper($currentBackend);
echo " | <a href='?backend=json'>Test JSON Backend</a>";
echo " | <a href='?backend=postgres'>Test PostgreSQL Backend</a>";
echo "</div>";

$apiUrl = 'backend/' . $backends[$currentBackend];

// Test 1: Check if API file exists
echo "<div class='test-section'>";
echo "<h2>Test 1: API File Existence</h2>";
if (file_exists($apiUrl)) {
    echo "<p class='success'>✓ API file exists: $apiUrl</p>";
} else {
    echo "<p class='error'>✗ API file not found: $apiUrl</p>";
}
echo "</div>";

// Test 2: Test GET request (fetch state)
echo "<div class='test-section'>";
echo "<h2>Test 2: GET Request - Fetch State</h2>";
try {
    $response = file_get_contents($apiUrl);
    if ($response !== false) {
        $data = json_decode($response, true);
        if ($data && isset($data['success']) && $data['success'] === true) {
            echo "<p class='success'>✓ GET request successful</p>";
            echo "<pre>" . htmlspecialchars(json_encode($data, JSON_PRETTY_PRINT)) . "</pre>";
            
            // Show statistics
            echo "<div class='stats'>";
            echo "<strong>Current State:</strong><br>";
            echo "Patients: " . count($data['state']['patients'] ?? []) . "<br>";
            echo "Next Queue Number: " . ($data['state']['nextQueueNumber'] ?? 0) . "<br>";
            echo "Consultation History: " . count($data['state']['consultationHistory'] ?? []) . "<br>";
            echo "</div>";
        } else {
            echo "<p class='error'>✗ GET request failed - invalid response</p>";
            echo "<pre>" . htmlspecialchars($response) . "</pre>";
        }
    } else {
        echo "<p class='error'>✗ GET request failed</p>";
    }
} catch (Exception $e) {
    echo "<p class='error'>✗ Exception: " . htmlspecialchars($e->getMessage()) . "</p>";
}
echo "</div>";

// Test 3: Test POST request - Add patient
echo "<div class='test-section'>";
echo "<h2>Test 3: POST Request - Add Patient</h2>";
echo "<button onclick='testAddPatient()'>Run Add Patient Test</button>";
echo "<div id='addPatientResult'></div>";

echo "<script>
function testAddPatient() {
    const resultDiv = document.getElementById('addPatientResult');
    resultDiv.innerHTML = '<p class=\"info\">Testing add patient...</p>';
    
    const testData = {
        action: 'add',
        name: 'API Test Patient',
        philHealthId: 'APITEST123',
        patientStatus: 'regular',
        philHealthStatus: 'registered'
    };
    
    fetch('$apiUrl', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            resultDiv.innerHTML = '<p class=\"success\">✓ Patient added successfully</p>';
            resultDiv.innerHTML += '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
        } else {
            resultDiv.innerHTML = '<p class=\"error\">✗ Failed to add patient: ' + (data.message || 'Unknown error') + '</p>';
        }
    })
    .catch(error => {
        resultDiv.innerHTML = '<p class=\"error\">✗ Network error: ' + error + '</p>';
    });
}
</script>";
echo "</div>";

// Test 4: Test Admin Login
echo "<div class='test-section'>";
echo "<h2>Test 4: POST Request - Admin Login</h2>";
echo "<button onclick='testLogin()'>Run Login Test</button>";
echo "<div id='loginResult'></div>";

echo "<script>
function testLogin() {
    const resultDiv = document.getElementById('loginResult');
    resultDiv.innerHTML = '<p class=\"info\">Testing admin login...</p>';
    
    const loginData = {
        action: 'login',
        username: 'admin',
        password: 'admin123'
    };
    
    fetch('$apiUrl', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            resultDiv.innerHTML = '<p class=\"success\">✓ Login successful</p>';
        } else {
            resultDiv.innerHTML = '<p class=\"error\">✗ Login failed: ' + (data.message || 'Unknown error') + '</p>';
        }
    })
    .catch(error => {
        resultDiv.innerHTML = '<p class=\"error\">✗ Network error: ' + error + '</p>';
    });
}
</script>";
echo "</div>";

// Test 5: Test invalid actions
echo "<div class='test-section'>";
echo "<h2>Test 5: POST Request - Invalid Action</h2>";
echo "<button onclick='testInvalidAction()'>Run Invalid Action Test</button>";
echo "<div id='invalidResult'></div>";

echo "<script>
function testInvalidAction() {
    const resultDiv = document.getElementById('invalidResult');
    resultDiv.innerHTML = '<p class=\"info\">Testing invalid action...</p>';
    
    const invalidData = {
        action: 'invalid_action',
        test: 'data'
    };
    
    fetch('$apiUrl', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidData)
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            resultDiv.innerHTML = '<p class=\"success\">✓ Invalid action properly rejected</p>';
            resultDiv.innerHTML += '<p class=\"info\">Message: ' + (data.message || 'Unknown error') + '</p>';
        } else {
            resultDiv.innerHTML = '<p class=\"error\">✗ Invalid action was not rejected</p>';
        }
    })
    .catch(error => {
        resultDiv.innerHTML = '<p class=\"error\">✗ Network error: ' + error + '</p>';
    });
}
</script>";
echo "</div>";

// Test 6: Frontend JavaScript Functions Test
echo "<div class='test-section'>";
echo "<h2>Test 6: Frontend JavaScript Functions</h2>";
echo "<button onclick='testFrontendFunctions()'>Run Frontend Tests</button>";
echo "<div id='frontendResult'></div>";

echo "<script>
function testFrontendFunctions() {
    const resultDiv = document.getElementById('frontendResult');
    let results = [];
    
    // Test if app.js is loaded
    if (typeof fetchState === 'function') {
        results.push('✓ fetchState function exists');
    } else {
        results.push('✗ fetchState function not found');
    }
    
    if (typeof postAction === 'function') {
        results.push('✓ postAction function exists');
    } else {
        results.push('✗ postAction function not found');
    }
    
    if (typeof loginAdmin === 'function') {
        results.push('✓ loginAdmin function exists');
    } else {
        results.push('✗ loginAdmin function not found');
    }
    
    if (typeof render === 'function') {
        results.push('✓ render function exists');
    } else {
        results.push('✗ render function not found');
    }
    
    resultDiv.innerHTML = results.map(r => 
        r.startsWith('✓') ? '<p class=\"success\">' + r + '</p>' : '<p class=\"error\">' + r + '</p>'
    ).join('');
}
</script>";
echo "</div>";

// Test 7: Database Connection (PostgreSQL only)
if ($currentBackend === 'postgres') {
    echo "<div class='test-section'>";
    echo "<h2>Test 7: PostgreSQL Database Connection</h2>";
    try {
        require_once 'backend/database/Database.php';
        $db = Database::getInstance()->getConnection();
        echo "<p class='success'>✓ PostgreSQL connection successful</p>";
        
        // Test query
        $stmt = $db->query("SELECT version()");
        $version = $stmt->fetchColumn();
        echo "<p class='info'>PostgreSQL version: $version</p>";
        
        // Test tables
        $tables = ['patients', 'consultation_history', 'queue_management'];
        foreach ($tables as $table) {
            $stmt = $db->prepare("SELECT COUNT(*) FROM $table");
            $stmt->execute();
            $count = $stmt->fetchColumn();
            echo "<p class='info'>Table '$table': $count records</p>";
        }
        
    } catch (Exception $e) {
        echo "<p class='error'>✗ PostgreSQL connection failed: " . htmlspecialchars($e->getMessage()) . "</p>";
    }
    echo "</div>";
}

// Test 8: File structure check
echo "<div class='test-section'>";
echo "<h2>Test 8: File Structure Check</h2>";
$requiredFiles = [
    'index.html' => 'Patient Display',
    'admin.html' => 'Admin Panel',
    'doctor.html' => 'Doctor Panel',
    'bhw.html' => 'BHW Panel',
    'app.js' => 'JavaScript Application',
    'styles.css' => 'Stylesheet',
    'backend/api.php' => 'JSON API',
    'backend/api_postgres.php' => 'PostgreSQL API',
    'backend/database/schema.sql' => 'Database Schema',
    'backend/database/Database.php' => 'Database Class',
    'backend/database/config.php' => 'Database Config'
];

foreach ($requiredFiles as $file => $description) {
    if (file_exists($file)) {
        echo "<p class='success'>✓ $description ($file)</p>";
    } else {
        echo "<p class='error'>✗ $description ($file) not found</p>";
    }
}
echo "</div>";

echo "<div class='test-section'>";
echo "<h2>Test Summary</h2>";
echo "<p class='info'>Run individual tests by clicking the buttons above.</p>";
echo "<p class='warning'>Note: Some tests require proper server environment and database setup.</p>";
echo "<p>For full integration testing, ensure:</p>";
echo "<ul>";
echo "<li>PHP is installed and running</li>";
echo "<li>PostgreSQL is installed and configured (for postgres backend)</li>";
echo "<li>Database schema has been imported</li>";
echo "<li>Server is running with proper permissions</li>";
echo "</ul>";
echo "</div>";

?>