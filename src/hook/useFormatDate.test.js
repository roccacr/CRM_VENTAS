import assert from "node:assert/strict";
import test from "node:test";

import { formatDate, getDateSortValue } from "./useFormatDate.js";

test("formatDate muestra timestamps MySQL sin moverlos de hora", () => {
   assert.deepEqual(formatDate("2026-09-11 14:37:31"), {
      formattedDate: "2026-09-11",
      formattedTime: "02:37:31 PM",
   });
});

test("getDateSortValue ordena timestamps MySQL por su hora literal CRM", () => {
   const sorted = ["2026-09-11 14:37:31", "2026-09-11 14:29:59"].sort((a, b) => getDateSortValue(b) - getDateSortValue(a));

   assert.deepEqual(sorted, ["2026-09-11 14:37:31", "2026-09-11 14:29:59"]);
});
