<?php
echo "========================================================\n";
echo " TESTING YAKAP PRESCRIPTION FLOW VIA HTTP API\n";
echo "========================================================\n\n";

$baseUrl = 'http://127.0.0.1/backend/api_postgres.php';

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

function apiGet($url, $cookieFile = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
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

$doctorCookie = sys_get_temp_dir() . '/doc_cookie_' . uniqid() . '.txt';
$adminCookie = sys_get_temp_dir() . '/adm_cookie_' . uniqid() . '.txt';

// Step 1: Login Doctor
echo "1. Logging in Doctor...\n";
$loginDoc = apiRequest($baseUrl, ['action' => 'doctor-login', 'username' => 'renz', 'password' => 'renzsale'], $doctorCookie);
echo "   Doctor login: " . ($loginDoc['success'] ? 'SUCCESS' : 'FAILED') . "\n";

// Step 2: Upload Prescription PDF & Converted PNG
echo "2. Doctor uploading prescription (PDF + Converted PNG)...\n";
$samplePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
$uploadRes = apiRequest($baseUrl, [
    'action' => 'upload-prescription-pdf',
    'patientName' => 'Maria Santos (AutoTest)',
    'queueNumber' => 15,
    'notes' => 'Paracetamol 500mg tab q4h prn for fever',
    'fileName' => 'maria_santos_yakap.pdf',
    'doctorName' => 'Doc. Renz Sale, MD',
    'pdfBase64' => 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp...',
    'pngPages' => [$samplePng]
], $doctorCookie);

if (!$uploadRes || empty($uploadRes['success'])) {
    echo "ERROR: Upload failed! " . json_encode($uploadRes) . "\n";
    exit(1);
}

$rx = $uploadRes['prescription'];
echo "   Uploaded Rx ID: " . $rx['id'] . "\n";
echo "   Rx Number: " . $rx['rxNumber'] . "\n";
echo "   PNG Path: " . $rx['pngPath'] . "\n";
echo "   Status: " . $rx['status'] . "\n";

// Step 3: Login Admin
echo "3. Logging in Admin...\n";
$loginAdm = apiRequest($baseUrl, ['action' => 'login', 'username' => 'admin', 'password' => 'admin123'], $adminCookie);
echo "   Admin login: " . ($loginAdm['success'] ? 'SUCCESS' : 'FAILED') . "\n";

// Step 4: Admin retrieves prescriptions
echo "4. Admin retrieving prescriptions list...\n";
$getRes = apiGet($baseUrl . '?_t=' . time(), $adminCookie);
$found = null;
if (!empty($getRes['prescriptions'])) {
    foreach ($getRes['prescriptions'] as $item) {
        if ($item['id'] === $rx['id']) {
            $found = $item;
            break;
        }
    }
}

if ($found) {
    echo "   Admin received prescription: " . $found['rxNumber'] . " for " . $found['patientName'] . "\n";
    echo "   Converted PNG available at: " . $found['pngPath'] . "\n";
} else {
    echo "ERROR: Prescription not received by Admin!\n";
    exit(1);
}

// Step 5: Admin marks prescription as printed (Landscape Half-A4)
echo "5. Admin printing on landscape mode half of an A4 paper (marking printed)...\n";
$printRes = apiRequest($baseUrl, [
    'action' => 'mark-prescription-printed',
    'id' => $rx['id'],
    'printedBy' => 'Admin Desk'
], $adminCookie);

echo "   Print response: " . ($printRes['success'] ? 'SUCCESS' : 'FAILED') . "\n";

// Step 6: Verify status is now 'printed'
echo "6. Verifying status update...\n";
$verifyRes = apiGet($baseUrl . '?_t=' . time(), $adminCookie);
$updatedItem = null;
if (!empty($verifyRes['prescriptions'])) {
    foreach ($verifyRes['prescriptions'] as $item) {
        if ($item['id'] === $rx['id']) {
            $updatedItem = $item;
            break;
        }
    }
}

if ($updatedItem && $updatedItem['status'] === 'printed') {
    echo "   Status successfully verified: " . $updatedItem['status'] . " (PrintedBy: " . $updatedItem['printedBy'] . ")\n";
} else {
    echo "ERROR: Expected status 'printed', got: " . json_encode($updatedItem) . "\n";
    exit(1);
}

// Step 7: Clean up test record
echo "7. Cleaning up test prescription...\n";
$delRes = apiRequest($baseUrl, [
    'action' => 'delete-prescription',
    'id' => $rx['id']
], $adminCookie);
echo "   Deleted test prescription: " . ($delRes['success'] ? 'SUCCESS' : 'FAILED') . "\n";

@unlink($doctorCookie);
@unlink($adminCookie);

echo "\n========================================================\n";
echo " ALL TESTS PASSED: Doctor uploaded PDF -> converted to PNG -> Admin received & printed!\n";
echo "========================================================\n";
