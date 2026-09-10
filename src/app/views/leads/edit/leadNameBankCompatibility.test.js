import assert from "node:assert/strict";
import test from "node:test";

import {
   getBankCompatibleLeadName,
   isBankCompatibleLeadName,
} from "./leadNameBankCompatibility.js";

test("getBankCompatibleLeadName reemplaza tildes y enie por letras simples", () => {
   assert.equal(
      getBankCompatibleLeadName("José Núñez Álvarez"),
      "Jose Nunez Alvarez",
   );
});

test("getBankCompatibleLeadName reemplaza otros caracteres especiales por espacios", () => {
   assert.equal(
      getBankCompatibleLeadName("María-José O'Connor #2"),
      "Maria Jose O Connor 2",
   );
});

test("isBankCompatibleLeadName detecta nombres que deben corregirse", () => {
   assert.equal(isBankCompatibleLeadName("Ana Maria Lopez"), true);
   assert.equal(isBankCompatibleLeadName("Ana María López"), false);
   assert.equal(isBankCompatibleLeadName("Ana-Maria Lopez"), false);
});
