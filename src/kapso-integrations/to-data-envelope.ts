/** Envelope `{ data }` de las rutas internas CRM. */
export function toDataEnvelope<T>(data: T): { readonly data: T } {
    return { data };
}
