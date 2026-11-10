/**
 * Solo pinta el valor. No lo reescribe en el expediente.
 * Un texto vacío queda en raya. Una URL absoluta `http` o `https`, válida y sin importar mayúsculas, se abre en otra pestaña sin entregar `window.opener`. El texto visible es Ver expediente.
 * Una ruta relativa, `javascript:` u otro esquema se muestra tal como llegó, para no convertirlo en un enlace.
 */
export function ExpedienteLink({ value }: { readonly value: string | null | undefined }) {
    const url = value?.trim() ?? "";
    if (!url) return <>—</>;
    if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) return <>{value}</>;
    return (
        <a href={url} title={url} target="_blank" rel="noopener noreferrer">
            Ver expediente
        </a>
    );
}
