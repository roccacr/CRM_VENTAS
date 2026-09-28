import type { Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";

/** Estado canonico activo usado por las tablas de identidad. */
export const ACTIVE_STATUS = "active";

/** Estado canonico expirado para tokens de vida corta. */
export const EXPIRED_STATUS = "expired";

/** Estado canonico de refresh consumido correctamente por rotacion. */
export const ROTATED_STATUS = "rotated";

/** Estado canonico para reuso de refresh token, tratado como posible robo. */
export const REUSED_STATUS = "reused";

/** Estado canonico de revocacion manual o automatica. */
export const REVOKED_STATUS = "revoked";

/** Codigo canonico del proveedor local de correo/clave. */
export const LOCAL_PROVIDER_CODE = "local";

/** Estado local pendiente para invitacion/reset sin password activo. */
export const PENDING_LOCAL_STATUS = "pending";

/** Estado canonico de token de activacion/reset ya consumido. */
export const USED_STATUS = "used";

/** Fuente comun de auditoria para eventos emitidos por el runtime de identidad. */
export const IDENTITY_RUNTIME_AUDIT_SOURCE = "identity_runtime";

/** Estados locales que permiten mostrar login local como proveedor disponible. */
export const LOCAL_PROVIDER_AVAILABLE_STATUSES = new Set([ACTIVE_STATUS, PENDING_LOCAL_STATUS]);

const UPDATE_RESULT_EMPTY_COUNT = 0;

export type IdentityTransaction = Transaction<CrmDatabase>;

export type UpdateResultWithCount = {
    numUpdatedRows?: bigint | number;
};

/**
 * Determina si un UPDATE realmente cambio una fila.
 *
 * Kysely devuelve `numUpdatedRows` como bigint en MySQL. Centralizar la lectura
 * evita doble auditoria en carreras concurrentes de logout, reset o refresh.
 */
export const hasUpdatedRows = (result: UpdateResultWithCount | undefined): boolean => Number(result?.numUpdatedRows ?? UPDATE_RESULT_EMPTY_COUNT) > UPDATE_RESULT_EMPTY_COUNT;

/**
 * Devuelve la fecha mas temprana entre dos vencimientos.
 *
 * La rotacion de refresh renueva credenciales opacas, pero no puede extender
 * la ventana absoluta de ocho horas de la sesion BFF.
 */
export const earliestDate = (first: Date, second: Date): Date => (first.getTime() <= second.getTime() ? first : second);
