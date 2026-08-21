<?php

function getDefaultState(): array
{
    return [
        'patients' => [],
        'nextQueueNumber' => 1,
        'consultationHistory' => [],
    ];
}

function normalizeState(array $decoded): array
{
    return [
        'patients' => is_array($decoded['patients'] ?? null)
            ? $decoded['patients']
            : [],
        'nextQueueNumber' => max(1, (int) ($decoded['nextQueueNumber'] ?? 1)),
        'consultationHistory' => is_array($decoded['consultationHistory'] ?? null)
            ? $decoded['consultationHistory']
            : [],
    ];
}

function loadState(string $stateFile): array
{
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

    return normalizeState($decoded);
}

function saveState(string $stateFile, array $state): void
{
    file_put_contents($stateFile, json_encode($state, JSON_PRETTY_PRINT), LOCK_EX);
}

function validateCredentials(string $username, string $password, array $config): bool
{
    if ($password === '') {
        return false;
    }

    $expectedUsername = trim((string) ($config['admin_username'] ?? ''));
    if ($expectedUsername === '' || trim($username) !== $expectedUsername) {
        return false;
    }

    $primaryPassword = (string) ($config['admin_password'] ?? '');
    $legacyPassword = (string) ($config['legacy_admin_password'] ?? '');

    return ($primaryPassword !== '' && $password === $primaryPassword)
        || ($legacyPassword !== '' && $password === $legacyPassword);
}

function queueAction(
    array $state,
    array $payload,
    ?callable $idGenerator = null,
    ?callable $timestampSource = null
): array {
    $idGenerator ??= static fn(): string => bin2hex(random_bytes(8));
    $timestampSource ??= static fn(): string => date('Y-m-d H:i:s');
    $action = $payload['action'] ?? '';

    $result = static function (
        array $body,
        array $nextState,
        int $status = 200,
        bool $persist = true
    ): array {
        return [
            'state' => $nextState,
            'body' => $body,
            'status' => $status,
            'persist' => $persist,
        ];
    };

    $getId = static fn(array $data): string => (string) ($data['id'] ?? '');

    $normalizePatientType = static function (array $data): string {
        $value = strtolower(trim((string) (
            $data['patientStatus'] ?? $data['type'] ?? 'regular'
        )));

        if (!in_array($value, ['regular', 'pwd', 'senior', 'emergency'], true)) {
            return 'regular';
        }

        return $value;
    };

    $normalizePhilHealthStatus = static function (array $data): string {
        $value = strtolower(trim((string) (
            $data['philHealthStatus'] ?? 'no-philhealth'
        )));

        if (!in_array($value, [
            'no-philhealth',
            'registered',
            'not-registered',
            'other-facility',
        ], true)) {
            return 'no-philhealth';
        }

        return $value;
    };

    $historyEntry = static function (array $patient) use ($timestampSource): array {
        return [
            'id' => $patient['id'],
            'name' => $patient['name'],
            'queueNumber' => $patient['queueNumber'],
            'finishedAt' => $timestampSource(),
        ];
    };

    switch ($action) {
        case 'add':
            $name = trim((string) ($payload['name'] ?? ''));
            if ($name === '') {
                return $result(
                    ['success' => false, 'message' => 'Patient name is required'],
                    $state,
                    400,
                    false
                );
            }

            $patientType = $normalizePatientType($payload);
            $philHealthStatus = $normalizePhilHealthStatus($payload);
            $state['patients'][] = [
                'id' => $idGenerator(),
                'name' => $name,
                'philHealthId' => trim((string) ($payload['philHealthId'] ?? '')),
                'queueNumber' => $state['nextQueueNumber'],
                'status' => 'waiting',
                'patientStatus' => $patientType,
                'type' => $patientType,
                'philHealthStatus' => $philHealthStatus,
            ];
            $state['nextQueueNumber']++;

            return $result(['success' => true, 'state' => $state], $state);

        case 'serve-next':
            $completedPatient = null;
            foreach ($state['patients'] as $index => $patient) {
                if (($patient['status'] ?? '') === 'serving') {
                    $completedPatient = $patient;
                    unset($state['patients'][$index]);
                    break;
                }
            }

            if ($completedPatient !== null) {
                $state['consultationHistory'][] = $historyEntry($completedPatient);
            }

            $state['patients'] = array_values($state['patients']);
            foreach ($state['patients'] as &$patient) {
                if (($patient['status'] ?? '') === 'waiting') {
                    $patient['status'] = 'serving';
                    break;
                }
            }
            unset($patient);

            return $result(['success' => true, 'state' => $state], $state);

        case 'serve':
            $patientId = $getId($payload);
            if ($patientId === '') {
                return $result(
                    ['success' => false, 'message' => 'Patient ID is required'],
                    $state,
                    400,
                    false
                );
            }

            $completedPatient = null;
            foreach ($state['patients'] as $index => $patient) {
                if (($patient['status'] ?? '') === 'serving') {
                    $completedPatient = $patient;
                    unset($state['patients'][$index]);
                    break;
                }
            }

            if ($completedPatient !== null) {
                $state['consultationHistory'][] = $historyEntry($completedPatient);
            }

            $state['patients'] = array_values($state['patients']);
            foreach ($state['patients'] as &$patient) {
                if (($patient['id'] ?? '') === $patientId) {
                    $patient['status'] = 'serving';
                    break;
                }
            }
            unset($patient);

            return $result(['success' => true, 'state' => $state], $state);

        case 'finish':
            $patientId = $getId($payload);
            if ($patientId === '') {
                return $result(
                    ['success' => false, 'message' => 'Patient ID is required'],
                    $state,
                    400,
                    false
                );
            }

            $completedPatient = null;
            foreach ($state['patients'] as $index => $patient) {
                if (($patient['id'] ?? '') === $patientId) {
                    $completedPatient = $patient;
                    unset($state['patients'][$index]);
                    break;
                }
            }

            if ($completedPatient !== null) {
                $state['consultationHistory'][] = [
                    'id' => $completedPatient['id'],
                    'name' => $completedPatient['name'],
                    'queueNumber' => $completedPatient['queueNumber'],
                    'philHealthId' => $completedPatient['philHealthId'] ?? '',
                    'patientStatus' => $completedPatient['patientStatus']
                        ?? ($completedPatient['type'] ?? 'regular'),
                    'philHealthStatus' => $completedPatient['philHealthStatus']
                        ?? 'no-philhealth',
                    'icdCode' => trim((string) ($payload['icdCode'] ?? '')),
                    'consultationDetails' => trim((string) (
                        $payload['consultationDetails'] ?? ''
                    )),
                    'finishedAt' => $timestampSource(),
                ];
            }

            $state['patients'] = array_values($state['patients']);
            return $result(['success' => true, 'state' => $state], $state);

        case 'skip':
        case 'recall':
            $patientId = $getId($payload);
            if ($patientId === '') {
                return $result(
                    ['success' => false, 'message' => 'Patient ID is required'],
                    $state,
                    400,
                    false
                );
            }

            $newStatus = $action === 'skip' ? 'skipped' : 'waiting';
            foreach ($state['patients'] as &$patient) {
                if (($patient['id'] ?? '') === $patientId) {
                    $patient['status'] = $newStatus;
                    break;
                }
            }
            unset($patient);

            return $result(['success' => true, 'state' => $state], $state);

        case 'edit-history':
            $historyId = $getId($payload);
            if ($historyId === '') {
                return $result(
                    ['success' => false, 'message' => 'History ID is required'],
                    $state,
                    400,
                    false
                );
            }

            foreach ($state['consultationHistory'] as &$entry) {
                if (($entry['id'] ?? '') === $historyId) {
                    $entry['icdCode'] = trim((string) ($payload['icdCode'] ?? ''));
                    $entry['consultationDetails'] = trim((string) (
                        $payload['consultationDetails'] ?? ''
                    ));
                    unset($entry);

                    return $result(['success' => true, 'state' => $state], $state);
                }
            }
            unset($entry);

            return $result(
                ['success' => false, 'message' => 'History entry not found'],
                $state,
                404,
                false
            );

        case 'edit':
            $patientId = $getId($payload);
            $name = trim((string) ($payload['name'] ?? ''));
            if ($patientId === '' || $name === '') {
                return $result(
                    ['success' => false, 'message' => 'Patient ID and a new name are required'],
                    $state,
                    400,
                    false
                );
            }

            $patientType = $normalizePatientType($payload);
            $philHealthStatus = $normalizePhilHealthStatus($payload);
            foreach ($state['patients'] as &$patient) {
                if (($patient['id'] ?? '') === $patientId) {
                    $patient['name'] = $name;
                    $patient['philHealthId'] = trim((string) (
                        $payload['philHealthId'] ?? ''
                    ));
                    $patient['patientStatus'] = $patientType;
                    $patient['type'] = $patientType;
                    $patient['philHealthStatus'] = $philHealthStatus;
                    break;
                }
            }
            unset($patient);

            return $result(['success' => true, 'state' => $state], $state);

        case 'delete':
            $patientId = $getId($payload);
            if ($patientId === '') {
                return $result(
                    ['success' => false, 'message' => 'Patient ID is required'],
                    $state,
                    400,
                    false
                );
            }

            $state['patients'] = array_values(array_filter(
                $state['patients'],
                static fn(array $patient): bool => ($patient['id'] ?? '') !== $patientId
            ));

            return $result(['success' => true, 'state' => $state], $state);

        case 'reset':
            $state = getDefaultState();
            return $result(['success' => true, 'state' => $state], $state);

        default:
            return $result(
                ['success' => false, 'message' => 'Unknown action'],
                $state,
                400,
                false
            );
    }
}
