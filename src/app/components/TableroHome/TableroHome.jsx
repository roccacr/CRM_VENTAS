import { NavLink } from "react-router-dom";

export const TableroHome = ({ image, icons, nombre, cantidad }) => {
    return (
        <div className="col-md-12 col-xxl-4">
            <NavLink to="/leads">
                <div className="card statistics-card-1">
                    <div className="card-body">
                        <img src={image} alt="img" className="img-fluid img-bg" />
                        <div className="d-flex align-items-center">
                            <div className="avtar" style={{ backgroundColor: "#000000", color: "#FFFFFF", marginRight: "1rem" }}>
                                <i className={icons}></i>
                            </div>
                            <div>
                                <p className="text-muted mb-0">{nombre}</p>
                                <div className="d-flex align-items-end">
                                    <h2 className="mb-0 f-w-500">{cantidad}</h2>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </NavLink>
        </div>
    );
};
