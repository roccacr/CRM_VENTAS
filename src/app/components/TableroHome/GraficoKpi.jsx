import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { useDispatch } from "react-redux"; // Importar useDispatch para usar dispatch
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import { setgetMonthlyDataKpi } from "../../../store/Home/thunksHome";

// Simula la obtención de campañas desde una API
const fetchCampaigns = async () => {
    return [
        { id: 1, name: "Campaña 1" },
        { id: 2, name: "Campaña 2" },
        { id: 3, name: "Campaña 3" },
    ];
};

// Simula la obtención de proyectos desde una API
const fetchProjects = async () => {
    return [
        { id: 1, name: "Proyecto 1" },
        { id: 2, name: "Proyecto 2" },
        { id: 3, name: "Proyecto 3" },
    ];
};

// Función para obtener los nuevos datos y ejecutar una acción usando dispatch
const fetchNewChartData = (startDate, endDate, campaigns, projects, dispatch) => {
    console.log(`Fecha de inicio enviada a la API: ${startDate}`);
    console.log(`Fecha final enviada a la API: ${endDate}`);
    console.log(`Campañas seleccionadas: ${campaigns.map((c) => c.label).join(", ")}`);
    console.log(`Proyectos seleccionados: ${projects.map((p) => p.label).join(", ")}`);

    return new Promise((resolve) => {
        // Ejecutar la acción usando dispatch
        dispatch(setgetMonthlyDataKpi(startDate, endDate, campaigns, projects))
            .then((result) => {
                // Simulación de obtención de datos
                const newData = [
                    { value: result.data.data.total_pending || 0, category: "PEND" },
                    { value: result.data.data.total_complete || 0, category: "COMP" },
                    { value: result.data.data.total_cancel || 0, category: "CANC" },
                ];
                resolve(newData);
            })
            .catch((error) => {
                console.error("Error al obtener los datos del gráfico:", error);
                resolve([
                    { value: 0, category: "PEND" },
                    { value: 0, category: "COMP" },
                    { value: 0, category: "CANC" },
                ]);
            });
    });
};

// Define el componente GraficoKpi
export const GraficoKpi = () => {
    const dispatch = useDispatch(); // Obtener dispatch
    const chartRef = useRef(null);
    const [chartData, setChartData] = useState([
        { value: 10, category: "PEND" }, // Valores iniciales
        { value: 9, category: "COMP" },
        { value: 6, category: "CANC" },
    ]);
    const [loading, setLoading] = useState(false);
    const [selectedCampaigns, setSelectedCampaigns] = useState([]);
    const [selectedProjects, setSelectedProjects] = useState([]);
    const [campaignOptions, setCampaignOptions] = useState([]);
    const [projectOptions, setProjectOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const animatedComponents = makeAnimated();

    useEffect(() => {
        const loadData = async () => {
            try {
                const campaigns = await fetchCampaigns();
                const projects = await fetchProjects();

                setCampaignOptions(campaigns.map((c) => ({ value: c.id, label: c.name })));
                setProjectOptions(projects.map((p) => ({ value: p.id, label: p.name })));
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    const handleGenerateChart = async () => {
        // Establece los datos en cero y activa la carga
        setChartData([
            { value: 0, category: "PEND" },
            { value: 0, category: "COMP" },
            { value: 0, category: "CANC" },
        ]);
        setLoading(true);

        // Obtener nuevos datos usando fetchNewChartData y dispatch
        const newData = await fetchNewChartData(startDate, endDate, selectedCampaigns, selectedProjects, dispatch);
        setChartData(newData);

        setLoading(false);
    };

    useEffect(() => {
        const loadInitialData = async () => {
            // Establece los datos en cero y activa la carga
            setChartData([
                { value: 0, category: "PEND" },
                { value: 0, category: "COMP" },
                { value: 0, category: "CANC" },
            ]);
            setLoading(true);

            // Obtener nuevos datos usando fetchNewChartData y dispatch
            const newData = await fetchNewChartData(startDate, endDate, selectedCampaigns, selectedProjects, dispatch);
            setChartData(newData);

            setLoading(false);
        };

        loadInitialData();
    }, [startDate, endDate, dispatch]);

    useLayoutEffect(() => {
        if (!loading) {
            let root = am5.Root.new("chartdivkpi");

            root.setThemes([am5themes_Animated.new(root)]);

            let chart = root.container.children.push(
                am5percent.PieChart.new(root, {
                    startAngle: 180,
                    endAngle: 360,
                    layout: root.verticalLayout,
                    innerRadius: am5.percent(50), // Creates a donut chart
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

            legend.itemContainers.template.set("toggleKey", "active");
            legend.itemContainers.template.states.create("hover", {});

            legend.itemContainers.template.events.on("pointerover", function (e) {
                const itemContainer = e.target;
                const dataItem = itemContainer.dataItem;
                const slice = dataItem.get("legendDataItem").get("slice");

                slice.hover();
                series.highlightDataItem(dataItem);
            });

            legend.itemContainers.template.events.on("pointerout", function (e) {
                const itemContainer = e.target;
                const dataItem = itemContainer.dataItem;
                const slice = dataItem.get("legendDataItem").get("slice");

                slice.unhover();
                series.unHighlightDataItem(dataItem);
            });

            legend.itemContainers.template.events.on("click", function (e) {
                const itemContainer = e.target;
                const dataItem = itemContainer.dataItem;
                const slice = dataItem.get("legendDataItem").get("slice");

                if (slice.visible()) {
                    slice.hide();
                } else {
                    slice.show();
                }
            });

            series.appear(1000, 100);

            chartRef.current = root;

            return () => {
                root.dispose();
            };
        }
    }, [chartData, loading]);

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
                                        <label className="form-label">Fecha de inicio </label>
                                        <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Fecha final</label>
                                        <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Campañas</label>
                                        <Select onChange={setSelectedCampaigns} value={selectedCampaigns} isDisabled={isLoading} closeMenuOnSelect={false} components={animatedComponents} isMulti options={campaignOptions} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Proyectos</label>
                                        <Select onChange={setSelectedProjects} value={selectedProjects} isDisabled={isLoading} closeMenuOnSelect={false} components={animatedComponents} isMulti options={projectOptions} />
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
                    {/* Display loader while data is being fetched */}
                    {loading ? (
                        <div style={{ textAlign: "center", padding: "20px" }}>
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p>Cargando datos...</p>
                        </div>
                    ) : (
                        <div id="chartdivkpi" style={{ width: "100%", height: "350px" }}></div>
                    )}
                </div>

                {/* Footer displaying individual category values */}
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
                {/* Footer displaying total value */}
                <div className="card-footer bg-white text-dark">
                    <div className="row text-center">
                        <div className="col">
                            <h4 className="m-0 text-dark">{totalValue}</h4>
                            <span>TOTAL</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
