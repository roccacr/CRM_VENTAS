import { performance } from "node:perf_hooks";

const baseUrl = process.env.PERF_BASE_URL ?? "http://localhost:8002/api/v1";
const paths = (process.env.PERF_PATHS ?? "/health/live,/health/ready")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);
const totalRequests = Number.parseInt(process.env.PERF_REQUESTS ?? "50", 10);
const concurrency = Number.parseInt(process.env.PERF_CONCURRENCY ?? "5", 10);
const maxP95Ms = process.env.PERF_MAX_P95_MS ? Number.parseInt(process.env.PERF_MAX_P95_MS, 10) : null;
const authToken = process.env.PERF_AUTH_TOKEN;

if (!paths.length || totalRequests < 1 || concurrency < 1) {
  throw new Error("Configura PERF_PATHS, PERF_REQUESTS y PERF_CONCURRENCY con valores validos.");
}

const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
const requestPlan = Array.from({ length: totalRequests }, (_, index) => paths[index % paths.length]);

const percentile = (values, percentileValue) => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;

  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
};

const runRequest = async (path) => {
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(normalizedPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
  const startedAt = performance.now();

  try {
    const response = await fetch(url, { headers });
    await response.arrayBuffer();

    return {
      ok: response.ok,
      status: response.status,
      path,
      ms: performance.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: "NETWORK_ERROR",
      path,
      error: error instanceof Error ? error.message : String(error),
      ms: performance.now() - startedAt,
    };
  }
};

const runPool = async () => {
  const results = [];
  let cursor = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < requestPlan.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await runRequest(requestPlan[current]);
    }
  });

  await Promise.all(workers);

  return results;
};

const startedAt = performance.now();
const results = await runPool();
const totalMs = performance.now() - startedAt;
const durations = results.map((result) => result.ms);
const failures = results.filter((result) => !result.ok);
const byStatus = results.reduce((accumulator, result) => {
  accumulator[result.status] = (accumulator[result.status] ?? 0) + 1;
  return accumulator;
}, {});

const summary = {
  baseUrl,
  paths,
  totalRequests,
  concurrency,
  ok: results.length - failures.length,
  failed: failures.length,
  rps: Number((results.length / (totalMs / 1000)).toFixed(2)),
  latencyMs: {
    min: Number(Math.min(...durations).toFixed(2)),
    avg: Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(2)),
    p50: Number(percentile(durations, 50).toFixed(2)),
    p95: Number(percentile(durations, 95).toFixed(2)),
    p99: Number(percentile(durations, 99).toFixed(2)),
    max: Number(Math.max(...durations).toFixed(2)),
  },
  byStatus,
};

console.log(JSON.stringify(summary, null, 2));

if (failures.length > 0) {
  console.error("Performance smoke failed: hubo respuestas no exitosas o errores de red.");
  process.exit(1);
}

if (maxP95Ms !== null && summary.latencyMs.p95 > maxP95Ms) {
  console.error(`Performance smoke failed: p95=${summary.latencyMs.p95}ms supera PERF_MAX_P95_MS=${maxP95Ms}ms.`);
  process.exit(1);
}
