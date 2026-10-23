/** Standalone, non-CI: pnpm exec tsx scripts/performance/home-summary-benchmark.ts [requests=100] */
import { deepStrictEqual } from "node:assert";
import { performance } from "node:perf_hooks";

import Fastify, { type FastifyInstance } from "fastify";

import { createSummaryDouble } from "./home-summary-double.js";
import { evaluateSynthetic, generateOrders, oracle, type StageCounts } from "./home-summary-synthetic.js";

const requests = Number(process.argv[2] ?? 100);
if (!Number.isSafeInteger(requests) || requests < 50 || requests > 10000) throw new Error("Request count must be an integer from 50 to 10000");

/** Fixed client concurrency, including response correctness checks in measured latency. */
async function measure(app: FastifyInstance, counts: StageCounts, concurrency: number) {
    const latencies: number[] = [];
    let errors = 0;
    let next = 0;
    /** One timed request; HTTP and payload mismatches count as errors. */
    const request = async () => {
        const start = performance.now();
        try {
            const response = await app.inject({ method: "GET", url: "/formalization/home/summary" });
            if (response.statusCode !== 200) throw new Error("HTTP failure");
            deepStrictEqual(response.json<{ counts: StageCounts }>().counts, counts);
        } catch {
            errors++;
        }
        latencies.push(performance.now() - start);
    };
    /** Runs requests back to back until the total is reached, so concurrency is constant. */
    const worker = async () => {
        while (next++ < requests) await request();
    };
    const started = performance.now();
    await Promise.all(Array.from({ length: concurrency }, worker));
    const elapsedMs = performance.now() - started;
    latencies.sort((a, b) => a - b);
    /** Nearest-rank percentile of the sorted latencies. */
    const percentile = (p: number) => latencies[Math.ceil(p * latencies.length) - 1];
    return { requests: latencies.length, errors, errorRate: errors / requests, elapsedMs, throughputRps: (requests * 1000) / elapsedMs, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99) };
}

/** Thin test route around real service/repositories, not the production security pipeline. */
async function benchmark(size: number, expected: ReturnType<typeof evaluateSynthetic>, delayMs: number) {
    const f = createSummaryDouble(expected, delayMs);
    const app = Fastify({ logger: false });
    let active = 0;
    let peak = 0;
    app.get("/formalization/home/summary", async (_request, reply) => {
        active++;
        peak = Math.max(peak, active);
        try {
            return await reply.header("Cache-Control", "no-store").send(await f.service.summary("synthetic"));
        } finally {
            active--;
        }
    });
    try {
        await app.ready();
        for (let i = 0; i < 20; i++) await app.inject({ method: "GET", url: "/formalization/home/summary" });
        for (const concurrency of [1, 10, 50]) {
            f.metrics.native = 0;
            f.metrics.legacy = 0;
            f.metrics.transactions = 0;
            peak = 0;
            f.pool.maxActiveConnections = 0;
            f.pool.peakQueue = 0;
            const result = await measure(app, expected.counts, concurrency);
            console.log(
                JSON.stringify({
                    mode: "Fastify inject + real Home service/repositories + precomputed SQL doubles + simulated FIFO pool10 + synthetic delays; NOT real MySQL pool or SQL execution",
                    size,
                    delayMsPerSource: delayMs,
                    concurrency,
                    ...result,
                    peakInFlight: peak,
                    simulatedPool: { ...f.pool },
                    sourceQueryCalls: { ...f.metrics, perRequest: (f.metrics.native + f.metrics.legacy) / requests },
                    rssBytes: process.memoryUsage().rss,
                    processPeakRssBytes: process.resourceUsage().maxRSS * 1024,
                }),
            );
            if (result.errors || f.metrics.native !== requests || f.metrics.legacy !== requests) throw new Error("Synthetic HTTP acceptance failed");
            if (f.pool.maxActiveConnections > f.pool.limit || f.pool.activeConnections !== 0) throw new Error("Simulated pool acceptance failed");
        }
    } finally {
        await app.close();
        await f.db.destroy();
    }
}

console.log(JSON.stringify({ mode: "NO database, env, sockets, SQL execution or production latency claims", seed: 42, node: process.version, requests, annualDefinition: "distinct eligible orders with ANY closed event effective in Costa Rica year, including reopened orders; current stage and annual count can overlap" }));
for (const size of [100000, 1000000]) {
    const started = performance.now();
    const expected = oracle(generateOrders(size));
    deepStrictEqual(evaluateSynthetic(generateOrders(size)), expected);
    console.log(JSON.stringify({ mode: "two independent streamed JS models outside HTTP timing", size, events: size * 2, preparationMs: performance.now() - started, counts: expected.counts, duplicatesExcluded: expected.duplicatesExcluded }));
    for (const delayMs of [0, 20]) await benchmark(size, expected, delayMs);
}
