/**
 * 25,000 Reminders Dispatcher Simulation Runner
 * Simulates high-load dispatch across 16 shards under a 1-minute window.
 */

export interface SimulationResult {
  totalReminders: number;
  shardCount: number;
  batchSize: number;
  durationMs: number;
  throughputPerSecond: number;
  p95BatchLatencyMs: number;
  success: boolean;
}

export async function run25kDispatcherSimulation(
  totalReminders = 25_000,
  shardCount = 16,
  batchSize = 500
): Promise<SimulationResult> {
  const shardQueues: Array<Array<{ id: string; fireAt: number }>> = Array.from({ length: shardCount }, () => []);
  const now = Date.now();

  // Populate 25,000 reminders across 16 shards
  for (let i = 0; i < totalReminders; i++) {
    const shard = i % shardCount;
    shardQueues[shard].push({
      id: `rem_${i}`,
      fireAt: now - Math.floor(Math.random() * 30_000), // Due within last 30s
    });
  }

  const batchLatencies: number[] = [];
  const startTime = Date.now();
  let processedCount = 0;

  // Process all shards concurrently (bounded parallel workers)
  await Promise.all(
    shardQueues.map(async (queue, shardIdx) => {
      while (queue.length > 0) {
        const batchStart = Date.now();
        const batch = queue.splice(0, batchSize);

        // Simulate atomic lock & FCM multicast transmission (3-7ms per batch of 500)
        await new Promise((resolve) => setTimeout(resolve, 4));

        const batchDuration = Date.now() - batchStart;
        batchLatencies.push(batchDuration);
        processedCount += batch.length;
      }
    })
  );

  const durationMs = Date.now() - startTime;
  batchLatencies.sort((a, b) => a - b);
  const p95BatchLatencyMs = batchLatencies[Math.floor(batchLatencies.length * 0.95)] || 0;
  const throughputPerSecond = Math.round((processedCount / (durationMs || 1)) * 1000);

  return {
    totalReminders: processedCount,
    shardCount,
    batchSize,
    durationMs,
    throughputPerSecond,
    p95BatchLatencyMs,
    success: processedCount === totalReminders && durationMs < 60_000,
  };
}

// Standalone execution support
if (process.argv[1] && process.argv[1].endsWith('simulate-25k-dispatcher.ts')) {
  run25kDispatcherSimulation().then((result) => {
    console.log('=== نتائح محاكاة إرسال 25 ألف تذكير في الدقيقة ===');
    console.log(`إجمالي التذكيرات: ${result.totalReminders.toLocaleString()}`);
    console.log(`عدد الـ Shards: ${result.shardCount}`);
    console.log(`الزمن الكلي: ${result.durationMs}ms (${(result.durationMs / 1000).toFixed(2)} ثانية)`);
    console.log(`معدل الإرسال (Throughput): ${result.throughputPerSecond.toLocaleString()} تذكير/ثانية`);
    console.log(`زمن معالجة الحزمة p95: ${result.p95BatchLatencyMs}ms`);
    console.log(`الحالة: ${result.success ? '✅ نجاح باهر تحت حاجز الـ 60 ثانية' : '❌ تجاوز المهلة'}`);
  });
}
