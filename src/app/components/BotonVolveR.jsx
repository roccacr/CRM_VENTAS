import { useNavigate } from 'react-router-dom';

export const BotonVolveR = () => {
    const navigate = useNavigate();

    const handleVolverClickPagina = () => {
        const previousUrl = localStorage.getItem('previousUrl');

        if (previousUrl && previousUrl.startsWith('/oportunidad/lista')) {
            localStorage.removeItem('previousUrl');
            navigate(previousUrl);
            return;
        }

        if (window.history.length > 2) {
            navigate(-1);
            return;
        }

        navigate('/');
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
