import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

interface Specification {
  readonly moduleId: string;
}
interface Context {
  readonly config: {
    readonly root: string;
    readonly shard?:
      { readonly index: number; readonly count: number } | undefined;
  };
}

/** Extensión pública de Vitest: el plan decide el reparto, nunca qué pruebas existen. Solo se activa en CI_TEST_PLAN. */
export default class CiSequencer {
  private readonly context: Context;
  private readonly groups: readonly (readonly string[])[];
  private readonly weights: ReadonlyMap<string, number>;
  private readonly assigned: ReadonlySet<string>;

  constructor(context: Context) {
    this.context = context;
    const location = process.env.CI_TEST_PLAN;
    if (!location) throw new Error("Falta el plan de pruebas de CI.");
    const input: unknown = JSON.parse(
      readFileSync(resolve(context.config.root, location), "utf8"),
    );
    if (
      !input ||
      typeof input !== "object" ||
      !("groups" in input) ||
      !Array.isArray(input.groups) ||
      !("weights" in input) ||
      !input.weights ||
      typeof input.weights !== "object"
    )
      throw new Error("Plan de CI inválido.");
    const groups: string[][] = [];
    const assigned = new Set<string>();
    for (const group of input.groups) {
      if (!Array.isArray(group) || !group.length)
        throw new Error("Lote vacío o inválido.");
      const names: string[] = [];
      for (const name of group) {
        if (
          typeof name !== "string" ||
          !name.startsWith("test/") ||
          name.includes("..") ||
          name.includes("\\") ||
          assigned.has(name)
        )
          throw new Error("Archivo inválido o duplicado en el plan.");
        assigned.add(name);
        names.push(name);
      }
      groups.push(names);
    }
    if (!groups.length) throw new Error("Plan de CI vacío.");
    this.groups = groups;
    this.assigned = assigned;
    this.weights = new Map(
      Object.entries(input.weights).map(([name, value]) => [
        name,
        typeof value === "number" && Number.isFinite(value) && value > 0
          ? value
          : 1000,
      ]),
    );
  }

  private name(file: Specification): string {
    const name = relative(this.context.config.root, file.moduleId)
      .split(sep)
      .join("/");
    if (!this.assigned.has(name))
      throw new Error(
        "Vitest descubrió un archivo ausente del plan; se debe volver a planificar.",
      );
    return name;
  }

  /** Conserva todos los archivos asignados por el plan, incluso si Vitest invoca por pool. */
  shard<T extends Specification>(files: T[]): Promise<T[]> {
    const shard = this.context.config.shard;
    if (
      !shard ||
      shard.count !== this.groups.length ||
      shard.index < 1 ||
      shard.index > shard.count
    )
      throw new Error("El lote solicitado no coincide con el plan.");
    const wanted = new Set(this.groups[shard.index - 1]);
    return Promise.resolve(files.filter((file) => wanted.has(this.name(file))));
  }

  /** Los archivos lentos arrancan primero dentro de cada runner; conserva aislamiento y workers de Vitest. */
  sort<T extends Specification>(files: T[]): Promise<T[]> {
    return Promise.resolve(
      [...files].sort(
        (a, b) =>
          (this.weights.get(this.name(b)) ?? 1000) -
            (this.weights.get(this.name(a)) ?? 1000) ||
          this.name(a).localeCompare(this.name(b)),
      ),
    );
  }
}
