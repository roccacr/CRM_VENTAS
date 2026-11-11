import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import CiSequencer from "../../../../deploy/habita/ci-sequencer.mjs";

const directories: string[] = [];
afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
});
function setup(groups = [["test/a.spec.ts"], ["test/b.spec.ts"]]) {
    const root = mkdtempSync(join(tmpdir(), "habita-ci-plan-"));
    directories.push(root);
    writeFileSync(join(root, "plan.json"), JSON.stringify({ groups, weights: { "test/a.spec.ts": 1000, "test/b.spec.ts": 5000 } }));
    vi.stubEnv("CI_TEST_PLAN", "plan.json");
    return root;
}

it("executes each discovered file once across all shards", async () => {
    const root = setup();
    const files = ["a", "b"].map((name) => ({ moduleId: join(root, `test/${name}.spec.ts`) }));
    const results = await Promise.all([1, 2].map((index) => new CiSequencer({ config: { root, shard: { index, count: 2 } } }).shard(files)));
    expect(results.flat()).toEqual(files);
    expect(new Set(results.flat()).size).toBe(files.length);
});

it("rejects stale plans, duplicate assignments and new unplanned files", async () => {
    const root = setup();
    const sequencer = new CiSequencer({ config: { root, shard: { index: 1, count: 1 } } });
    expect(() => sequencer.shard([])).toThrow("no coincide");
    const current = new CiSequencer({ config: { root, shard: { index: 1, count: 2 } } });
    expect(() => current.shard([{ moduleId: join(root, "test/new.spec.ts") }])).toThrow("ausente");
    const duplicate = setup([["test/a.spec.ts"], ["test/a.spec.ts"]]);
    expect(() => new CiSequencer({ config: { root: duplicate } })).toThrow("duplicado");
    const ordered = await current.sort([{ moduleId: join(root, "test/a.spec.ts") }, { moduleId: join(root, "test/b.spec.ts") }]);
    expect(ordered[0]?.moduleId).toContain("b.spec.ts");
});
