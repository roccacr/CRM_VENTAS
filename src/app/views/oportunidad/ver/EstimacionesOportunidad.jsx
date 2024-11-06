import { useState } from "react";



export const EstimacionesOportunidad = () => {
    // Datos de ejemplo para la tabla
    const estimacionesData = [
        { estimacion: "#12345", caduca: "2024-12-01", creado: "2024-11-01" },
        { estimacion: "#67890", caduca: "2024-12-05", creado: "2024-11-05" },
        { estimacion: "#11223", caduca: "2024-12-10", creado: "2024-11-10" },
    ];

    // Estado para el filtro de búsqueda
    const [search, setSearch] = useState("");

    // Filtra los datos en función del valor de búsqueda en #Estimacion
    const filteredData = estimacionesData.filter((item) => item.estimacion.toLowerCase().includes(search.toLowerCase()));

  return (
      <>
          <div className="card">
              <div className="card-header">
                  <h5>Vista de estimaciones</h5>
              </div>
              <div className="card-body">
                  <h2>Estimaciones de Oportunidad</h2>

                  {/* Filtro de búsqueda */}
                  <input type="text" placeholder="Buscar por #Estimacion" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: "20px", padding: "10px", width: "100%" }} />

                  {/* Tabla de estimaciones */}
                  <div className="table-responsive">
                      <table className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "left" }}>
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
                                      <tr key={index}>
                                          <td style={{ border: "1px solid #ddd", padding: "8px" }}>{item.estimacion}</td>
                                          <td style={{ border: "1px solid #ddd", padding: "8px" }}>{item.caduca}</td>
                                          <td style={{ border: "1px solid #ddd", padding: "8px" }}>{item.creado}</td>
                                      </tr>
                                  ))
                              ) : (
                                  <tr>
                                      <td colSpan="3" style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>
                                          No se encontraron resultados
                                      </td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      </>
  );
}
