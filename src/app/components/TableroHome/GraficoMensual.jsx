// Import necessary React hooks and amCharts 5 libraries
import { useState, useLayoutEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

// Define the data for the chart
const data = [
    { year: "LEADS", LEADS: 50 },
    { year: "VISITAS", VISITAS: 2.6 },
    { year: "OPORTUN", OPORTUN: 2 },
    { year: "VENTAS", VENTAS: 120 }, // Combines pre-reservations, reservations, and sales
];

// Define the series configuration
const series = [
    { name: "LEADS", field: "LEADS" },
    { name: "VISITAS", field: "VISITAS" },
    { name: "OPORTUN", field: "OPORTUN" },
    { name: "VENTAS", field: "VENTAS" },
];

// Define the GraficoMensual (Monthly Chart) component
export const GraficoMensual = () => {
    // State to hold the chart instance
    const [chart, setChart] = useState(null);

    // Use useLayoutEffect to ensure DOM manipulation happens before browser paint
    useLayoutEffect(() => {
        // Create the root element for the chart
        const root = am5.Root.new("chartdiv");
        // Create the chart and store it in state
        const chart = createChart(root);
        setChart(chart);

        // Cleanup function to dispose of the chart when component unmounts
        return () => root.dispose();
    }, []); // Empty dependency array means this effect runs once on mount

    // Function to create and configure the chart
    const createChart = (root) => {
        // Set themes for the chart
        root.setThemes([am5themes_Animated.new(root), createCustomTheme(root)]);

        // Create the chart instance
        const chart = root.container.children.push(
            am5xy.XYChart.new(root, {
                panX: false,
                panY: false,
                wheelX: "panY",
                wheelY: "zoomY",
                layout: root.verticalLayout,
            }),
        );

        // Add vertical scrollbar
        chart.set("scrollbarY", am5.Scrollbar.new(root, { orientation: "vertical" }));

        // Create Y-axis
        const yAxis = chart.yAxes.push(
            am5xy.CategoryAxis.new(root, {
                categoryField: "year",
                renderer: am5xy.AxisRendererY.new(root, {}),
                tooltip: am5.Tooltip.new(root, {}),
            }),
        );

        // Set data for Y-axis
        yAxis.data.setAll(data);

        // Create X-axis
        const xAxis = chart.xAxes.push(
            am5xy.ValueAxis.new(root, {
                min: 0,
                renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 40 }),
            }),
        );

        // Create legend
        const legend = chart.children.push(
            am5.Legend.new(root, {
                centerX: am5.p50,
                x: am5.p50,
            }),
        );

        // Create series for each data field
        series.forEach(({ name, field }) => {
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

            // Configure tooltip for series
            series.columns.template.setAll({
                tooltipText: "{name}, {categoryY}: {valueX}",
                tooltipY: am5.percent(90),
            });

            // Set data for series
            series.data.setAll(data);
            series.appear();

            // Add value labels to the series
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

            // Add series to legend
            legend.data.push(series);
        });

        // Animate chart appearance
        chart.appear(1000, 100);

        return chart;
    };

    // Function to create a custom theme
    const createCustomTheme = (root) => {
        const theme = am5.Theme.new(root);
        theme.rule("Grid", ["base"]).setAll({
            strokeOpacity: 0.1,
        });
        return theme;
    };

    // Render the component
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
                                        <label className="form-label">Fecha de inicio </label>
                                        <input type="date" className="form-control" id="exampleInputEmail1" aria-describedby="emailHelp" placeholder="Enter email" />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="mb-3">
                                        <label className="form-label">Fecha final</label>
                                        <input type="date" className="form-control" placeholder="Text" />
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-dark">
                                Generar gráfico
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card-body py-3 px-0">
                    {/* Container for the amCharts chart */}
                    <div id="chartdiv" style={{ width: "100%", height: "350px" }}></div>
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
