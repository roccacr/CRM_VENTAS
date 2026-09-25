import { Ability, AbilityBuilder } from "@casl/ability";
import { Injectable } from "@nestjs/common";

import type { EffectivePermission, EffectivePermissionCalculation, EffectivePermissionResult, KnownPermissionScope, PermissionInput, PermissionOverrideInput } from "./permission.types.js";
import { resolveHighestPermissionScope } from "./permission-scope.js";

export const DEFAULT_DIRECT_OVERRIDE_SCOPE: KnownPermissionScope = "self";

type CrmAbility = Ability<[string, "all"]>;
type EffectivePermissionMap = Map<string, EffectivePermission>;

/**
 * Calcula permisos efectivos para el corte actual de identidad.
 *
 * Formula aprobada para P0-S1A:
 * permisos por rol + grants directos - denies directos.
 *
 * Delegacion no forma parte de este servicio todavia. Cuando se apruebe, debe
 * entrar como input explicito nuevo en vez de mezclarse silenciosamente con
 * overrides directos.
 */
@Injectable()
export class EffectivePermissionService {
    /**
     * Resuelve la lista final de permisos y un helper pequeño `can`.
     *
     * Los overrides directos se aplican despues de permisos por rol para que un
     * deny especifico del usuario pueda quitar un permiso aunque el rol lo
     * otorgue.
     */
    calculate(input: EffectivePermissionCalculation): EffectivePermissionResult {
        const effective = new Map<string, EffectivePermission>();

        for (const permission of input.rolePermissions) {
            this.applyRolePermission(effective, permission);
        }

        for (const override of input.overrides) {
            if (override.effect === "allow") {
                this.applyDirectAllow(effective, override);
            }
        }

        for (const override of input.overrides) {
            if (override.effect === "deny") {
                this.applyDirectDeny(effective, override);
            }
        }

        const permissions = this.sortPermissions(effective);
        const ability = this.buildAbility(permissions);

        return {
            permissions,
            can: (permissionCode: string) => ability.can(permissionCode, "all"),
        };
    }

    /**
     * Agrega al mapa de trabajo un permiso allow derivado de rol.
     */
    private applyRolePermission(effective: EffectivePermissionMap, permission: PermissionInput): void {
        effective.set(permission.code, {
            code: permission.code,
            effect: "allow",
            scope: permission.scope,
            source: "role",
        });
    }

    /**
     * Aplica un allow especifico de usuario despues de permisos por rol.
     *
     * Un allow directo no debe reducir un scope ya otorgado por rol. Si el rol
     * concede `all_areas` y el override directo usa el scope minimo por defecto,
     * el resultado conserva el scope mas amplio.
     */
    private applyDirectAllow(effective: EffectivePermissionMap, override: PermissionOverrideInput): void {
        const current = effective.get(override.code);
        const scope = current?.effect === "allow" ? resolveHighestPermissionScope([current.scope, override.scope]) : override.scope;

        effective.set(override.code, {
            code: override.code,
            effect: "allow",
            scope,
            source: "override",
        });
    }

    /**
     * Aplica un deny especifico de usuario al final de la formula.
     *
     * Regla de ley P0-S1A: un deny directo siempre gana sobre permisos por rol
     * y sobre grants directos del mismo usuario, sin depender del orden en que
     * vengan los overrides desde base de datos.
     */
    private applyDirectDeny(effective: EffectivePermissionMap, override: PermissionOverrideInput): void {
        effective.set(override.code, {
            code: override.code,
            effect: "deny",
            scope: null,
            source: "override",
        });
    }

    /**
     * Retorna una lista deterministica para respuestas API y pruebas.
     */
    private sortPermissions(effective: EffectivePermissionMap): EffectivePermission[] {
        return [...effective.values()].sort((left, right) => left.code.localeCompare(right.code));
    }

    /**
     * Convierte permisos resueltos al objeto ability en memoria de CASL.
     *
     * Este runtime solo revisa action codes contra el subject `all`. El filtrado
     * de recursos para futuras listas de leads debe empujarse a predicados SQL;
     * no se deben cargar listas completas para filtrarlas en memoria.
     */
    private buildAbility(permissions: EffectivePermission[]): CrmAbility {
        const { can, cannot, build } = new AbilityBuilder<CrmAbility>(Ability);

        for (const permission of permissions) {
            if (permission.effect === "deny") {
                cannot(permission.code, "all");
                continue;
            }

            can(permission.code, "all");
        }

        return build();
    }
}
