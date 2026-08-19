<?php

use PHPUnit\Framework\TestCase;

final class QueueLogicTest extends TestCase
{
    private function state(array $overrides = []): array
    {
        return array_replace_recursive(getDefaultState(), $overrides);
    }

    private function invoke(array $state, array $payload): array
    {
        return queueAction($state, $payload, static fn(): string => 'generated-id', static fn(): string => '2024-01-02 03:04:05');
    }

    public function testDefaultsAndNormalization(): void
    {
        self::assertSame(getDefaultState(), normalizeState([]));
        self::assertSame(getDefaultState(), normalizeState(['patients' => 'bad', 'consultationHistory' => null, 'nextQueueNumber' => 0]));
        self::assertSame(1, normalizeState(['nextQueueNumber' => -2])['nextQueueNumber']);
        self::assertSame(7, normalizeState(['nextQueueNumber' => '7'])['nextQueueNumber']);
    }

    public function testCredentialsIncludingLegacyAndTrimmedUsername(): void
    {
        $config = ['admin_username' => 'admin', 'admin_password' => 'primary', 'legacy_admin_password' => 'legacy'];
        self::assertTrue(validateCredentials(' admin ', 'primary', $config));
        self::assertTrue(validateCredentials('admin', 'legacy', $config));
        self::assertFalse(validateCredentials('admin', 'wrong', $config));
        self::assertFalse(validateCredentials('other', 'primary', $config));
        self::assertFalse(validateCredentials('', '', $config));
    }

    public function testAddValidationNormalizationAndQueueNumber(): void
    {
        self::assertSame(400, $this->invoke($this->state(), ['action' => 'add', 'name' => '  '])['status']);
        $result = $this->invoke($this->state(['nextQueueNumber' => 4]), [
            'action' => 'add', 'name' => '  Ana  ', 'philHealthId' => '  PH1 ',
            'patientStatus' => ' PWD ', 'philHealthStatus' => ' REGISTERED ',
        ]);
        $patient = $result['state']['patients'][0];
        self::assertSame(['id' => 'generated-id', 'name' => 'Ana', 'philHealthId' => 'PH1', 'queueNumber' => 4,
            'status' => 'waiting', 'patientStatus' => 'pwd', 'type' => 'pwd', 'philHealthStatus' => 'registered'], $patient);
        self::assertSame(5, $result['state']['nextQueueNumber']);
        $fallback = $this->invoke($this->state(), ['action' => 'add', 'name' => 'A', 'patientStatus' => 'bad', 'philHealthStatus' => 'bad']);
        self::assertSame('regular', $fallback['state']['patients'][0]['type']);
        self::assertSame('no-philhealth', $fallback['state']['patients'][0]['philHealthStatus']);
        self::assertSame('senior', $this->invoke($this->state(), ['action' => 'add', 'name' => 'B', 'type' => 'senior'])['state']['patients'][0]['type']);
    }

    public function testServeNextCompletesAndPromotesFirstWaiting(): void
    {
        $state = $this->state(['patients' => [
            ['id' => 'a', 'name' => 'A', 'queueNumber' => 1, 'status' => 'waiting'],
            ['id' => 'b', 'name' => 'B', 'queueNumber' => 2, 'status' => 'serving'],
            ['id' => 'c', 'name' => 'C', 'queueNumber' => 3, 'status' => 'waiting'],
        ]]);
        $result = $this->invoke($state, ['action' => 'serve-next']);
        self::assertSame(['a', 'c'], array_column($result['state']['patients'], 'id'));
        self::assertSame('serving', $result['state']['patients'][0]['status']);
        self::assertSame('b', $result['state']['consultationHistory'][0]['id']);
        self::assertSame('2024-01-02 03:04:05', $result['state']['consultationHistory'][0]['finishedAt']);
        self::assertSame([], $this->invoke($this->state(), ['action' => 'serve-next'])['state']['patients']);
    }

    public function testServeCompletesCurrentAndServesRequestedOrNoOne(): void
    {
        $state = $this->state(['patients' => [
            ['id' => 'a', 'name' => 'A', 'queueNumber' => 1, 'status' => 'serving'],
            ['id' => 'b', 'name' => 'B', 'queueNumber' => 2, 'status' => 'waiting'],
        ]]);
        $result = $this->invoke($state, ['action' => 'serve', 'id' => 'b']);
        self::assertSame('b', $result['state']['patients'][0]['id']);
        self::assertSame('a', $result['state']['consultationHistory'][0]['id']);
        self::assertSame(400, $this->invoke($state, ['action' => 'serve'])['status']);
        $unknown = $this->invoke($this->state(['patients' => [['id' => 'a', 'status' => 'waiting']]]), ['action' => 'serve', 'id' => 'x']);
        self::assertArrayNotHasKey('serving', array_flip(array_column($unknown['state']['patients'], 'status')));
    }

    public function testFinishHistoryFieldsAndUnknownNoOp(): void
    {
        $state = $this->state(['patients' => [[
            'id' => 'a', 'name' => 'A', 'queueNumber' => 1, 'status' => 'serving', 'type' => 'senior', 'philHealthId' => 'PH',
        ]]]);
        $result = $this->invoke($state, ['action' => 'finish', 'id' => 'a', 'icdCode' => '  J00 ', 'consultationDetails' => ' notes ']);
        self::assertSame([], $result['state']['patients']);
        self::assertSame(['id' => 'a', 'name' => 'A', 'queueNumber' => 1, 'philHealthId' => 'PH',
            'patientStatus' => 'senior', 'philHealthStatus' => 'no-philhealth', 'icdCode' => 'J00',
            'consultationDetails' => 'notes', 'finishedAt' => '2024-01-02 03:04:05'], $result['state']['consultationHistory'][0]);
        self::assertSame(400, $this->invoke($state, ['action' => 'finish'])['status']);
        self::assertSame($state, $this->invoke($state, ['action' => 'finish', 'id' => 'missing'])['state']);
    }

    public function testSkipRecallAndMissingIds(): void
    {
        $state = $this->state(['patients' => [['id' => 'a', 'status' => 'serving']]]);
        self::assertSame('skipped', $this->invoke($state, ['action' => 'skip', 'id' => 'a'])['state']['patients'][0]['status']);
        self::assertSame('waiting', $this->invoke($state, ['action' => 'recall', 'id' => 'a'])['state']['patients'][0]['status']);
        self::assertSame(400, $this->invoke($state, ['action' => 'skip'])['status']);
        self::assertSame($state, $this->invoke($state, ['action' => 'recall', 'id' => 'x'])['state']);
    }

    public function testEditUpdatesOnlyEditableFields(): void
    {
        $state = $this->state(['patients' => [['id' => 'a', 'name' => 'A', 'philHealthId' => 'old', 'queueNumber' => 8, 'status' => 'serving', 'type' => 'pwd']]]);
        $result = $this->invoke($state, ['action' => 'edit', 'id' => 'a', 'name' => ' New ', 'philHealthId' => ' PH ', 'type' => 'EMERGENCY', 'philHealthStatus' => 'invalid']);
        self::assertSame(['id' => 'a', 'name' => 'New', 'philHealthId' => 'PH', 'queueNumber' => 8, 'status' => 'serving',
            'type' => 'emergency', 'patientStatus' => 'emergency', 'philHealthStatus' => 'no-philhealth'], $result['state']['patients'][0]);
        self::assertSame(400, $this->invoke($state, ['action' => 'edit', 'id' => 'a', 'name' => ' '])['status']);
        self::assertSame(400, $this->invoke($state, ['action' => 'edit', 'name' => 'x'])['status']);
    }

    public function testHistoryDeleteResetAndUnknownActions(): void
    {
        $state = $this->state(['patients' => [['id' => 'a'], ['id' => 'b']], 'consultationHistory' => [['id' => 'h', 'icdCode' => 'x']]]);
        $edited = $this->invoke($state, ['action' => 'edit-history', 'id' => 'h', 'icdCode' => ' J ', 'consultationDetails' => ' D ']);
        self::assertSame('J', $edited['state']['consultationHistory'][0]['icdCode']);
        self::assertSame(400, $this->invoke($state, ['action' => 'edit-history'])['status']);
        self::assertSame(404, $this->invoke($state, ['action' => 'edit-history', 'id' => 'x'])['status']);
        self::assertSame(['b'], array_column($this->invoke($state, ['action' => 'delete', 'id' => 'a'])['state']['patients'], 'id'));
        self::assertSame(getDefaultState(), $this->invoke($state, ['action' => 'reset'])['state']);
        self::assertSame(400, $this->invoke($state, ['action' => ''])['status']);
    }
}
