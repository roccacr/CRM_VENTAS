import { useState } from "react";

export const View_oportuinidad_ver = () => {
    const [leadDetails, setLeadDetails] = useState({
        clienteAsignado: "Cliente Ejemplo",
        probabilidad: "80%",
        nombreValor: "Alto",
        subsidiaria: "Subsidiaria Ejemplo",
        proyecto: "Proyecto Ejemplo",
        memo: "Este es un detalle de la oportunidad...",
        estado: "Condicional",
        motivoCondicion: "Esperando un negocio",
        fechaCierrePrevista: "2024-11-30",
        motivoCompra: "Primera Casa",
        metodoPago: "Avance De Obra",
        ubicacion: "Ubicación Ejemplo",
        clase: "Clase A",
        expediente: "Expediente Ejemplo",
        idInternoExpediente: "12345",
        estadoExpediente: "En proceso",
        nombreExpediente: "Expediente XYZ",
        precioLista: 20000000,
        precioMinimo: 18000000,
        salesRep: "Juan Pérez",
        currency: "USD",
    });

    return (
        <>
            <div className="card">
                <div className="card-body" style={{ borderRadius: "13px", background: "#fcfcfc" }}>
                    <h4 className="card-title">
                        <strong>Vista general de la oportunidad</strong>
                    </h4>

                    <div className="row">
                        <div className="col-xl-6">
                            <h5>Información principal</h5>
                            <p>
                                <strong>Cliente Asignado:</strong> {leadDetails.clienteAsignado}
                            </p>
                            <p>
                                <strong>Probabilidad:</strong> {leadDetails.probabilidad}
                            </p>
                            <p>
                                <strong>Nombre Valor:</strong> {leadDetails.nombreValor}
                            </p>
                            <p>
                                <strong>Subsidiaria:</strong> {leadDetails.subsidiaria}
                            </p>
                            <p>
                                <strong>Proyecto:</strong> {leadDetails.proyecto}
                            </p>
                            <p>
                                <strong>Detalles:</strong> {leadDetails.memo}
                            </p>
                        </div>

                        <div className="col-xl-6">
                            <h5>Información obligatoria</h5>
                            <p>
                                <strong>Estado:</strong> {leadDetails.estado}
                            </p>
                            <p>
                                <strong>Motivo de Condición:</strong> {leadDetails.motivoCondicion}
                            </p>
                            <p>
                                <strong>Fecha Cierre Prevista:</strong> {leadDetails.fechaCierrePrevista}
                            </p>
                            <p>
                                <strong>Motivo de Compra:</strong> {leadDetails.motivoCompra}
                            </p>
                            <p>
                                <strong>Método de Pago:</strong> {leadDetails.metodoPago}
                            </p>
                            <p>
                                <strong>Ubicación:</strong> {leadDetails.ubicacion}
                            </p>
                            <p>
                                <strong>Clase:</strong> {leadDetails.clase}
                            </p>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-lg-6">
                            <h5>Unidad Expediente Ligado VTA</h5>
                            <p>
                                <strong>Expediente:</strong> {leadDetails.expediente}
                            </p>
                            <p>
                                <strong>ID Interno Expediente:</strong> {leadDetails.idInternoExpediente}
                            </p>
                            <p>
                                <strong>Estado Expediente:</strong> {leadDetails.estadoExpediente}
                            </p>
                            <p>
                                <strong>Nombre Expediente:</strong> {leadDetails.nombreExpediente}
                            </p>
                            <p>
                                <strong>Precio de Lista:</strong> {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(leadDetails.precioLista / 100)}
                            </p>
                            <p>
                                <strong>Precio de Venta Mínimo:</strong> {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(leadDetails.precioMinimo / 100)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
