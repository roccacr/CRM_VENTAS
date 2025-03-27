export const BotonVolveR = () => {
    const handleVolverClick = () => {
        // Forzar recarga completa de la página al volver
        window.location.href = document.referrer;
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
