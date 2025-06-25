export const BotonVolveR = () => {
    const handleVolverClick = () => {
        // Usar la API de historial para volver a la página anterior
        window.history.back();
    };

    return (
        <div className="col-sm-6 ms-auto my-1">
            <ul className="list-inline footer-link mb-0 justify-content-sm-end d-flex">
                <button className="btn btn-dark" onClick={handleVolverClick}>
                    Vista anterior
                </button>
            </ul>
        </div>
    );
};
