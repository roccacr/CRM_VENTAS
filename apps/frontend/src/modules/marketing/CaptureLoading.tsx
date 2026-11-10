const TABLE_ROWS = [78, 62, 70, 54, 66, 48, 58, 44];
const BAR_GROUPS = [
    [92, 100, 8],
    [20, 46, 34],
    [12, 70, 24],
    [38, 18, 52],
    [60, 10, 30],
    [26, 44, 14],
];

/** Estado de carga con la forma del reporte, tabla de resumen y gráfico, para que la página no salte cuando llegan los datos. Es estático: no hay brillo animado. */
export function CaptureLoading() {
    return (
        <section className="marketing-card capture-block capture-loading" role="status" aria-live="polite" aria-label="Cargando reporte">
            <header className="capture-loading__head">
                <span className="capture-loading__bar capture-loading__bar--title" />
                <span className="capture-loading__bar capture-loading__bar--chip" />
            </header>
            <div className="capture-loading__body" aria-hidden="true">
                <div className="capture-loading__table">
                    <span className="capture-loading__bar capture-loading__bar--header" />
                    {TABLE_ROWS.map((width, index) => (
                        <div className="capture-loading__row" key={index}>
                            <span className="capture-loading__bar" style={{ width: `${String(width)}%` }} />
                            <span className="capture-loading__bar capture-loading__bar--number" />
                        </div>
                    ))}
                </div>
                <div className="capture-loading__chart">
                    {BAR_GROUPS.map((heights, group) => (
                        <div className="capture-loading__group" key={group}>
                            {heights.map((height, index) => (
                                <i key={index} style={{ height: `${String(height)}%` }} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            <p className="capture-loading__text">Cargando reporte…</p>
        </section>
    );
}
