<?php

use PHPUnit\Framework\TestCase;

final class QueueLogicTest extends TestCase
{
    private array $temporaryFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->temporaryFiles as $file) {
            if (file_exists($file)) {
                unlink($file);
            }
        }
        $this->temporaryFiles = [];
    }

    private function invoke(array $state, array $payload): array
    {
        return queueAction(
            $state,
            $payload,
            static fn(): string => 'generated-id',
            static fn(): string => '2024-01-02 03:04:05'
        );
    }

    private function state(array $patients = [], array $history = [], int $next = 1): array
    {
        return [
            'patients' => $patients,
            'nextQueueNumber' => $next,
            'consultationHistory' => $history,
        ];
    }

    private function patient(
        string $id,
        string $status,
        string $name = 'Patient',
        int $queueNumber = 1
    ): array {
        return [
            'id' => $id,
            'name' => $name,
            'queueNumber' => $queueNumber,
            'status' => $status,
        ];
    }

    private function temporaryFile(string $contents = ''): string
    {
        $file = tempnam(sys_get_temp_dir(), 'queue-test-');
        file_put_contents($file, $contents);
        $this->temporaryFiles[] = $file;
        return $file;
    }

    public function testDefaultStateHasExpectedShape(): void
    {
        self::assertSame([
            'patients' => [],
            'nextQueueNumber' => 1,
            'consultationHistory' => [],
        ], getDefaultState());
    }

    public function testNormalizeStateUsesDefaultsForInvalidValues(): void
    {
        self::assertSame(getDefaultState(), normalizeState([
            'patients' => 'invalid',
            'consultationHistory' => null,
            'nextQueueNumber' => 0,
        ]));
    }

    public function testNormalizeStateClampsNegativeQueueNumber(): void
    {
        self::assertSame(1, normalizeState([
            'nextQueueNumber' => -4,
        ])['nextQueueNumber']);
    }

    public function testNormalizeStateConvertsNumericQueueNumber(): void
    {
        self::assertSame(7, normalizeState([
            'nextQueueNumber' => '7',
        ])['nextQueueNumber']);
    }

    public function testNormalizeStatePreservesValidArrays(): void
    {
        $patients = [['id' => 'p1']];
        $history = [['id' => 'h1']];

        self::assertSame([
            'patients' => $patients,
            'nextQueueNumber' => 4,
            'consultationHistory' => $history,
        ], normalizeState([
            'patients' => $patients,
            'nextQueueNumber' => 4,
            'consultationHistory' => $history,
        ]));
    }

    public function testLoadStateCreatesMissingFileWithDefaults(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'queue-missing-');
        unlink($file);
        $this->temporaryFiles[] = $file;

        self::assertSame(getDefaultState(), loadState($file));
        self::assertSame(getDefaultState(), json_decode(file_get_contents($file), true));
    }

    public function testLoadStateUsesDefaultsForEmptyFile(): void
    {
        $file = $this->temporaryFile('');

        self::assertSame(getDefaultState(), loadState($file));
    }

    public function testLoadStateUsesDefaultsForWhitespaceOnlyFile(): void
    {
        $file = $this->temporaryFile(" \n\t ");

        self::assertSame(getDefaultState(), loadState($file));
    }

    public function testLoadStateUsesDefaultsForInvalidJson(): void
    {
        $file = $this->temporaryFile('{not-json');

        self::assertSame(getDefaultState(), loadState($file));
    }

    public function testLoadStateUsesDefaultsForNonArrayJson(): void
    {
        $file = $this->temporaryFile('"a string"');

        self::assertSame(getDefaultState(), loadState($file));
    }

    public function testSaveAndLoadStateRoundTrip(): void
    {
        $file = $this->temporaryFile();
        $state = $this->state([
            $this->patient('p1', 'waiting'),
        ], [
            ['id' => 'h1'],
        ], 8);

        saveState($file, $state);

        self::assertSame($state, loadState($file));
    }

    public function testLoadStateNormalizesDecodedState(): void
    {
        $file = $this->temporaryFile(json_encode([
            'patients' => 'invalid',
            'nextQueueNumber' => 0,
            'consultationHistory' => [],
        ]));

        self::assertSame(getDefaultState(), loadState($file));
    }

    public function testPrimaryCredentialsAuthenticate(): void
    {
        self::assertTrue(validateCredentials(' admin ', 'primary', [
            'admin_username' => 'admin',
            'admin_password' => 'primary',
        ]));
    }

    public function testLegacyCredentialsAuthenticate(): void
    {
        self::assertTrue(validateCredentials('admin', 'legacy', [
            'admin_username' => 'admin',
            'admin_password' => 'primary',
            'legacy_admin_password' => 'legacy',
        ]));
    }

    public function testWrongCredentialsDoNotAuthenticate(): void
    {
        self::assertFalse(validateCredentials('admin', 'wrong', [
            'admin_username' => 'admin',
            'admin_password' => 'primary',
            'legacy_admin_password' => 'legacy',
        ]));
    }

    public function testWrongUsernameDoesNotAuthenticate(): void
    {
        self::assertFalse(validateCredentials('other', 'primary', [
            'admin_username' => 'admin',
            'admin_password' => 'primary',
        ]));
    }

    public function testEmptySubmittedCredentialsDoNotAuthenticate(): void
    {
        self::assertFalse(validateCredentials('', '', [
            'admin_username' => 'admin',
            'admin_password' => 'primary',
        ]));
    }

    public function testMissingLegacyPasswordCannotAuthenticateEmptyPassword(): void
    {
        self::assertFalse(validateCredentials('admin', '', [
            'admin_username' => 'admin',
            'admin_password' => 'primary',
        ]));
    }

    public function testEmptyLegacyPasswordCannotAuthenticateEmptyPassword(): void
    {
        self::assertFalse(validateCredentials('admin', '', [
            'admin_username' => 'admin',
            'admin_password' => 'primary',
            'legacy_admin_password' => '',
        ]));
    }

    public function testEmptyPrimaryPasswordCannotAuthenticateEmptyPassword(): void
    {
        self::assertFalse(validateCredentials('admin', '', [
            'admin_username' => 'admin',
            'admin_password' => '',
            'legacy_admin_password' => 'legacy',
        ]));
    }

    public function testAddRejectsWhitespaceOnlyName(): void
    {
        $result = $this->invoke($this->state(), [
            'action' => 'add',
            'name' => '  ',
        ]);

        self::assertSame(400, $result['status']);
        self::assertFalse($result['body']['success']);
        self::assertFalse($result['persist']);
    }

    public function testAddNormalizesPatientFieldsAndUsesGeneratedId(): void
    {
        $result = $this->invoke($this->state(next: 4), [
            'action' => 'add',
            'name' => '  Ana  ',
            'philHealthId' => ' PH1 ',
            'patientStatus' => ' PWD ',
            'philHealthStatus' => ' REGISTERED ',
        ]);

        self::assertSame([
            'id' => 'generated-id',
            'name' => 'Ana',
            'philHealthId' => 'PH1',
            'queueNumber' => 4,
            'status' => 'waiting',
            'patientStatus' => 'pwd',
            'type' => 'pwd',
            'philHealthStatus' => 'registered',
        ], $result['state']['patients'][0]);
        self::assertTrue($result['persist']);
    }

    public function testAddUsesPatientStatusWhenTypeIsAlsoPresent(): void
    {
        $result = $this->invoke($this->state(), [
            'action' => 'add',
            'name' => 'Ana',
            'patientStatus' => 'senior',
            'type' => 'pwd',
        ]);

        self::assertSame('senior', $result['state']['patients'][0]['patientStatus']);
        self::assertSame('senior', $result['state']['patients'][0]['type']);
    }

    public function testAddUsesTypeWhenPatientStatusIsAbsent(): void
    {
        $result = $this->invoke($this->state(), [
            'action' => 'add',
            'name' => 'Ana',
            'type' => 'senior',
        ]);

        self::assertSame('senior', $result['state']['patients'][0]['type']);
    }

    public function testTwoAddsUseConsecutiveQueueNumbers(): void
    {
        $first = $this->invoke($this->state(), [
            'action' => 'add',
            'name' => 'Ana',
        ]);
        $second = $this->invoke($first['state'], [
            'action' => 'add',
            'name' => 'Bea',
        ]);

        self::assertSame(1, $first['state']['patients'][0]['queueNumber']);
        self::assertSame(2, $second['state']['patients'][1]['queueNumber']);
        self::assertSame(3, $second['state']['nextQueueNumber']);
    }

    public function testServeNextPromotesFirstWaitingWhenNobodyIsServing(): void
    {
        $state = $this->state([
            $this->patient('p1', 'waiting'),
            $this->patient('p2', 'waiting', 'Second', 2),
        ]);

        $result = $this->invoke($state, ['action' => 'serve-next']);

        self::assertSame('serving', $result['state']['patients'][0]['status']);
        self::assertSame('waiting', $result['state']['patients'][1]['status']);
        self::assertSame([], $result['state']['consultationHistory']);
    }

    public function testServeNextCompletesServingPatientAndPromotesWaitingPatient(): void
    {
        $state = $this->state([
            $this->patient('p1', 'waiting'),
            $this->patient('p2', 'serving', 'Serving', 2),
            $this->patient('p3', 'waiting', 'Third', 3),
        ]);

        $result = $this->invoke($state, ['action' => 'serve-next']);

        self::assertSame('p2', $result['state']['consultationHistory'][0]['id']);
        self::assertSame('serving', $result['state']['patients'][0]['status']);
        self::assertSame('p1', $result['state']['patients'][0]['id']);
    }

    public function testServeNextCompletesServingPatientWhenNobodyIsWaiting(): void
    {
        $state = $this->state([
            $this->patient('p1', 'serving'),
        ]);

        $result = $this->invoke($state, ['action' => 'serve-next']);

        self::assertSame([], $result['state']['patients']);
        self::assertSame('p1', $result['state']['consultationHistory'][0]['id']);
    }

    public function testServeNextReindexesPatients(): void
    {
        $state = $this->state([
            2 => $this->patient('p1', 'serving'),
            5 => $this->patient('p2', 'waiting', 'Second', 2),
        ]);

        $result = $this->invoke($state, ['action' => 'serve-next']);

        self::assertSame([0], array_keys($result['state']['patients']));
    }

    public function testServeCompletesCurrentPatientAndServesRequestedPatient(): void
    {
        $state = $this->state([
            $this->patient('p1', 'serving'),
            $this->patient('p2', 'waiting', 'Second', 2),
        ]);

        $result = $this->invoke($state, [
            'action' => 'serve',
            'id' => 'p2',
        ]);

        self::assertSame('p1', $result['state']['consultationHistory'][0]['id']);
        self::assertSame('serving', $result['state']['patients'][0]['status']);
        self::assertSame('p2', $result['state']['patients'][0]['id']);
    }

    public function testServeRequiresId(): void
    {
        $result = $this->invoke($this->state(), ['action' => 'serve']);

        self::assertSame(400, $result['status']);
        self::assertFalse($result['persist']);
    }

    public function testServeUnknownIdLeavesNobodyServing(): void
    {
        $state = $this->state([
            $this->patient('p1', 'waiting'),
        ]);

        $result = $this->invoke($state, [
            'action' => 'serve',
            'id' => 'unknown',
        ]);

        self::assertSame('waiting', $result['state']['patients'][0]['status']);
    }

    public function testServeReindexesPatients(): void
    {
        $state = $this->state([
            3 => $this->patient('p1', 'serving'),
            7 => $this->patient('p2', 'waiting', 'Second', 2),
        ]);

        $result = $this->invoke($state, [
            'action' => 'serve',
            'id' => 'p2',
        ]);

        self::assertSame([0], array_keys($result['state']['patients']));
    }

    public function testFinishStoresTrimmedConsultationDetails(): void
    {
        $state = $this->state([
            [
                'id' => 'p1',
                'name' => 'Patient',
                'queueNumber' => 1,
                'status' => 'serving',
                'type' => 'senior',
                'philHealthId' => 'PH1',
            ],
        ]);

        $result = $this->invoke($state, [
            'action' => 'finish',
            'id' => 'p1',
            'icdCode' => ' J00 ',
            'consultationDetails' => ' Notes ',
        ]);

        self::assertSame('J00', $result['state']['consultationHistory'][0]['icdCode']);
        self::assertSame('Notes', $result['state']['consultationHistory'][0]['consultationDetails']);
        self::assertSame('senior', $result['state']['consultationHistory'][0]['patientStatus']);
    }

    public function testFinishUsesPatientDefaultsInHistory(): void
    {
        $state = $this->state([
            [
                'id' => 'p1',
                'name' => 'Patient',
                'queueNumber' => 1,
                'status' => 'serving',
            ],
        ]);

        $result = $this->invoke($state, [
            'action' => 'finish',
            'id' => 'p1',
        ]);

        self::assertSame('', $result['state']['consultationHistory'][0]['philHealthId']);
        self::assertSame('regular', $result['state']['consultationHistory'][0]['patientStatus']);
        self::assertSame('no-philhealth', $result['state']['consultationHistory'][0]['philHealthStatus']);
    }

    public function testFinishCarriesPatientPhilHealthStatus(): void
    {
        $state = $this->state([
            [
                'id' => 'p1',
                'name' => 'Patient',
                'queueNumber' => 1,
                'status' => 'serving',
                'philHealthStatus' => 'registered',
            ],
        ]);

        $result = $this->invoke($state, [
            'action' => 'finish',
            'id' => 'p1',
        ]);

        self::assertSame('registered', $result['state']['consultationHistory'][0]['philHealthStatus']);
    }

    public function testFinishRequiresId(): void
    {
        $result = $this->invoke($this->state(), ['action' => 'finish']);

        self::assertSame(400, $result['status']);
        self::assertFalse($result['persist']);
    }

    public function testFinishUnknownIdIsSuccessfulNoOp(): void
    {
        $state = $this->state([
            $this->patient('p1', 'waiting'),
        ]);

        $result = $this->invoke($state, [
            'action' => 'finish',
            'id' => 'unknown',
        ]);

        self::assertSame(200, $result['status']);
        self::assertSame($state, $result['state']);
        self::assertTrue($result['persist']);
    }

    public function testFinishReindexesPatients(): void
    {
        $state = $this->state([
            2 => $this->patient('p1', 'serving'),
            4 => $this->patient('p2', 'waiting', 'Second', 2),
        ]);

        $result = $this->invoke($state, [
            'action' => 'finish',
            'id' => 'p1',
        ]);

        self::assertSame([0], array_keys($result['state']['patients']));
    }

    public function testSkipChangesStatus(): void
    {
        $result = $this->invoke($this->state([
            $this->patient('p1', 'serving'),
        ]), [
            'action' => 'skip',
            'id' => 'p1',
        ]);

        self::assertSame('skipped', $result['state']['patients'][0]['status']);
    }

    public function testRecallChangesStatus(): void
    {
        $result = $this->invoke($this->state([
            $this->patient('p1', 'skipped'),
        ]), [
            'action' => 'recall',
            'id' => 'p1',
        ]);

        self::assertSame('waiting', $result['state']['patients'][0]['status']);
    }

    public function testSkipAndRecallRequireId(): void
    {
        self::assertSame(400, $this->invoke($this->state(), [
            'action' => 'skip',
        ])['status']);
        self::assertSame(400, $this->invoke($this->state(), [
            'action' => 'recall',
        ])['status']);
    }

    public function testSkipAndRecallUnknownIdsLeaveStatusesUnchanged(): void
    {
        $state = $this->state([
            $this->patient('p1', 'waiting'),
            $this->patient('p2', 'skipped', 'Second', 2),
        ]);

        self::assertSame($state, $this->invoke($state, [
            'action' => 'skip',
            'id' => 'unknown',
        ])['state']);
        self::assertSame($state, $this->invoke($state, [
            'action' => 'recall',
            'id' => 'unknown',
        ])['state']);
    }

    public function testEditUpdatesEditableFieldsOnly(): void
    {
        $state = $this->state([
            [
                'id' => 'p1',
                'name' => 'Old',
                'philHealthId' => 'OLD',
                'queueNumber' => 8,
                'status' => 'serving',
                'type' => 'pwd',
            ],
        ]);

        $result = $this->invoke($state, [
            'action' => 'edit',
            'id' => 'p1',
            'name' => ' New ',
            'philHealthId' => ' PH ',
            'type' => 'EMERGENCY',
            'philHealthStatus' => 'invalid',
        ]);

        self::assertSame('New', $result['state']['patients'][0]['name']);
        self::assertSame('PH', $result['state']['patients'][0]['philHealthId']);
        self::assertSame('emergency', $result['state']['patients'][0]['patientStatus']);
        self::assertSame(8, $result['state']['patients'][0]['queueNumber']);
        self::assertSame('serving', $result['state']['patients'][0]['status']);
    }

    public function testEditRejectsMissingIdOrBlankName(): void
    {
        self::assertSame(400, $this->invoke($this->state(), [
            'action' => 'edit',
            'name' => 'New',
        ])['status']);
        self::assertSame(400, $this->invoke($this->state(), [
            'action' => 'edit',
            'id' => 'p1',
            'name' => ' ',
        ])['status']);
    }

    public function testEditHistoryUpdatesMatchingEntry(): void
    {
        $state = $this->state([], [
            [
                'id' => 'h1',
                'icdCode' => 'OLD',
                'consultationDetails' => 'Old notes',
            ],
        ]);

        $result = $this->invoke($state, [
            'action' => 'edit-history',
            'id' => 'h1',
            'icdCode' => ' NEW ',
            'consultationDetails' => ' New notes ',
        ]);

        self::assertSame('NEW', $result['state']['consultationHistory'][0]['icdCode']);
        self::assertSame('New notes', $result['state']['consultationHistory'][0]['consultationDetails']);
    }

    public function testEditHistoryRequiresId(): void
    {
        self::assertSame(400, $this->invoke($this->state(), [
            'action' => 'edit-history',
        ])['status']);
    }

    public function testEditHistoryReturnsNotFound(): void
    {
        $result = $this->invoke($this->state(), [
            'action' => 'edit-history',
            'id' => 'missing',
        ]);

        self::assertSame(404, $result['status']);
        self::assertFalse($result['persist']);
    }

    public function testDeleteRemovesOnlyMatchingPatientAndReindexes(): void
    {
        $state = $this->state([
            2 => $this->patient('p1', 'waiting'),
            5 => $this->patient('p2', 'skipped', 'Second', 2),
        ]);

        $result = $this->invoke($state, [
            'action' => 'delete',
            'id' => 'p1',
        ]);

        self::assertSame(['p2'], array_column($result['state']['patients'], 'id'));
        self::assertSame([0], array_keys($result['state']['patients']));
    }

    public function testDeleteRequiresId(): void
    {
        $result = $this->invoke($this->state(), ['action' => 'delete']);

        self::assertSame(400, $result['status']);
        self::assertFalse($result['persist']);
    }

    public function testDeleteUnknownIdLeavesPatientsUnchanged(): void
    {
        $state = $this->state([
            $this->patient('p1', 'waiting'),
        ]);

        self::assertSame($state, $this->invoke($state, [
            'action' => 'delete',
            'id' => 'unknown',
        ])['state']);
    }

    public function testResetReturnsDefaultState(): void
    {
        $result = $this->invoke($this->state([
            $this->patient('p1', 'waiting'),
        ]), [
            'action' => 'reset',
        ]);

        self::assertSame(getDefaultState(), $result['state']);
    }

    public function testEmptyActionIsUnknown(): void
    {
        $result = $this->invoke($this->state(), ['action' => '']);

        self::assertSame(400, $result['status']);
        self::assertSame('Unknown action', $result['body']['message']);
        self::assertFalse($result['persist']);
    }

    public function testNonEmptyUnknownActionIsUnknown(): void
    {
        $result = $this->invoke($this->state(), ['action' => 'bogus']);

        self::assertSame(400, $result['status']);
        self::assertSame('Unknown action', $result['body']['message']);
    }

    public function testMutatingSuccessesArePersistent(): void
    {
        $actions = [
            ['action' => 'add', 'name' => 'A'],
            ['action' => 'serve-next'],
            ['action' => 'serve', 'id' => 'p1'],
            ['action' => 'finish', 'id' => 'p1'],
            ['action' => 'skip', 'id' => 'p1'],
            ['action' => 'recall', 'id' => 'p1'],
            ['action' => 'edit', 'id' => 'p1', 'name' => 'A'],
            ['action' => 'edit-history', 'id' => 'h1'],
            ['action' => 'delete', 'id' => 'p1'],
            ['action' => 'reset'],
        ];

        $state = $this->state([
            $this->patient('p1', 'waiting'),
        ], [
            ['id' => 'h1'],
        ]);

        foreach ($actions as $action) {
            self::assertTrue($this->invoke($state, $action)['persist']);
        }
    }

    public function testValidationErrorsAndNotFoundAreNotPersistent(): void
    {
        self::assertFalse($this->invoke($this->state(), [
            'action' => 'add',
            'name' => ' ',
        ])['persist']);
        self::assertFalse($this->invoke($this->state(), [
            'action' => 'serve',
        ])['persist']);
        self::assertFalse($this->invoke($this->state(), [
            'action' => 'edit-history',
            'id' => 'missing',
        ])['persist']);
    }
}
