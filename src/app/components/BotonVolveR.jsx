export const BotonVolveR = () => {
    const handleVolverClickPagina = () => {
        // Usar la API de historial para volver a la página anterior
        window.history.back();
    };

    return (
        <div className="col-sm-6 ms-auto my-1">
            <ul className="list-inline footer-link mb-0 justify-content-sm-end d-flex">
                <button className="btn btn-dark" onClick={handleVolverClickPagina}>
                    Vista anterior
                </button>
            </ul>
        </div>
    );
};
