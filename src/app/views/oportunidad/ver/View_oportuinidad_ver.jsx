import { useState } from "react";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";

export const View_oportuinidad_ver = () => {
    // Estado para almacenar los detalles generales del lead.
    const [leadDetails, setLeadDetails] = useState({});
    return (
        <>
            <div className="card">
                <div className="card-body" style={{ borderRadius: "13px", background: "#fcfcfc" }}>
                    <h4 className="card-title">
                        <strong>Vista general de la oportuinidad</strong>
                    </h4>

                    <div className="col-xl-6">
                        <div className="mt-4 mt-lg-0">
                            <blockquote className="blockquote  blockquote-reverse font-size-16 mb-0">{Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}</blockquote>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
