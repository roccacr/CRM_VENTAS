export const BotonVolveR = () => {
    const handleBackClick = () => {
        window.history.back(); // Navega hacia la vista anterior
    };

    return (
        <div className="col-sm-6 ms-auto my-1">
            <ul className="list-inline footer-link mb-0 justify-content-sm-end d-flex">
                <button className="btn btn-dark" onClick={handleBackClick}>
                  Vista anterior
                </button>
            </ul>
        </div>
    );
};
