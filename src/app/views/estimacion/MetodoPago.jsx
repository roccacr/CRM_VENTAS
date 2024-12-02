import { AvanceDiferenciado } from "./AvanceDiferenciado";
import { AvanceObra } from "./AvanceObra";
import { ContraEntrega } from "./ContraEntrega";

export const MetodoPago = ({ formValues, handleInputChange }) => {
    return (
        <>
            <div className="row" style={{ marginTop: "15px" }} /* Ajusta el valor según sea necesario */>
                <div className="col-sm-12">
                    <div role="alert" className="fade alert alert-dark show">
                        <p style={{ fontSize: "0.875em", color: "#000" }}>
                            <em>
                                {" "}
                                <u> METODO DE PAGO</u>
                            </em>
                        </p>
                        <div className="col">
                            <div className="col-sm-3">
                                <select
                                    className="form-select"
                                    value={formValues.custbody75_estimacion}
                                    name="custbody75_estimacion"
                                    onChange={handleInputChange}
                                >
                                    <option value="">Selecione un Metodo de pago</option>
                                    <option value="2">Avance De Obra</option>
                                    <option value="7">Avance Diferenciado</option>
                                    <option value="1">Contra Entrega</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <ContraEntrega formValues={formValues} handleInputChange={handleInputChange} />
                    <AvanceObra formValues={formValues} handleInputChange={handleInputChange} />
                    <AvanceDiferenciado formValues={formValues} handleInputChange={handleInputChange} />
                  
                </div>
            </div>
        </>
    );
};
