import LoadingOutlined from "@ant-design/icons/LoadingOutlined";

/** Precarga de los paneles laterales: una línea de estado que se mueve y después las mismas tarjetas y la columna de etiquetas que tendrán los datos, para que nada salte al llegar. */
export function FormalizationDrawerLoading({ label, title, cards }: { readonly label: string; readonly title: string; readonly cards: readonly number[] }) {
    return (
        <div className="record-page client-loading" role="status" aria-busy="true" aria-label={label}>
            <div className="record-loading__status">
                <p>
                    <LoadingOutlined aria-hidden="true" />
                    <strong>{title}</strong>
                    <span>Consultando los datos autorizados de esta orden.</span>
                </p>
                <span className="record-loading__track" aria-hidden="true" />
            </div>
            {cards.map((rows, card) => (
                <section className="client-loading__card" key={card} aria-hidden="true">
                    <span className="record-skel client-loading__title" />
                    {Array.from({ length: rows }, (_, row) => (
                        <div className="client-loading__row" key={row}>
                            <span className="record-skel" />
                            <span className="record-skel" />
                        </div>
                    ))}
                </section>
            ))}
        </div>
    );
}
