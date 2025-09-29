import { useLocation, useNavigate } from 'react-router-dom';

export const BotonVolveR = () => {
    const navigate = useNavigate();

    const handleVolverClickPagina = () => {
        // Verificar si existe previousUrl en localStorage
        const previousUrl = localStorage.getItem('previousUrl');
        
        if (previousUrl) {
            localStorage.removeItem('previousUrl');
            // Si existe, navegar a esa URL y borrarla
            navigate("/oportunidad/lista?oportuinidad=2&idLead=0");

        } else if (window.history.length > 2) {
            navigate(-1); // Volver a la página anterior del historial
        } else {
            // Si no hay historial, ir a una ruta lógica definida
            navigate('/'); // Personaliza esta ruta
        }
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
