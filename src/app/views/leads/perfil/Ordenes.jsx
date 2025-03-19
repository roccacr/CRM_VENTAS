import { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";

import { useNavigate } from "react-router-dom";
import { obtenerOrndesPorcliente } from "../../../../store/ordenVenta/thunkOrdenVenta";

export const Ordenes = ({ leadDetails }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [ordenes, setOrdenes] = useState([]); // Estado para almacenar las ordenes de venta asociadas al lead.             

    // Función asíncrona memorizada para obtener eventos específicos del cliente basado en el ID del lead. 
    const fetchOrdenes = useCallback(
        async (leadDetails) => {
            try {
                // Dispatch para obtener las ordenes de venta del cliente, retorna los datos de ordenes
                const leadData = await dispatch(obtenerOrndesPorcliente(leadDetails));
                setOrdenes(leadData || []); // Actualiza el estado de 'ordenes' con las ordenes obtenidas
            } catch (error) {
                console.error("Error fetching client orders:", error); // Manejo de errores en caso de fallo
            }
        },
        [dispatch],
    ); // Incluye 'dispatch' como dependencia, ya que es una función externa

    useEffect(() => {
        // Llama a la función al cargar el componente o cuando cambia el ID del lead
        fetchOrdenes(leadDetails);
    }, [leadDetails, fetchOrdenes]); // Incluye 'fetchOrdenes' como dependencia

    const handleOrdenClick = (idOrden, idLead) => {
        navigate(`/orden/view?data=${idOrden}&data2=${idLead}`);
    };
    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5>Lista de ordenes de venta del cliente</h5>
                </div>
                <div className="card-body">
                    <p className="mb-0">Aquí se desglosan todas las ordenes de venta relacionadas con este cliente</p>  
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h5>Ordenes</h5>
                </div>
                <div className="card-body">
                    <div className="table-responsive">
                        <table className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "left" }}>
                            <thead>
                                <tr>
                                    <th scope="col">#COTIZACION</th>
                                    <th scope="col">FECHA DE CREACION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ordenes.map((orden, index) => (
                                    <tr key={index} onClick={() => handleOrdenClick(orden.id_ov_lead, orden.id_ov_netsuite)}> 
                                        <td>{orden.id_ov_tranid}</td>
                                        <td>{orden.creado_ov}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
};
