import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { setgetMonthlyDataKpi } from "../../../store/Home/thunksHome";
import { selectlistGraficoKpi } from "../../../store/Home/selectorsHome";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import jsPDF from "jspdf";
import html2canvas from "html2canvas"; // Importamos la librería html2canvas

// Función para obtener la fecha del lunes de la semana actual
const getCurrentWeekMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split("T")[0];
};

// Función para obtener la fecha del domingo de la semana actual
const getCurrentWeekSunday = () => {
    const monday = new Date(getCurrentWeekMonday());
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday.toISOString().split("T")[0];
};

export const GraficoKpi = () => {
    const dispatch = useDispatch();
    const chartRef = useRef(null);
    const pdfRef = useRef(null); // Referencia para el contenido a descargar
    const [chartData, setChartData] = useState([
        { value: 0, category: "PEND" },
        { value: 0, category: "COMP" },
        { value: 0, category: "CANC" },
    ]);
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState(getCurrentWeekMonday());
    const [endDate, setEndDate] = useState(getCurrentWeekSunday());
    const [tempStartDate, setTempStartDate] = useState(startDate);
    const [tempEndDate, setTempEndDate] = useState(endDate);

    const [selectedProjects, setSelectedProjects] = useState([]);
    const [selectedCampaigns, setSelectedCampaigns] = useState([]);
    const [selectedAdmins, setSelectedAdmins] = useState([]); // Nueva variable para seleccionar administradores

    const selectlis = useSelector(selectlistGraficoKpi);

    const animatedComponents = makeAnimated();

    // Crear opciones de proyectos sin repetir
    const projectOptions = [...new Set(selectlis.map((event) => event.proyecto))].map((proyecto) => ({ label: proyecto, value: proyecto }));

    // Crear opciones de campañas según los proyectos seleccionados
    const filteredCampaignOptions = selectedProjects.length ? [...new Set(selectlis.filter((event) => selectedProjects.some((project) => project.value === event.proyecto)).map((event) => event.campana))].map((campana) => ({ label: campana, value: campana })) : [];

    // Crear opciones de administradores sin repetir
    const adminOptions = [...new Set(selectlis.map((event) => event.nombreAdmin))].map((admin) => ({ label: admin, value: admin }));

    // Filtrar los eventos por proyecto, campaña y administrador seleccionados
    const filteredEvents = selectlis.filter((event) => (selectedProjects.length === 0 || selectedProjects.some((project) => project.value === event.proyecto)) && (selectedCampaigns.length === 0 || selectedCampaigns.some((campaign) => campaign.value === event.campana)) && (selectedAdmins.length === 0 || selectedAdmins.some((admin) => admin.value === event.nombreAdmin)));

    // useEffect para disparar setgetMonthlyDataKpi cuando startDate y endDate ya tengan valor
    useEffect(() => {
        if (startDate && endDate) {
            dispatch(setgetMonthlyDataKpi(startDate, endDate));
        }
    }, [startDate, endDate, dispatch]);

    useEffect(() => {
        if (selectlis.length > 0) {
            console.log("Datos cargados: ", selectlis.length);

            // Contar los eventos filtrados
            const cancelados = filteredEvents.filter((event) => event.accion_calendar === "Cancelado").length;
            const completados = filteredEvents.filter((event) => event.accion_calendar === "Completado").length;
            const pendientes = filteredEvents.filter((event) => event.accion_calendar === "Pendiente").length;

            // Actualizar chartData con los valores contados
            setChartData([
                { value: pendientes, category: "PEND" },
                { value: completados, category: "COMP" },
                { value: cancelados, category: "CANC" },
            ]);
            setIsLoading(false);
        }
    }, [selectlis, selectedProjects, selectedCampaigns, selectedAdmins]);

    // Función para agrupar campañas bajo proyectos seleccionados y contar eventos
    const renderProjectsAndCampaigns = () => {
        return selectedAdmins.length > 0
            ? selectedAdmins.map((admin) => {
                  const adminEvents = filteredEvents.filter((event) => event.nombreAdmin === admin.value);

                  const projectsForAdmin = [...new Set(adminEvents.map((event) => event.proyecto))];

                  return projectsForAdmin.map((project) => {
                      const associatedCampaigns = [...new Set(adminEvents.filter((event) => event.proyecto === project).map((event) => event.campana))];

                      const projectEvents = adminEvents.filter((event) => event.proyecto === project);
                      const projectPendientes = projectEvents.filter((event) => event.accion_calendar === "Pendiente").length;
                      const projectCompletados = projectEvents.filter((event) => event.accion_calendar === "Completado").length;
                      const projectCancelados = projectEvents.filter((event) => event.accion_calendar === "Cancelado").length;
                      const projectTotal = projectPendientes + projectCompletados + projectCancelados;

                      return (
                          <div key={`${admin.value}-${project}`} style={{ marginTop: "20px" }}>
                              <h5>
                                  <strong>{`Proyecto: ${project}`}</strong>
                                  <br />
                                  <strong>{`Vendedor: ${admin.label}`}</strong>
                              </h5>
                              <table className="table">
                                  <thead>
                                      <tr>
                                          <th>Nombre</th>
                                          <th>Pendientes</th>
                                          <th>Completados</th>
                                          <th>Cancelados</th>
                                          <th>Total</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      <tr style={{ backgroundColor: "black", color: "white" }}>
                                          <td style={{ color: "white" }}>
                                              <strong>{project}</strong>
                                          </td>
                                          <td style={{ color: "white" }}>{projectPendientes}</td>
                                          <td style={{ color: "white" }}>{projectCompletados}</td>
                                          <td style={{ color: "white" }}>{projectCancelados}</td>
                                          <td style={{ color: "white" }}>
                                              <strong>{projectTotal}</strong>
                                          </td>
                                      </tr>
                                      {associatedCampaigns.map((campaign) => {
                                          const campaignEvents = projectEvents.filter((event) => event.campana === campaign);
                                          const campaignPendientes = campaignEvents.filter((event) => event.accion_calendar === "Pendiente").length;
                                          const campaignCompletados = campaignEvents.filter((event) => event.accion_calendar === "Completado").length;
                                          const campaignCancelados = campaignEvents.filter((event) => event.accion_calendar === "Cancelado").length;
                                          const campaignTotal = campaignPendientes + campaignCompletados + campaignCancelados;

                                          return (
                                              <tr key={`${admin.value}-${project}-${campaign}`}>
                                                  <td>{campaign}</td>
                                                  <td>{campaignPendientes}</td>
                                                  <td>{campaignCompletados}</td>
                                                  <td>{campaignCancelados}</td>
                                                  <td>{campaignTotal}</td>
                                              </tr>
                                          );
                                      })}
                                  </tbody>
                              </table>
                              <hr />
                          </div>
                      );
                  });
              })
            : selectedProjects.map((project) => {
                  const associatedCampaigns = selectedCampaigns.length ? selectedCampaigns.filter((campaign) => selectlis.some((event) => event.proyecto === project.value && event.campana === campaign.value)) : filteredCampaignOptions.filter((campaign) => selectlis.some((event) => event.proyecto === project.value && event.campana === campaign.value));

                  const projectEvents = filteredEvents.filter((event) => event.proyecto === project.value);
                  const projectPendientes = projectEvents.filter((event) => event.accion_calendar === "Pendiente").length;
                  const projectCompletados = projectEvents.filter((event) => event.accion_calendar === "Completado").length;
                  const projectCancelados = projectEvents.filter((event) => event.accion_calendar === "Cancelado").length;
                  const projectTotal = projectPendientes + projectCompletados + projectCancelados;

                  return (
                      <div key={project.value} style={{ marginTop: "20px" }}>
                          <h5>
                              <strong>Proyecto: {project.label}</strong>
                          </h5>
                          <table className="table">
                              <thead>
                                  <tr>
                                      <th>Nombre</th>
                                      <th>Pendientes</th>
                                      <th>Completados</th>
                                      <th>Cancelados</th>
                                      <th>Total</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  <tr style={{ backgroundColor: "black", color: "white" }}>
                                      <td style={{ color: "white" }}>
                                          <strong>{project.label}</strong>
                                      </td>
                                      <td style={{ color: "white" }}>{projectPendientes}</td>
                                      <td style={{ color: "white" }}>{projectCompletados}</td>
                                      <td style={{ color: "white" }}>{projectCancelados}</td>
                                      <td style={{ color: "white" }}>
                                          <strong>{projectTotal}</strong>
                                      </td>
                                  </tr>
                                  {associatedCampaigns.map((campaign) => {
                                      const campaignEvents = projectEvents.filter((event) => event.campana === campaign.value);
                                      const campaignPendientes = campaignEvents.filter((event) => event.accion_calendar === "Pendiente").length;
                                      const campaignCompletados = campaignEvents.filter((event) => event.accion_calendar === "Completado").length;
                                      const campaignCancelados = campaignEvents.filter((event) => event.accion_calendar === "Cancelado").length;
                                      const campaignTotal = campaignPendientes + campaignCompletados + campaignCancelados;

                                      return (
                                          <tr key={campaign.value}>
                                              <td>{campaign.label}</td>
                                              <td>{campaignPendientes}</td>
                                              <td>{campaignCompletados}</td>
                                              <td>{campaignCancelados}</td>
                                              <td>{campaignTotal}</td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                          <hr />
                      </div>
                  );
              });
    };

    // Simula un delay de 1 segundo para mostrar el gráfico
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    useLayoutEffect(() => {
        if (!isLoading) {
            let root = am5.Root.new("chartdivkpi");

            root.setThemes([am5themes_Animated.new(root)]);

            let chart = root.container.children.push(
                am5percent.PieChart.new(root, {
                    startAngle: 180,
                    endAngle: 360,
                    layout: root.verticalLayout,
                    innerRadius: am5.percent(50), // Crea un gráfico tipo donut
                }),
            );

            let series = chart.series.push(
                am5percent.PieSeries.new(root, {
                    startAngle: 180,
                    endAngle: 360,
                    valueField: "value",
                    categoryField: "category",
                    alignLabels: false,
                }),
            );

            series.states.create("hidden", {
                startAngle: 180,
                endAngle: 180,
            });

            series.slices.template.setAll({
                cornerRadius: 5,
            });

            series.ticks.template.setAll({
                forceHidden: true,
            });

            series.data.setAll(chartData);

            let legend = chart.children.push(
                am5.Legend.new(root, {
                    centerX: am5.percent(50),
                    x: am5.percent(50),
                    marginTop: 15,
                    marginBottom: 15,
                }),
            );

            legend.data.setAll(series.dataItems);

            series.appear(1000, 100);

            chartRef.current = root;

            return () => {
                root.dispose();
            };
        }
    }, [chartData, isLoading]);

    const handleGenerateChart = () => {
        setIsLoading(true);
        setStartDate(tempStartDate);
        setEndDate(tempEndDate);
        dispatch(setgetMonthlyDataKpi(tempStartDate, tempEndDate));
    };

    // Función para descargar PDF del contenido visible en {renderProjectsAndCampaigns()}
    const handleDownloadPDF = async () => {
        const input = pdfRef.current; // Referencia al div que contiene la tabla
        const canvas = await html2canvas(input); // Convertimos el div a una imagen
        const imgData = canvas.toDataURL("image/png"); // Obtenemos los datos de la imagen
        const pdf = new jsPDF("p", "mm", "a4"); // Configuramos el PDF
        const imgWidth = 210; // Ancho de la página en mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width; // Calculamos la altura proporcional

        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight); // Agregamos la imagen al PDF
        pdf.save("Proyectos_Campanas.pdf"); // Guardamos el PDF
    };

    const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

    return (
        <div className="col-md-6">
            <div className="card table-card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h5 style={{ margin: 0 }}>KPI EVENTOS CITAS</h5>
                    <button className="btn btn-dark" type="button" data-bs-toggle="collapse" data-bs-target="#collapseExample2" aria-expanded="false" aria-controls="collapseExample2" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <i className="ti ti-search"></i> FILTROS
                    </button>
                </div>

                <div className="collapse" id="collapseExample2">
                    <div className="card-body border-top">
                        <div className="card-header">
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Fecha de inicio</label>
                                        <input type="date" className="form-control" value={tempStartDate} onChange={(e) => setTempStartDate(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Fecha final</label>
                                        <input type="date" className="form-control" value={tempEndDate} onChange={(e) => setTempEndDate(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Proyectos</label>
                                        <Select
                                            onChange={(selected) => {
                                                setSelectedProjects(selected || []);
                                                setSelectedCampaigns([]); // Reset campaigns when changing projects
                                            }}
                                            value={selectedProjects}
                                            isDisabled={isLoading}
                                            closeMenuOnSelect={false}
                                            components={animatedComponents}
                                            isMulti
                                            options={projectOptions}
                                        />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Campañas</label>
                                        <Select onChange={setSelectedCampaigns} value={selectedCampaigns} isDisabled={isLoading || !selectedProjects.length} closeMenuOnSelect={false} components={animatedComponents} isMulti options={filteredCampaignOptions} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Vendedores</label>
                                        <Select onChange={setSelectedAdmins} value={selectedAdmins} isDisabled={isLoading} closeMenuOnSelect={false} components={animatedComponents} isMulti options={adminOptions} />
                                    </div>
                                </div>
                            </div>
                            <button type="button" className="btn btn-dark" onClick={handleGenerateChart}>
                                Generar gráfico
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card-body py-3 px-0">
                    {isLoading ? (
                        <div style={{ textAlign: "center", padding: "20px" }}>
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p>Cargando gráfico...</p>
                        </div>
                    ) : (
                        <div id="chartdivkpi" style={{ width: "100%", height: "350px" }}></div>
                    )}
                </div>

                {!isLoading && (
                    <>
                        <div className="card-footer bg-white text-dark">
                            <div className="row text-center">
                                {chartData.map((item, index) => (
                                    <div key={index} className={`col ${index !== chartData.length - 1 ? "border-end" : ""}`}>
                                        <h4 className="m-0 text-dark">{item.value}</h4>
                                        <span>{item.category}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="card-footer bg-white text-dark">
                            <div className="row text-center">
                                <div className="col">
                                    <h4 className="m-0 text-dark">{totalValue}</h4>
                                    <span>TOTAL</span>
                                </div>
                            </div>
                        </div>

                        {/* Mostrar proyectos y campañas seleccionadas */}
                        <div className="card-footer bg-white text-dark" ref={pdfRef}>
                            <button className="btn btn-dark" onClick={handleDownloadPDF}>
                                Descargar desglose
                            </button>
                            {renderProjectsAndCampaigns()}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
