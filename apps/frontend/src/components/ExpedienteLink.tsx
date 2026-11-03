/** Display-only normalization: only absolute HTTP(S) URLs become external links. Stored values stay intact. */
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
