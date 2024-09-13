import { useLayoutEffect, useState, useEffect } from "react";
import { useDispatch } from "react-redux"; // Importar useDispatch
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { setgetMonthlyData } from "../../../store/Home/thunksHome";

// Función para obtener el primer y último día del mes actual
const getDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    return { firstDay, lastDay };
};

// Función para obtener los nuevos datos y ejecutar una acción usando dispatch
const fetchNewData = (startDate, endDate, dispatch) => {


    return new Promise((resolve) => {
        // Ejecutar la acción usando dispatch
        dispatch(setgetMonthlyData(startDate, endDate))
            .then((result) => {
                // Simulación de obtención de datos
                const newData = [
                    { year: "LEADS", LEADS: result.data["0"]?.[0]?.total_lead || 0 },
                    { year: "VISITAS", VISITAS: result.data["2"]?.[0]?.total_calendars || 0 },
                    { year: "OPORTUN", OPORTUN: result.data["1"]?.[0]?.total_oport || 0 },
                    { year: "VENTAS", VENTAS: result.ventas || 0 },
                ];
                resolve(newData);
            })
            .catch((error) => {
                console.error("Error al obtener los datos del gráfico:", error);
                resolve([
                    { year: "LEADS", LEADS: 0 },
                    { year: "VISITAS", VISITAS: 0 },
                    { year: "OPORTUN", OPORTUN: 0 },
                    { year: "VENTAS", VENTAS: 0 },
                ]);
            });
    });
};

export const GraficoMensual = () => {
    const { firstDay, lastDay } = getDefaultDates();
    const [chart, setChart] = useState(null);
    const [data, setData] = useState([
        { year: "LEADS", LEADS: 50 },
        { year: "VISITAS", VISITAS: 2.6 },
        { year: "OPORTUN", OPORTUN: 2 },
        { year: "VENTAS", VENTAS: 120 },
    ]);
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);

    const dispatch = useDispatch(); // Obtener el dispatch

    useEffect(() => {
        const loadInitialData = async () => {
            setData([
                { year: "LEADS", LEADS: 0 },
                { year: "VISITAS", VISITAS: 0 },
                { year: "OPORTUN", OPORTUN: 0 },
                { year: "VENTAS", VENTAS: 0 },
            ]);
            setLoading(true);

            // Obtener nuevos datos usando fetchNewData y dispatch
            const newData = await fetchNewData(firstDay, lastDay, dispatch);
            setData(newData);
            setLoading(false);
        };

        loadInitialData();
    }, [firstDay, lastDay, dispatch]);

    const handleGenerateChart = async () => {
        setData([
            { year: "LEADS", LEADS: 0 },
            { year: "VISITAS", VISITAS: 0 },
            { year: "OPORTUN", OPORTUN: 0 },
            { year: "VENTAS", VENTAS: 0 },
        ]);
        setLoading(true);

        // Obtener nuevos datos usando fetchNewData y dispatch
        const newData = await fetchNewData(startDate, endDate, dispatch);
        setData(newData);
        setLoading(false);
    };

    useLayoutEffect(() => {
        if (!loading) {
            const root = am5.Root.new("chartdiv");
            const chart = createChart(root);
            setChart(chart);

            return () => root.dispose();
        }
    }, [loading]);

    useEffect(() => {
        if (chart) {
            const yAxis = chart.yAxes.getIndex(0);
            const seriesList = chart.series.values;

            yAxis.data.setAll(data);

            seriesList.forEach((series) => {
                series.data.setAll(data);
            });
        }
    }, [data, chart]);

    const createChart = (root) => {
        root.setThemes([am5themes_Animated.new(root), createCustomTheme(root)]);

        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: false,
                panY: false,
                wheelX: "panY",
                wheelY: "zoomY",
                layout: root.verticalLayout,
            }),
        );

        chart.set("scrollbarY", am5.Scrollbar.new(root, { orientation: "vertical" }));

        const yAxis = chart.yAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: "year",
                renderer: am5xy.AxisRendererY.new(root, {}),
                tooltip: am5.Tooltip.new(root, {}),
            }),
        );

        yAxis.data.setAll(data);

        const xAxis = chart.xAxes.push(
            am5xy.ValueAxis.new(root, {
                min: 0,
                renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 40 }),
            }),
        );

        const legend = chart.children.push(
            am5.Legend.new(root, {
                centerX: am5.p50,
                x: am5.p50,
            }),
        );

        const seriesConfig = [
            { name: "LEADS", field: "LEADS" },
            { name: "VISITAS", field: "VISITAS" },
            { name: "OPORTUN", field: "OPORTUN" },
            { name: "VENTAS", field: "VENTAS" },
        ];

        seriesConfig.forEach(({ name, field }) => {
            const series = chart.series.push(
                am5xy.ColumnSeries.new(root, {
                    name,
                    stacked: true,
                    xAxis,
                    yAxis,
                    valueXField: field,
                    categoryYField: "year",
                }),
            );

            series.columns.template.setAll({
                tooltipText: "{name}, {categoryY}: {valueX}",
                tooltipY: am5.percent(90),
            });

            series.data.setAll(data);
            series.appear();

            series.bullets.push(() => {
                return am5.Bullet.new(root, {
                    sprite: am5.Label.new(root, {
                        text: "{valueX}",
                        fill: root.interfaceColors.get("alternativeText"),
                        centerY: am5.p50,
                        centerX: am5.p50,
                        populateText: true,
                    }),
                });
            });

            legend.data.push(series);
        });

        chart.appear(1000, 100);

        return chart;
    };

    const createCustomTheme = (root) => {
        const theme = am5.Theme.new(root);
        theme.rule("Grid", ["base"]).setAll({
            strokeOpacity: 0.1,
        });
        return theme;
    };

    return (
        <div className="col-md-6">
            <div className="card table-card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h5 style={{ margin: 0 }}>INFORME MENSUAL</h5>
                    <button className="btn btn-dark" type="button" data-bs-toggle="collapse" data-bs-target="#collapseExample" aria-expanded="false" aria-controls="collapseExample" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <i className="ti ti-search"></i> FILTROS
                    </button>
                </div>

                <div className="collapse" id="collapseExample">
                    <div className="card-body border-top">
                        <div className="card-header">
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Fecha de inicio</label>
                                        <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Fecha final</label>
                                        <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
                        <div id="chartdiv" style={{ width: "100%", height: "350px" }}></div>
                    )}
                </div>

                {/* Footer displaying individual category values */}
                <div className="card-footer bg-white text-dark">
                    <div className="row text-center">
                        <div className="col border-end">
                            <h4 className="m-0 text-dark">{data[0].LEADS}</h4>
                            <span>LEADS</span>
                        </div>
                        <div className="col border-end">
                            <h4 className="m-0 text-dark">{data[1].VISITAS}</h4>
                            <span>VISITAS</span>
                        </div>
                        <div className="col">
                            <h4 className="m-0 text-dark">{data[2].OPORTUN}</h4>
                            <span>OPORTUN</span>
                        </div>
                    </div>
                </div>
                {/* Footer displaying sales value */}
                <div className="card-footer bg-white text-dark">
                    <div className="row text-center">
                        <div className="col">
                            <h4 className="m-0 text-dark">{data[3].VENTAS}</h4>
                            <span>VENTAS</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
