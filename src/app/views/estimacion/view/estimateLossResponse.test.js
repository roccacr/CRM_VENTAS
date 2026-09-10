import assert from "node:assert/strict";
import test from "node:test";

import { getEstimateLossResponseStatus } from "./estimateLossResponse.js";

test("getEstimateLossResponseStatus lee status dentro de Detalle", () => {
  assert.equal(
    getEstimateLossResponseStatus({ data: { Detalle: { status: 200 } } }),
    200,
  );
});

test("getEstimateLossResponseStatus lee status superior retornado por backend", () => {
  assert.equal(
    getEstimateLossResponseStatus({ data: { status: 200, Detalle: {} } }),
    200,
  );
});
