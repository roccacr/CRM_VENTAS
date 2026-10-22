/** Recent activity has no real source yet; preview events must not appear as business results. */
export function FormalizationHomeInsights() {
    return (
        <section className="formalization-card" aria-labelledby="preview-activity-title">
            <div className="formalization-card__head">
                <h2 id="preview-activity-title">Movimientos recientes</h2>
            </div>
            <p className="formalization-grid__empty">Los movimientos recientes aún no están disponibles.</p>
        </section>
    );
}
