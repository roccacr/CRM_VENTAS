export default function LeadTable({ data }) {
    return (
        <div className="table-responsive">
            <table id="tableDinamic" className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "left" }}>
                <thead>
                    <tr>
                        <th>Asesor</th>
                        <th>Nombre Cliente</th>
                        <th># NETSUITE</th>
                        <th>Correo Cliente</th>
                        <th>Teléfono</th>
                        <th>Proyecto</th>
                        <th>Campaña</th>
                        <th>Estado</th>
                        <th>Creado</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((lead) => (
                        <tr key={lead.idinterno_lead}>
                            <td>{lead.name_admin}</td>
                            <td>{lead.nombre_lead}</td>
                            <td>{lead.idinterno_lead}</td>
                            <td>{lead.email_lead}</td>
                            <td>{lead.telefono_lead}</td>
                            <td>{lead.proyecto_lead}</td>
                            <td>{lead.campana_lead}</td>
                            <td>{lead.segimineto_lead}</td>
                            <td>{lead.creado_lead}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
