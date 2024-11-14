import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getOportunidades } from "../../../../store/oportuinidad/thunkOportunidad";
import { TableroHome } from "../../../components/TableroHome/TableroHome";

const initialDashboardItems = [
    { id: 1, image: "1.svg", icon: "ti ti-file", name: "CANTIDAD DE OPORTUNIDADES", url: "", quantity: 0 },
    { id: 2, image: "2.svg", icon: "ti ti-file", name: "CANTIDAD FIRME", url: "", quantity: 0 },
    { id: 3, image: "3.svg", icon: "ti ti-file", name: "CANTIDAD CONDICIONAL", url: "", quantity: 0 },
];


// Obtiene el primer día del mes actual
const getFirstDayOfMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);

// Obtiene el último día del mes actual
const getLastDayOfMonth = () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);


export const View_oportunidad_list = () => {
    const [state, setState] = useState({
        oportunidad: [],
        dashboardItems: initialDashboardItems,
        isLoading: true,
    });
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Inicializar fechas con el primer y último día del mes actual
    const [startDate, setStartDate] = useState(getFirstDayOfMonth());
    const [endDate, setEndDate] = useState(getLastDayOfMonth());

    // Función para cargar oportunidades
    const fetchOportunidades = async () => {
        try {
            const idLead = 1;
            const isMode = 0;

            const result = await dispatch(getOportunidades(idLead, startDate, endDate, isMode));
            const data = Array.isArray(result) ? result : result?.data || [];

            const oportunidadesCount = data.length;
            const cantidadFirme = data.filter((item) => item.entitystatus_oport === 22).length;
            const cantidadCondicional = data.filter((item) => item.entitystatus_oport === 11).length;

            const updatedDashboardItems = state.dashboardItems.map((item) => {
                let quantity = 0;
                if (item.id === 1) quantity = oportunidadesCount;
                if (item.id === 2) quantity = cantidadFirme;
                if (item.id === 3) quantity = cantidadCondicional;

                return {
                    ...item,
                    quantity,
                };
            });

            setState({ oportunidad: data, dashboardItems: updatedDashboardItems, isLoading: false });
        } catch (error) {
            console.error("Error al cargar las oportunidades:", error);
            setState((prevState) => ({ ...prevState, isLoading: false }));
        }
    };

    // useEffect para cargar datos al montar el componente
    useEffect(() => {
        fetchOportunidades();
    }, [dispatch, startDate, endDate]);

    // Manejo de estado de carga
    if (state.isLoading) {
        return <p>Cargando...</p>;
    }

    // Validación de datos
    if (state.oportunidad.length === 0) {
        return <p>No hay datos disponibles.</p>;
    }

    return (
        <>
            <div className="row">
                {state.dashboardItems.map((item) => (
                    <TableroHome key={item.id} image={`/assets/panel/${item.image}`} icons={item.icon} nombre={item.name} cantidad={item.quantity} url="/" />
                ))}
            </div>
            <div className="card">
                <div className="card-body" style={{ borderRadius: "13px", background: "#fcfcfc" }}>
                    <h3>Lista de Oportunidades</h3>
                    <div className="row g-4">
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <input
                                    type="date"
                                    className="form-control"
                                    value={startDate.toISOString().split("T")[0]} // Establece el valor por defecto
                                    onChange={(e) => setStartDate(new Date(e.target.value))}
                                />
                                <label htmlFor="k1">Fecha de inicio de filtro</label>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="form-floating mb-0">
                                <input
                                    type="date"
                                    className="form-control"
                                    value={endDate.toISOString().split("T")[0]} // Establece el valor por defecto
                                    onChange={(e) => setEndDate(new Date(e.target.value))}
                                />
                                <label htmlFor="k2">Fecha de final de filtro</label>
                            </div>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-striped table dt-responsive w-100 display text-left">
                            <thead>
                                <tr>
                                    <th>LEADS</th>
                                    <th>#OPORTUNIDAD</th>
                                    <th>#EXPEDIENTE</th>
                                    <th>MOTIVO CONDICION</th>
                                    <th>PROBABILIDAD</th>
                                    <th>CIERRE PREV</th>
                                    <th>EXPEDIENTE</th>
                                    <th>MET PAGO</th>
                                    <th>PREC DE LIS</th>
                                    <th>PREC VENTA MÍN</th>
                                    <th>ESTADO</th>
                                    <th>CREADO</th>
                                    <th>CAMPAÑAS</th>
                                    <th>PROYECTO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {state.oportunidad.map((item) => (
                                    <tr
                                        key={item.id_oportunidad_oport}
                                        onClick={() =>
                                            navigate(`/oportunidad/ver`, {
                                                state: {
                                                    entity_oport: item.entity_oport,
                                                    id_oportunidad_oport: item.id_oportunidad_oport,
                                                },
                                            })
                                        }
                                    >
                                        <td>{item.nombre_lead}</td>
                                        <td>{item.tranid_oport}</td>
                                        <td>{item.codigo_exp}</td>
                                        <td>{item.Motico_Condicion}</td>
                                        <td>{item.probability_oport || "N/A"}</td>
                                        <td>{item.fecha_Condicion ? new Date(item.fecha_Condicion).toLocaleDateString() : "N/A"}</td>
                                        <td>{item.exp_custbody38_oport}</td>
                                        <td>{item.nombre_motivo_pago}</td>
                                        <td>{item.precioVentaUncio_exp || "N/A"}</td>
                                        <td>{item.precioDeVentaMinimo || "N/A"}</td>
                                        <td>{item.entitystatus_oport}</td>
                                        <td>{item.fecha_creada_oport ? new Date(item.fecha_creada_oport).toLocaleDateString() : "N/A"}</td>
                                        <td>{item.campana_lead}</td>
                                        <td>{item.proyecto_lead}</td>
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
