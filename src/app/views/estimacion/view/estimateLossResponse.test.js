import assert from "node:assert/strict";
import test from "node:test";

import {
  getEstimateLossResponseStatus,
  isEstimateLossConfirmedByNetSuite,
} from "./estimateLossResponse.js";

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

test("isEstimateLossConfirmedByNetSuite valida solo respuestas exitosas", () => {
  assert.equal(
    isEstimateLossConfirmedByNetSuite({ data: { status: 200, Detalle: {} } }),
    true,
  );
  assert.equal(
    isEstimateLossConfirmedByNetSuite({ ok: false, errorMessage: "Request failed with status code 500" }),
    false,
  );
});
