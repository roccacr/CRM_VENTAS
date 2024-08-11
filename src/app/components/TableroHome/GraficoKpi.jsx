// Import necessary React hooks and amCharts 5 libraries
import  { useLayoutEffect, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

// Define the GraficoKpi (KPI Chart) component
export const GraficoKpi = () => {
    // Create a ref to store the chart instance
    const chartRef = useRef(null);

    // Initialize state for chart data
    const [chartData, setChartData] = useState([
        { value: 10, category: "PEND" }, // Pending
        { value: 9, category: "COMP" }, // Completed
        { value: 6, category: "CANC" }, // Cancelled
    ]);

    // Use useLayoutEffect to ensure DOM manipulation happens before browser paint
    useLayoutEffect(() => {
        // Create the root element for the chart
        let root = am5.Root.new("chartdivkpi");

        // Set the chart theme to Animated
        root.setThemes([am5themes_Animated.new(root)]);

        // Create the chart instance
        let chart = root.container.children.push(
            am5percent.PieChart.new(root, {
                startAngle: 180,
                endAngle: 360,
                layout: root.verticalLayout,
                innerRadius: am5.percent(50), // Creates a donut chart
            }),
        );

        // Create the pie series
        let series = chart.series.push(
            am5percent.PieSeries.new(root, {
                startAngle: 180,
                endAngle: 360,
                valueField: "value",
                categoryField: "category",
                alignLabels: false,
            }),
        );

        // Define a hidden state for the series
        series.states.create("hidden", {
            startAngle: 180,
            endAngle: 180,
        });

        // Set corner radius for pie slices
        series.slices.template.setAll({
            cornerRadius: 5,
        });

        // Hide slice ticks
        series.ticks.template.setAll({
            forceHidden: true,
        });

        // Set the chart data
        series.data.setAll(chartData);

        // Create and configure the legend
        let legend = chart.children.push(
            am5.Legend.new(root, {
                centerX: am5.percent(50),
                x: am5.percent(50),
                marginTop: 15,
                marginBottom: 15,
            }),
        );

        // Set legend data from series
        legend.data.setAll(series.dataItems);

        // Make legend interactive
        legend.itemContainers.template.set("toggleKey", "active");
        legend.itemContainers.template.states.create("hover", {});

        // Add hover effect to legend items
        legend.itemContainers.template.events.on("pointerover", function (e) {
            const itemContainer = e.target;
            const dataItem = itemContainer.dataItem;
            const slice = dataItem.get("legendDataItem").get("slice");

            slice.hover();
            series.highlightDataItem(dataItem);
        });

        // Remove hover effect from legend items
        legend.itemContainers.template.events.on("pointerout", function (e) {
            const itemContainer = e.target;
            const dataItem = itemContainer.dataItem;
            const slice = dataItem.get("legendDataItem").get("slice");

            slice.unhover();
            series.unHighlightDataItem(dataItem);
        });

        // Toggle slice visibility when legend item is clicked
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

        // Animate series appearance
        series.appear(1000, 100);

        // Store the chart instance in the ref
        chartRef.current = root;

        // Clean up function to dispose of the chart when component unmounts
        return () => {
            root.dispose();
        };
    }, [chartData]); // Re-run effect if chartData changes

    // Calculate the total value of all chart items
    const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

    // Render the component
    return (
        <div className="col-md-6">
            <div className="card table-card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h5 style={{ margin: 0 }}>KPI EVENTOS CITAS</h5>
                    <button className="btn btn-dark" type="button" data-bs-toggle="collapse" data-bs-target="#collapseExample2" aria-expanded="false" aria-controls="collapseExample" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
                    <div id="chartdivkpi" style={{ width: "100%", height: "350px" }}></div>
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
