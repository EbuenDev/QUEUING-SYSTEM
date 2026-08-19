<?php

// Shared state, response and patient helpers used by the API actions.

function getDefaultState(): array {
    return [
        'patients' => [],
        'nextQueueNumber' => 1,
        'consultationHistory' => [],
    ];
}

function loadState(string $stateFile): array {
    if (!file_exists($stateFile)) {
        $initialState = getDefaultState();
        file_put_contents($stateFile, json_encode($initialState, JSON_PRETTY_PRINT));
        return $initialState;
    }

    $contents = file_get_contents($stateFile);
    if ($contents === false || trim($contents) === '') {
        return getDefaultState();
    }

    $decoded = json_decode($contents, true);
    if (!is_array($decoded)) {
        return getDefaultState();
    }

    return [
        'patients' => is_array($decoded['patients'] ?? null) ? $decoded['patients'] : [],
        'nextQueueNumber' => max(1, (int) ($decoded['nextQueueNumber'] ?? 1)),
        'consultationHistory' => is_array($decoded['consultationHistory'] ?? null) ? $decoded['consultationHistory'] : [],
    ];
}

function saveState(string $stateFile, array $state): void {
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT), LOCK_EX);
}

function jsonResponse(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
}

// Persists the state and returns it to the caller, the way every mutating action ends.
function respondWithState(string $stateFile, array $state): void {
    saveState($stateFile, $state);
    jsonResponse(['success' => true, 'state' => $state]);
}

function jsonError(string $message, int $status = 400): void {
    jsonResponse(['success' => false, 'message' => $message], $status);
}

// Returns the requested id, or ends the request with a 400 when it is missing.
function requireId(array $payload, string $message = 'Patient ID is required'): string {
    $id = (string) ($payload['id'] ?? '');
    if ($id === '') {
        jsonError($message);
        exit;
    }

    return $id;
}

function isAdminAuthenticated(): bool {
    return !empty($_SESSION['admin_authenticated']);
}

// Normalizes the patient fields shared by the add and edit actions.
function normalizePatientInput(array $payload): array {
    $allowedTypes = ['regular', 'pwd', 'senior', 'emergency'];
    $allowedPhilHealthStatus = ['no-philhealth', 'registered', 'not-registered', 'other-facility'];

    $type = strtolower(trim((string) ($payload['patientStatus'] ?? $payload['type'] ?? 'regular')));
    $philHealthStatus = strtolower(trim((string) ($payload['philHealthStatus'] ?? 'no-philhealth')));

    return [
        'name' => trim((string) ($payload['name'] ?? '')),
        'philHealthId' => trim((string) ($payload['philHealthId'] ?? '')),
        'type' => in_array($type, $allowedTypes, true) ? $type : 'regular',
        'philHealthStatus' => in_array($philHealthStatus, $allowedPhilHealthStatus, true)
            ? $philHealthStatus
            : 'no-philhealth',
    ];
}

// Removes and returns the first patient matching the given field value.
function takePatientBy(array &$state, string $field, string $value): ?array {
    foreach ($state['patients'] as $index => $patient) {
        if (($patient[$field] ?? '') === $value) {
            unset($state['patients'][$index]);
            $state['patients'] = array_values($state['patients']);
            return $patient;
        }
    }

    $state['patients'] = array_values($state['patients']);
    return null;
}

// Applies the mutator to the first patient matching the given field value.
function updatePatientBy(array &$state, string $field, string $value, callable $mutator): bool {
    foreach ($state['patients'] as &$patient) {
        if (($patient[$field] ?? '') === $value) {
            $mutator($patient);
            unset($patient);
            return true;
        }
    }
    unset($patient);

    return false;
}

function setPatientStatus(array &$state, string $id, string $status): bool {
    return updatePatientBy($state, 'id', $id, function (array &$patient) use ($status): void {
        $patient['status'] = $status;
    });
}

// Moves the first patient having $fromStatus to $toStatus, used to call the next patient in line.
function promoteFirstPatientWithStatus(array &$state, string $fromStatus, string $toStatus): bool {
    return updatePatientBy($state, 'status', $fromStatus, function (array &$patient) use ($toStatus): void {
        $patient['status'] = $toStatus;
    });
}

function updateHistoryEntry(array &$state, string $id, callable $mutator): bool {
    foreach ($state['consultationHistory'] as &$entry) {
        if (($entry['id'] ?? '') === $id) {
            $mutator($entry);
            unset($entry);
            return true;
        }
    }
    unset($entry);

    return false;
}

// Moves a finished patient into the consultation history.
function appendConsultationEntry(array &$state, array $patient, array $extra = []): void {
    $state['consultationHistory'][] = array_merge([
        'id' => $patient['id'],
        'name' => $patient['name'],
        'queueNumber' => $patient['queueNumber'],
        'finishedAt' => date('Y-m-d H:i:s'),
    ], $extra);
}

// Clears the patient currently being served, archiving them into the history.
function completeServingPatient(array &$state): void {
    $completedPatient = takePatientBy($state, 'status', 'serving');
    if ($completedPatient !== null) {
        appendConsultationEntry($state, $completedPatient);
    }
}
