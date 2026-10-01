/**
 * Sección administrativa todavía sin contrato.
 *
 * Muestra el título para no abrir una pantalla vacía ni inventar datos.
 */
export function AdministrationSectionPage({ title }: { readonly title: string }) {
    return (
        <div className="global-home-dashboard">
            <section className="global-home-page-header" aria-labelledby="administration-section-page-title">
                <div>
                    <h1 id="administration-section-page-title">{title}</h1>
                </div>
            </section>
        </div>
    );
}
