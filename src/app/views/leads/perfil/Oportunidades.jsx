import { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { obtenerOportunidadesCliente } from "../../../../store/oportuinidad/thunkOportunidad";

export const Oportunidades = ({ leadDetails }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [oportunidades, setOportunidades] = useState([]); // Estado para almacenar las oportunidades asociadas al lead.

    // Función asíncrona memorizada para obtener oportunidades específicas del cliente basado en el ID del lead.
    const fetchClientOportunidades = useCallback(
        async (leadDetails) => {
            try {
                // Dispatch para obtener las oportunidades del cliente, retorna los datos de oportunidades
                const leadData = await dispatch(obtenerOportunidadesCliente(leadDetails));
                setOportunidades(leadData || []); // Actualiza el estado de 'oportunidades' con las oportunidades obtenidas
            } catch (error) {
                console.error("Error fetching client opportunities:", error); // Manejo de errores en caso de fallo
            }
        },
        [dispatch],
    ); // Incluye 'dispatch' como dependencia, ya que es una función externa

    useEffect(() => {
        // Llama a la función al cargar el componente o cuando cambia el ID del lead
        fetchClientOportunidades(leadDetails);
    }, [leadDetails, fetchClientOportunidades]); // Incluye 'fetchClientOportunidades' como dependencia

    const handleOpportunityClick = (idOportunidad, idLead) => {
        navigate(`/oportunidad/ver?data=${idLead}&data2=${idOportunidad}`);
    };

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5>Lista de oportunidades del cliente</h5>
                </div>
                <div className="card-body">
                    <p className="mb-0">Aquí se desglosan todas las oportunidades relacionadas con este cliente</p>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h5>Oportunidades</h5>
                </div>
                <div className="card-body">
                    <div className="table-responsive">
                        <table className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "left" }}>
                            <thead>
                                <tr>
                                    <th scope="col">#ID OPORTUNIDAD</th>
                                    <th scope="col">Motivo Condicion</th>
                                    <th scope="col">Estado</th>
                                    <th scope="col">CREADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {oportunidades.map(
                                    (oportunidad, index) => (
                                        (
                                            <tr key={index} onClick={() => handleOpportunityClick(oportunidad.id_oportunidad_oport, oportunidad.entity_oport)}>
                                                <td>{oportunidad.tranid_oport}</td>
                                                <td>{oportunidad.Motico_Condicion}</td>
                                                <td>{oportunidad.chek_oport === 1 ? "+MAS PROBABLE" : "-MENOS PROBABLE"}</td>
                                                <td>{oportunidad.fecha_creada_oport}</td>
                                            </tr>
                                        )
                                    ),
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
};
