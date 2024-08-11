import React, { useLayoutEffect, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

export const GraficoKpi = () => {
    const chartRef = useRef(null);
    const [chartData, setChartData] = useState([
        { value: 10, category: "PEND" },
        { value: 9, category: "COMP" },
        { value: 6, category: "CANC" },
    ]);

    useLayoutEffect(() => {
        let root = am5.Root.new("chartdivkpi");
        root.setThemes([am5themes_Animated.new(root)]);

        let chart = root.container.children.push(
            am5percent.PieChart.new(root, {
                startAngle: 180,
                endAngle: 360,
                layout: root.verticalLayout,
                innerRadius: am5.percent(50),
            }),
        );

        // Create series
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

        // Set data
        series.data.setAll(chartData);

        // Create legend
        let legend = chart.children.push(
            am5.Legend.new(root, {
                centerX: am5.percent(50),
                x: am5.percent(50),
                marginTop: 15,
                marginBottom: 15,
            }),
        );

        legend.data.setAll(series.dataItems);

        // Make legend interactive
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

        // When legend item is clicked, toggle slice visibility
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
    }, [chartData]);

    const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

    return (
        <div className="col-md-6">
            <div className="card table-card">
                <div className="card-header">
                    <h5>KPI REPORTE</h5>
                </div>
                <div className="card-body py-3 px-0">
                    <div id="chartdivkpi" style={{ width: "100%", height: "350px" }}></div>
                </div>

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
            </div>
        </div>
    );
};
