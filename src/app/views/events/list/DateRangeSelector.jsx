import React from "react";

const DateRangeSelector = ({ dateStart, dateEnd, setDateStart, setDateEnd }) => {
    return (
        <div className="row" style={{ marginBottom: "20px" }}>
            <div className="col-md-4">
                <label>Fecha inicio</label>
                <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="form-control" style={{ marginRight: "20px", marginLeft: "10px" }} />
            </div>
            <div className="col-md-4">
                <label>Fecha Fin:</label>
                <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="form-control" style={{ marginLeft: "10px" }} />
            </div>
        </div>
    );
};

export default DateRangeSelector;
