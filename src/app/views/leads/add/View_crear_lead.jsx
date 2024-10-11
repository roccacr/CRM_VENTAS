import React, { useState, useEffect } from "react";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import Swal from "sweetalert2";
import { useDispatch } from "react-redux";
import { createdNewLeadNetsuite, getDataSelectAdmins, getDataSelectCampaing, getDataSelectCorredor, getDataSelectProyect, getDataSelectSubsidiaria } from "../../../../store/leads/thunksLeads";
import { ShowChart } from "@mui/icons-material";

const animatedComponents = makeAnimated();

export const View_crear_lead = () => {
    const dispatch = useDispatch();

    const [formData, setFormData] = useState({
        firstname_new: "",
        email_new: "",
        phone_new: "",
        comentario_cliente_new: "",
        campana_new: null,
        proyecto_new: null,
        subsidiary_new: null,
        vendedor_new: null,
        corredor_lead_new: null,
    });

    const [campaignOptions, setCampaignOptions] = useState([]);
    const [projectOptions, setProjectOptions] = useState([]);
    const [corredor_lead_options, setcorredor_lead] = useState([]);
    const [subsidiaryOptions, setSubsidiaryOptions] = useState([]);
    const [vendorOptions, setVendorOptions] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Obtener datos para Campañas
                const resultCampaing = await dispatch(getDataSelectCampaing(1));
                const campaigns = resultCampaing.map((c) => ({ value: c.id_NetsauiteCampana, label: c.Nombre_Campana }));
                setCampaignOptions(campaigns);

                // Obtener datos para Proyectos
                const resultProyect = await dispatch(getDataSelectProyect(1));
                const projects = resultProyect.map((p) => ({ value: p.id_ProNetsuite, label: p.Nombre_proyecto }));
                setProjectOptions(projects);

                // Obtener datos para Subsidiarias
                const resultSubsidiaria = await dispatch(getDataSelectSubsidiaria(1));
                const subsidiaries = resultSubsidiaria.map((s) => ({ value: s.id_NetsuiteSub, label: s.Nombre_Subsidiaria }));
                setSubsidiaryOptions(subsidiaries);

                // Obtener datos para Administradores/Vendedores
                const resultAdmins = await dispatch(getDataSelectAdmins(1));
                const vendors = resultAdmins.map((v) => ({ value: v.idnetsuite_admin, label: v.name_admin }));
                setVendorOptions(vendors);

                const resultCorredor = await dispatch(getDataSelectCorredor(1));
                const corredor = resultCorredor.map((v) => ({ value: v.id_netsuiteCorredor, label: v.nombre_corredor }));
                setcorredor_lead(corredor);
            } catch (error) {
                console.error("Error al cargar los datos:", error);
            }
        };

        fetchData();
    }, [dispatch]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevState) => ({ ...prevState, [name]: value }));

        // Remover borde rojo al escribir en un campo obligatorio
        if (value !== "") {
            document.getElementById(name).style.border = "1px solid #ced4da";
        }
    };

    const handleSelectChange = (selectedOption, action) => {
        setFormData((prevState) => ({ ...prevState, [action.name]: selectedOption }));
        // Remover borde rojo al seleccionar una opción
        document.getElementById(action.name).style.border = "1px solid #ced4da";
    };

    const handleCreateLead = async () => {
        const requiredFields = ["firstname_new", "email_new", "phone_new", "comentario_cliente_new", "campana_new", "proyecto_new", "subsidiary_new"];
        const missingFields = requiredFields.filter((field) => !formData[field]);

        if (missingFields.length > 0) {
            Swal.fire({
                icon: "error",
                title: "Campos obligatorios",
                text: "Por favor, completa todos los campos obligatorios.",
            });
            // Bordear en rojo los campos que faltan
            missingFields.forEach((field) => {
                document.getElementById(field).style.border = "2px solid red";
            });
        } else {
            // Limpiar los bordes si se completan los campos
            requiredFields.forEach((field) => {
                document.getElementById(field).style.border = "1px solid #ced4da";
            });

            const confirmResult = await Swal.fire({
                title: "¿Estás seguro?",
                text: "Estás a punto de crear un nuevo cliente.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Sí, crear",
                cancelButtonText: "No, cancelar",
            });

            if (confirmResult.isConfirmed) {
                // Mostrar el preloader mientras se espera el resultado del dispatch
                Swal.fire({
                    title: "Creando cliente...",
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    },
                });

                const result = await dispatch(createdNewLeadNetsuite(formData));
                var ExTraerResultado = result.data["Detalle"];

                 if (ExTraerResultado.status == 200) {
                     let id_ex = ExTraerResultado.id;
                     Swal.fire({
                         position: "top-end",
                         icon: "success",
                         title: "Se creo un nuevo leads con exito ",
                         showConfirmButton: false,
                         timer: 3500,
                     }).then((result) => {
                         window.location.href = "/leads/perfil?data=" + id_ex;
                     });
                 }
                if (ExTraerResultado.status == 500) {
                    let error = JSON.parse(ExTraerResultado.Error); // Intenta parsear el error
                    return Swal.fire({
                        html: `
                                <h4>Detalle de error:</h4>
                                <p>${error.details}, <br> Lo sentimos, favor revisar este error con su administrador.</p>
                            `,
                        icon: "question",
                        width: "40em",
                        padding: "0 0 1.25em",
                        iconHtml: "؟",
                        confirmButtonText: "OK",
                        cancelButtonText: "CORREGIR",
                        showCancelButton: true,
                        showCloseButton: true,
                    });
                }
                console.log("ExTraerResultado: ", ExTraerResultado);

                Swal.close();
            }
        }
    };

    return (
        <div className="card">
            <div
                className="card-body"
                style={{
                    borderRadius: "13px",
                    background: "#fcfcfc",
                    boxShadow: "5px 5px 100px #656565, -5px -5px 100px #ffffff",
                }}
            >
                <h4 className="card-title">
                    <strong>Crear un nuevo lead</strong>
                </h4>
                <p className="mb-0">
                    <i className="mdi mdi-circle-medium align-middle text-primary me-1"></i>
                    Brinda la mayor información para crear el lead.
                </p>
                <br />
                <div className="row">
                    <div className="col-sm-6">
                        <div className="mb-3">
                            <label htmlFor="firstname_new">Nombre Completo del cliente</label>
                            <br />
                            <input type="text" name="firstname_new" id="firstname_new" className="form-control mb-2" placeholder="Nombre del lead" value={formData.firstname_new} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label className="required form-label">Correo lead</label>
                            <br />
                            <input type="email" name="email_new" id="email_new" className="form-control mb-2" placeholder="Correo electrónico" value={formData.email_new} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label className="required form-label">Número de teléfono</label>
                            <br />
                            <input type="text" name="phone_new" id="phone_new" className="form-control mb-2" placeholder="Número de teléfono" value={formData.phone_new} onChange={handleChange} required />
                        </div>
                        <div className="mb-3">
                            <label className="required form-label">Comentarios</label>
                            <input type="text" name="comentario_cliente_new" id="comentario_cliente_new" className="form-control mb-2" placeholder="Ingrese un comentario obligatorio" value={formData.comentario_cliente_new} onChange={handleChange} required />
                        </div>
                    </div>
                    <div className="col-sm-6">
                        <div className="mb-3">
                            <label className="required form-label">Proyectos</label>
                            <br />
                            <Select id="proyecto_new" name="proyecto_new" components={animatedComponents} options={projectOptions} value={formData.proyecto_new} onChange={handleSelectChange} isSearchable required />
                        </div>
                        <div className="mb-3">
                            <label className="required form-label">Campaña Marketing</label>
                            <br />
                            <Select id="campana_new" name="campana_new" components={animatedComponents} options={campaignOptions} value={formData.campana_new} onChange={handleSelectChange} isSearchable required />
                        </div>
                        <div className="mb-3">
                            <label className="required form-label">Subsidiaria</label>
                            <br />
                            <Select id="subsidiary_new" name="subsidiary_new" components={animatedComponents} options={subsidiaryOptions} value={formData.subsidiary_new} onChange={handleSelectChange} isSearchable required />
                        </div>
                        <div className="mb-3">
                            <label className="required form-label">Corredor Cliente</label>
                            <br />
                            <Select id="corredor_lead_new" name="corredor_lead_new" components={animatedComponents} options={corredor_lead_options} value={formData.corredor_lead_new} onChange={handleSelectChange} isSearchable required />
                        </div>
                        <div className="mb-3">
                            <label className="required form-label">Asignar Lead A un Vendedor</label>
                            <br />
                            <Select id="vendedor_new" name="vendedor_new" components={animatedComponents} options={vendorOptions} value={formData.vendedor_new} onChange={handleSelectChange} isSearchable required />
                        </div>
                    </div>
                </div>
                <button type="button" className="btn btn-dark" onClick={handleCreateLead}>
                    Crear Nueva Lead
                </button>
            </div>
        </div>
    );
};
