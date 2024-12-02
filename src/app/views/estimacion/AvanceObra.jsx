export const AvanceObra = ({ formValues, handleInputChange }) => {
    return (
        <>
            <div className="row" hidden={formValues.custbody75_estimacion === "2" ? false : true}>
                
                <div className="col-sm-3">
                    <label className="form-label">HITO 1 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito11"
                        value={formValues.avnace_obra_hito11}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito1"
                        value={formValues.avnace_obra_hito1}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">HITO 2 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito12"
                        value={formValues.avnace_obra_hito12}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito2"
                        value={formValues.avnace_obra_hito2}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">HITO 3 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito13"
                        value={formValues.avnace_obra_hito13}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito3"
                        value={formValues.avnace_obra_hito3}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">HITO 4 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito14"
                        value={formValues.avnace_obra_hito14}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito4"
                        value={formValues.avnace_obra_hito4}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">HITO 5 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito15"
                        value={formValues.avnace_obra_hito15}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito5"
                        value={formValues.avnace_obra_hito5}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">HITO 6 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito16"
                        value={formValues.avnace_obra_hito16}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="avnace_obra_hito6"
                        value={formValues.avnace_obra_hito6}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">MONTO SIN PRIMA TOTAL</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="obra_enterega"
                        value={formValues.obra_enterega}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
            </div>
        </>
    );
};
