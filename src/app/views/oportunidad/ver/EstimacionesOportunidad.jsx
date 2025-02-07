import { useEffect, useState } from "react";
import { ModalEstimacion } from "../../estimacion/ModalEstimacion";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom"; // Para redirigir
import { obtenerEstimacionesPorOportunidad } from "../../../../store/estimacion/thunkEstimacion";

export const EstimacionesOportunidad = ({ OportunidadDetails, cliente }) => {
    const [estimacionesData, setEstimaciones] = useState([]); // Inicialización como array vacío
    const [search, setSearch] = useState(""); // Filtro de búsqueda
    const [isModalOpen, setIsModalOpen] = useState(false); // Control del modal

    const dispatch = useDispatch();
    const navigate = useNavigate(); // Inicialización de navegación

    // Obtiene estimaciones asociadas a una oportunidad
    const enlistarEstimaciones = async (idOportunidad) => {
        try {
            const oportunidadData = await dispatch(obtenerEstimacionesPorOportunidad(idOportunidad));

            setEstimaciones(oportunidadData || []); // Manejo en caso de datos nulos o vacíos
        } catch (error) {
            console.error("Error al obtener los detalles de la oportunidad:", error);
        }
    };

    useEffect(() => {
        if (OportunidadDetails?.id_oportunidad_oport) {
            enlistarEstimaciones(OportunidadDetails.id_oportunidad_oport);
        }
    }, [OportunidadDetails]); // Dependencia para actualizar cuando cambien los detalles

    // Filtra los datos en función del valor de búsqueda
    const filteredData = estimacionesData.filter((item) => item.tranid_est.toLowerCase().includes(search.toLowerCase()));

    // Redirige al hacer clic en una fila
    const handleRowClick = (data, data2) => {
        navigate(`/estimaciones/view?data=${data}&data2=${data2}`);
    };

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5>Vista de estimaciones</h5>
                </div>
                <div className="card-body">
                    <h2>Estimaciones de Oportunidad</h2>

                    {/* Filtro de búsqueda */}
                    <input
                        type="text"
                        placeholder="Buscar por #Estimacion"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ marginBottom: "20px", padding: "10px", width: "100%" }}
                    />

                    {/* Botón para abrir el modal */}
                    <button
                        className="btn btn-dark"
                        onClick={() => setIsModalOpen(true)}
                        style={{ marginBottom: "20px", padding: "10px 20px", cursor: "pointer" }}
                    >
                        Crear Estimaciones
                    </button>

                    {/* Tabla de estimaciones */}
                    <div className="table-responsive">
                        <table
                            className="table table-striped table dt-responsive w-100 display text-left"
                            style={{ fontSize: "15px", width: "100%", textAlign: "left" }}
                        >
                            <thead>
                                <tr>
                                    <th style={{ border: "1px solid #ddd", padding: "8px" }}>#Estimacion</th>
                                    <th style={{ border: "1px solid #ddd", padding: "8px" }}>Caduca</th>
                                    <th style={{ border: "1px solid #ddd", padding: "8px" }}>Creado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.length > 0 ? (
                                    filteredData.map((item, index) => (
                                        <tr
                                            key={index}
                                            onClick={() => handleRowClick(item.idLead_est, item.idEstimacion_est)} // Redirigir al hacer clic
                                            style={{ cursor: "pointer" }}
                                        >
                                            <td style={{ border: "1px solid #ddd", padding: "8px" }}>{item.tranid_est}</td>
                                            <td style={{ border: "1px solid #ddd", padding: "8px" }}>{item.caduca}</td>
                                            <td style={{ border: "1px solid #ddd", padding: "8px" }}>{item.creado_est}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan="3"
                                            style={{
                                                border: "1px solid #ddd",
                                                padding: "8px",
                                                textAlign: "center",
                                            }}
                                        >
                                            No se encontraron resultados
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <ModalEstimacion open={isModalOpen} onClose={() => setIsModalOpen(false)} OportunidadDetails={OportunidadDetails} cliente={cliente} />
            )}
        </>
    );
};
