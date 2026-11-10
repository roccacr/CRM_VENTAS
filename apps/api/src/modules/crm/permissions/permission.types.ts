/**
 * Forma del permiso efectivo.
 *
 * Los cinco alcances conocidos van de la persona a todas las areas. El tipo
 * admite ademas un texto cualquiera para no perder un valor ya guardado. Un
 * deny lleva alcance nulo: no describe una poblacion.
 */
export type KnownPermissionScope = "self" | "assigned" | "own_area" | "own_area_and_children" | "all_areas";
export type PermissionScope = KnownPermissionScope | (string & {});
export type PermissionEffect = "allow" | "deny";
export type PermissionSource = "role" | "override" | "system";

export interface PermissionInput {
    code: string;
    scope: PermissionScope;
}

export interface PermissionOverrideInput extends PermissionInput {
    effect: PermissionEffect;
}

export type EffectivePermission =
    | {
          code: string;
          effect: "allow";
          scope: PermissionScope;
          source: PermissionSource;
      }
    | {
          code: string;
          effect: "deny";
          scope: null;
          source: PermissionSource;
      };

export interface EffectivePermissionCalculation {
    rolePermissions: PermissionInput[];
    overrides: PermissionOverrideInput[];
}

export interface EffectivePermissionResult {
    permissions: EffectivePermission[];
    can: (permissionCode: string) => boolean;
}
