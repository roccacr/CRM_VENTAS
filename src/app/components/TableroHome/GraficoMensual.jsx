import { useState, useLayoutEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

const data = [
    { year: "LEADS", LEADS: 50 },
    { year: "VISITAS", VISITAS: 2.6 },
    { year: "OPORTUNIDAD", OPORTUNIDAD: 2 },
    { year: "PRE RESREVA", "PRE RESREVA": 10 },
    { year: "RESERVA", RESERVA: 3 },
    { year: "RESERVA CAIDA", "RESERVA CAIDA": 1 },
];

const series = [
    { name: "LEADS", field: "LEADS" },
    { name: "VISITAS", field: "VISITAS" },
    { name: "OPORTUNIDAD", field: "OPORTUNIDAD" },
    { name: "PRE RESREVA", field: "PRE RESREVA" },
    { name: "RESERVA", field: "RESERVA" },
    { name: "RESERVA CAIDA", field: "RESERVA CAIDA" },
];

export const GraficoMensual = () => {
    const [chart, setChart] = useState(null);

    useLayoutEffect(() => {
        const root = am5.Root.new("chartdiv");
        const chart = createChart(root);
        setChart(chart);

        return () => root.dispose();
    }, []);

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
                <div className="card-header">
                    <h5>REPORTE MENSUAL</h5>
                </div>
                <div className="card-body py-3 px-0">
                    <div id="chartdiv" style={{ width: "100%", height: "500px" }}></div>
                </div>

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
                            <h4 className="m-0 text-dark">{data[2].OPORTUNIDAD}</h4>
                            <span>OPORTUNIDADES</span>
                        </div>
                    </div>
                </div>
                <div className="card-footer bg-white text-dark">
                    <div className="row text-center">
                        <div className="col border-end">
                            <h4 className="m-0 text-dark">{data[3]["PRE RESREVA"]}</h4>
                            <span>PRE-RESERVA</span>
                        </div>
                        <div className="col border-end">
                            <h4 className="m-0 text-dark">{data[5]["RESERVA CAIDA"]}</h4>
                            <span>RESERVA CAIDA</span>
                        </div>
                        <div className="col">
                            <h4 className="m-0 text-dark">{data[4].RESERVA}</h4>
                            <span>RESERVA</span>


                            
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
