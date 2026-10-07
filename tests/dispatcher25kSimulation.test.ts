import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run25kDispatcherSimulation } from '../scripts/simulate-25k-dispatcher.js';

test('25,000 Reminders Dispatcher Simulation: completes under 60 seconds (1 minute target)', async () => {
  const result = await run25kDispatcherSimulation(25_000, 16, 500);

  assert.equal(result.totalReminders, 25_000, 'Must process all 25,000 reminders');
  assert.equal(result.shardCount, 16, 'Must operate across 16 shards');
  assert.equal(result.success, true, 'Must succeed without failures');

  // Must finish well under 60,000ms (1 minute window)
  assert.ok(
    result.durationMs < 60_000,
    `Duration must be under 60,000ms (measured: ${result.durationMs}ms)`
  );

  // High throughput verification (> 1000 reminders/sec)
  assert.ok(
    result.throughputPerSecond > 1000,
    `Throughput must exceed 1000 reminders/sec (measured: ${result.throughputPerSecond}/s)`
  );
});
