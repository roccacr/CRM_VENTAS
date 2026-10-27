/** Recent activity has no real source yet; preview events must not appear as business results. */
export function FormalizationHomeInsights() {
    return (
        <section className="formalization-card formalization-activity" aria-labelledby="preview-activity-title">
            <div className="formalization-activity__heading">
                <h2 id="preview-activity-title">Movimientos recientes</h2>
                <p>Lo último que pasó con las órdenes.</p>
            </div>
            <p className="formalization-grid__empty">Los movimientos recientes aún no están disponibles.</p>
        </section>
    );
}
