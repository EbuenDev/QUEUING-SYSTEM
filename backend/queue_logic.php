<?php

function getDefaultState(): array
{
    return ['patients' => [], 'nextQueueNumber' => 1, 'consultationHistory' => []];
}

function normalizeState(array $decoded): array
{
    return [
        'patients' => is_array($decoded['patients'] ?? null) ? $decoded['patients'] : [],
        'nextQueueNumber' => max(1, (int) ($decoded['nextQueueNumber'] ?? 1)),
        'consultationHistory' => is_array($decoded['consultationHistory'] ?? null) ? $decoded['consultationHistory'] : [],
    ];
}

function validateCredentials(string $username, string $password, array $config): bool
{
    return trim($username) === (string) ($config['admin_username'] ?? '')
        && ($password === (string) ($config['admin_password'] ?? '')
            || $password === (string) ($config['legacy_admin_password'] ?? ''));
}

function queueAction(array $state, array $payload, ?callable $idGenerator = null, ?callable $timestampSource = null): array
{
    $idGenerator ??= static fn(): string => bin2hex(random_bytes(8));
    $timestampSource ??= static fn(): string => date('Y-m-d H:i:s');
    $action = $payload['action'] ?? '';
    $result = static fn(array $body, int $status = 200, bool $persist = true): array => [
        'state' => $body['state'] ?? $state, 'body' => $body, 'status' => $status, 'persist' => $persist,
    ];
    $id = static fn(array $data): string => (string) ($data['id'] ?? '');
    $type = static function (array $data): string {
        $value = strtolower(trim((string) ($data['patientStatus'] ?? $data['type'] ?? 'regular')));
        return in_array($value, ['regular', 'pwd', 'senior', 'emergency'], true) ? $value : 'regular';
    };
    $philHealth = static function (array $data): string {
        $value = strtolower(trim((string) ($data['philHealthStatus'] ?? 'no-philhealth')));
        return in_array($value, ['no-philhealth', 'registered', 'not-registered', 'other-facility'], true)
            ? $value : 'no-philhealth';
    };
    $completion = static fn(array $patient): array => [
        'id' => $patient['id'], 'name' => $patient['name'], 'queueNumber' => $patient['queueNumber'],
        'finishedAt' => $timestampSource(),
    ];

    switch ($action) {
        case 'add':
            $name = trim((string) ($payload['name'] ?? ''));
            if ($name === '') {
                return $result(['success' => false, 'message' => 'Patient name is required'], 400, false);
            }
            $patientType = $type($payload);
            $patientPhilHealth = $philHealth($payload);
            $state['patients'][] = [
                'id' => $idGenerator(), 'name' => $name,
                'philHealthId' => trim((string) ($payload['philHealthId'] ?? '')),
                'queueNumber' => $state['nextQueueNumber'], 'status' => 'waiting',
                'patientStatus' => $patientType, 'type' => $patientType,
                'philHealthStatus' => $patientPhilHealth,
            ];
            $state['nextQueueNumber']++;
            return $result(['success' => true, 'state' => $state]);
        case 'serve-next':
            $completed = null;
            foreach ($state['patients'] as $index => $patient) {
                if (($patient['status'] ?? '') === 'serving') {
                    $completed = $patient;
                    unset($state['patients'][$index]);
                    break;
                }
            }
            if ($completed !== null) {
                $state['consultationHistory'][] = $completion($completed);
            }
            $state['patients'] = array_values($state['patients']);
            foreach ($state['patients'] as &$patient) {
                if (($patient['status'] ?? '') === 'waiting') {
                    $patient['status'] = 'serving';
                    break;
                }
            }
            unset($patient);
            return $result(['success' => true, 'state' => $state]);
        case 'serve':
            $patientId = $id($payload);
            if ($patientId === '') {
                return $result(['success' => false, 'message' => 'Patient ID is required'], 400, false);
            }
            $completed = null;
            foreach ($state['patients'] as $index => $patient) {
                if (($patient['status'] ?? '') === 'serving') {
                    $completed = $patient;
                    unset($state['patients'][$index]);
                    break;
                }
            }
            if ($completed !== null) {
                $state['consultationHistory'][] = $completion($completed);
            }
            $state['patients'] = array_values($state['patients']);
            foreach ($state['patients'] as &$patient) {
                if (($patient['id'] ?? '') === $patientId) {
                    $patient['status'] = 'serving';
                    break;
                }
            }
            unset($patient);
            return $result(['success' => true, 'state' => $state]);
        case 'finish':
            $patientId = $id($payload);
            if ($patientId === '') {
                return $result(['success' => false, 'message' => 'Patient ID is required'], 400, false);
            }
            $completed = null;
            foreach ($state['patients'] as $index => $patient) {
                if (($patient['id'] ?? '') === $patientId) {
                    $completed = $patient;
                    unset($state['patients'][$index]);
                    break;
                }
            }
            if ($completed !== null) {
                $state['consultationHistory'][] = [
                    'id' => $completed['id'], 'name' => $completed['name'], 'queueNumber' => $completed['queueNumber'],
                    'philHealthId' => $completed['philHealthId'] ?? '',
                    'patientStatus' => $completed['patientStatus'] ?? ($completed['type'] ?? 'regular'),
                    'philHealthStatus' => $completed['philHealthStatus'] ?? 'no-philhealth',
                    'icdCode' => trim((string) ($payload['icdCode'] ?? '')),
                    'consultationDetails' => trim((string) ($payload['consultationDetails'] ?? '')),
                    'finishedAt' => $timestampSource(),
                ];
            }
            $state['patients'] = array_values($state['patients']);
            return $result(['success' => true, 'state' => $state]);
        case 'skip':
        case 'recall':
            $patientId = $id($payload);
            if ($patientId === '') {
                return $result(['success' => false, 'message' => 'Patient ID is required'], 400, false);
            }
            $newStatus = $action === 'skip' ? 'skipped' : 'waiting';
            foreach ($state['patients'] as &$patient) {
                if (($patient['id'] ?? '') === $patientId) {
                    $patient['status'] = $newStatus;
                    break;
                }
            }
            unset($patient);
            return $result(['success' => true, 'state' => $state]);
        case 'edit-history':
            $historyId = $id($payload);
            if ($historyId === '') {
                return $result(['success' => false, 'message' => 'History ID is required'], 400, false);
            }
            foreach ($state['consultationHistory'] as &$entry) {
                if (($entry['id'] ?? '') === $historyId) {
                    $entry['icdCode'] = trim((string) ($payload['icdCode'] ?? ''));
                    $entry['consultationDetails'] = trim((string) ($payload['consultationDetails'] ?? ''));
                    unset($entry);
                    return $result(['success' => true, 'state' => $state]);
                }
            }
            unset($entry);
            return $result(['success' => false, 'message' => 'History entry not found'], 404, false);
        case 'edit':
            $patientId = $id($payload);
            $name = trim((string) ($payload['name'] ?? ''));
            if ($patientId === '' || $name === '') {
                return $result(['success' => false, 'message' => 'Patient ID and a new name are required'], 400, false);
            }
            $patientType = $type($payload);
            $patientPhilHealth = $philHealth($payload);
            foreach ($state['patients'] as &$patient) {
                if (($patient['id'] ?? '') === $patientId) {
                    $patient['name'] = $name;
                    $patient['philHealthId'] = trim((string) ($payload['philHealthId'] ?? ''));
                    $patient['patientStatus'] = $patientType;
                    $patient['type'] = $patientType;
                    $patient['philHealthStatus'] = $patientPhilHealth;
                    break;
                }
            }
            unset($patient);
            return $result(['success' => true, 'state' => $state]);
        case 'delete':
            $patientId = $id($payload);
            if ($patientId === '') {
                return $result(['success' => false, 'message' => 'Patient ID is required'], 400, false);
            }
            $state['patients'] = array_values(array_filter(
                $state['patients'], static fn(array $patient): bool => ($patient['id'] ?? '') !== $patientId
            ));
            return $result(['success' => true, 'state' => $state]);
        case 'reset':
            return $result(['success' => true, 'state' => getDefaultState()]);
        case 'login':
        case 'logout':
            return $result(['success' => true, 'message' => $action === 'login' ? 'Login successful' : 'Logged out'], 200, false);
        default:
            return $result(['success' => false, 'message' => 'Unknown action'], 400, false);
    }
}
