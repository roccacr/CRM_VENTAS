import { useEffect, useState } from "react";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { useDispatch } from "react-redux";

export const PerfilUsuario = () => {
    const dispatch = useDispatch();
    // Estado para almacenar los detalles generales del lead.
    const [leadDetails, setLeadDetails] = useState({});

    const fetchLeadDetails = async (idEvent) => {
        try {
            // Llama a la acción 'getSpecificLead' y actualiza el estado 'leadDetails'.
            const leadData = await dispatch(getSpecificLead(idEvent));

            // Guarda todos los detalles del lead en el estado 'leadDetails' para su uso posterior.
            setLeadDetails(leadData);
        } catch (error) {
            console.error("Error al obtener los detalles del lead:", error); // Manejo de errores.
        }
    };

    // Función para obtener el valor de un parámetro específico de la URL.
    const getQueryParam = (param) => {
        // Crea una instancia de 'URLSearchParams' con los parámetros de la URL.
        const value = new URLSearchParams(location.search).get(param);

        // Verifica si el valor es numérico. Si lo es, lo convierte a un número.
        if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
            return Number(value); // Retorna el valor como número.
        }
        return value; // Si no es numérico, retorna el valor original como cadena de texto.
    };

    useEffect(() => {
        // Obtiene los parámetros 'idLead', 'idCalendar', y 'idDate' desde la URL.
        const leadId = getQueryParam("data"); // Extrae el ID del lead desde la URL.

        // Si 'leadId' es válido (mayor que 0), llama a la función para obtener los detalles del lead.
        if (leadId && leadId > 0) {
            fetchLeadDetails(leadId); // Ejecuta la solicitud para obtener los detalles del lead.
        }
    }, [location.search]); // El efecto se ejecuta nuevamente si 'location.search' cambia.
    return (
        <>
            <div className="bg-dark card">
                <div className="card-body">
                    <div className="d-flex align-items-center">
                        <div className="flex-grow-1 me-3">
                            <h3 className="text-white">Roberto Zuniga Altamirano</h3>
                            <p className="text-white text-opacity-75 text-opa mb-0">perfil del usuario</p>
                        </div>
                        <div className="flex-shrink-0">
                            <img alt="img" loading="lazy" width="92" height="90" decoding="async" data-nimg="1" className="img-fluid wid-80" srcSet="" src="https://light-able-react-light.vercel.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fimg-accout-alert.a2294f08.png&w=96&q=75" style={{ color: "transparent" }} />
                        </div>
                    </div>
                </div>
                <div className="col-xl-6">
                    <div className="mt-4 mt-lg-0">
                        <blockquote className="blockquote  blockquote-reverse font-size-16 mb-0">{Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}</blockquote>
                    </div>
                </div>
        </div>
        <div className="row">
    <div className="col-xxl-3 col-lg-5">
        <div className="overflow-hidden card">
            <div className="position-relative card-body">
                <div className="text-center mt-3">
                    <div className="chat-avtar d-inline-flex mx-auto"><img alt="User image" loading="lazy" width="100"
                            height="100" decoding="async" data-nimg="1"
                            className="rounded-circle img-fluid wid-90 img-thumbnail"
      
                            src=""
                            style={{ color: "transparent"}}/><i className="chat-badge bg-success me-2 mb-2"></i></div>
                    <h5 className="mb-0">William Bond</h5>
                    <p className="text-muted text-sm">DM on <a href="#" className="link-primary"> @williambond </a> 😍</p>
                    <ul className="list-inline mx-auto my-4">
                        <li className="list-inline-item"><a className="avtar avtar-s text-white bg-dribbble"
                                href="/application/account-profile#"><i className="ti ti-brand-dribbble f-24"></i></a></li>
                        <li className="list-inline-item"><a className="avtar avtar-s text-white bg-amazon"
                                href="/application/account-profile#"><i className="ti ti-brand-figma f-24"></i></a></li>
                        <li className="list-inline-item"><a className="avtar avtar-s text-white bg-pinterest"
                                href="/application/account-profile#"><i className="ti ti-brand-pinterest f-24"></i></a></li>
                        <li className="list-inline-item"><a className="avtar avtar-s text-white bg-behance"
                                href="/application/account-profile#"><i className="ti ti-brand-behance f-24"></i></a></li>
                    </ul>
                    <div className="g-3 row">
                        <div className="col-4">
                            <h5 className="mb-0">86</h5><small className="text-muted">Post</small>
                        </div>
                        <div className="border border-top-0 border-bottom-0 col-4">
                            <h5 className="mb-0">40</h5><small className="text-muted">Project</small>
                        </div>
                        <div className="col-4">
                            <h5 className="mb-0">4.5K</h5><small className="text-muted">Members</small>
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex-column list-group list-group-flush account-pills mb-0 nav nav-pills" id="user-set-tab"
                aria-orientation="vertical" role="tablist"><a id="react-aria8348725315-:r6:-tab-ProfileInfo" role="tab"
                    data-rr-ui-event-key="ProfileInfo" aria-controls="react-aria8348725315-:r6:-tabpane-ProfileInfo"
                    aria-selected="true" className="list-group-item list-group-item-action nav-link active" tabIndex="0"
                    href="#"><span className="f-w-500"><i className="ph-duotone ph-user-circle m-r-10"></i>Profile
                        Overview</span></a><a id="react-aria8348725315-:r6:-tab-PersonalInfo" role="tab"
                    data-rr-ui-event-key="PersonalInfo" aria-controls="react-aria8348725315-:r6:-tabpane-PersonalInfo"
                    aria-selected="false" tabIndex="-1" className="list-group-item list-group-item-action nav-link"
                    href="#"><span className="f-w-500"><i className="ph-duotone ph-clipboard-text m-r-10"></i>Personal
                        Information</span></a><a id="react-aria8348725315-:r6:-tab-AccountInfo" role="tab"
                    data-rr-ui-event-key="AccountInfo" aria-controls="react-aria8348725315-:r6:-tabpane-AccountInfo"
                    aria-selected="false" tabIndex="-1" className="list-group-item list-group-item-action nav-link"
                    href="#"><span className="f-w-500"><i className="ph-duotone ph-notebook m-r-10"></i>Account
                        Information</span></a><a id="react-aria8348725315-:r6:-tab-ChangePassword" role="tab"
                    data-rr-ui-event-key="ChangePassword"
                    aria-controls="react-aria8348725315-:r6:-tabpane-ChangePassword" aria-selected="false" tabIndex="-1"
                    className="list-group-item list-group-item-action nav-link" href="#"><span className="f-w-500"><i
                            className="ph-duotone ph-key m-r-10"></i>Change Password</span></a><a
                    id="react-aria8348725315-:r6:-tab-EmailSetting" role="tab" data-rr-ui-event-key="EmailSetting"
                    aria-controls="react-aria8348725315-:r6:-tabpane-EmailSetting" aria-selected="false" tabIndex="-1"
                    className="list-group-item list-group-item-action nav-link" href="#"><span className="f-w-500"><i
                            className="ph-duotone ph-envelope-open m-r-10"></i>Email settings</span></a></div>
        </div>
        <div className="card">
            <div className="card-header">
                <h5>Personal information</h5>
            </div>
            <div className="position-relative card-body">
                <div className="d-inline-flex align-items-center justify-content-between w-100 mb-3">
                    <p className="mb-0 text-muted me-1">Email</p>
                    <p className="mb-0">anshan@gmail.com</p>
                </div>
                <div className="d-inline-flex align-items-center justify-content-between w-100 mb-3">
                    <p className="mb-0 text-muted me-1">Phone</p>
                    <p className="mb-0">(+1-876) 8654 239 581</p>
                </div>
                <div className="d-inline-flex align-items-center justify-content-between w-100">
                    <p className="mb-0 text-muted me-1">Location</p>
                    <p className="mb-0">New York</p>
                </div>
            </div>
        </div>
        <div className="card">
            <div className="card-header">
                <h5>Skills</h5>
            </div>
            <div className="card-body">
                <div className="align-items-center mb-3 row">
                    <div className="mb-2 mb-sm-0 col-sm-6">
                        <p className="mb-0">Junior</p>
                    </div>
                    <div className="col-sm-6">
                        <div className="d-flex align-items-center">
                            <div className="flex-grow-1 me-3">
                        <div className="progress progress-primary" style={{ height: "6px" }}>
                          <div className="progress-bar" style={{ width: "30%" }}></div>
                                </div>
                            </div>
                            <div className="flex-shrink-0">
                                <p className="mb-0 text-muted">30%</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="align-items-center mb-3 row">
                    <div className="mb-2 mb-sm-0 col-sm-6">
                        <p className="mb-0">UX Researcher</p>
                    </div>
                    <div className="col-sm-6">
                        <div className="d-flex align-items-center">
                            <div className="flex-grow-1 me-3">
                        <div className="progress progress-primary" style={{ height: "6px" }}>
                          <div className="progress-bar" style={{ width: "80%" }}></div>
                                </div>
                            </div>
                            <div className="flex-shrink-0">
                                <p className="mb-0 text-muted">80%</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="align-items-center mb-3 row">
                    <div className="mb-2 mb-sm-0 col-sm-6">
                        <p className="mb-0">Wordpress</p>
                    </div>
                    <div className="col-sm-6">
                        <div className="d-flex align-items-center">
                            <div className="flex-grow-1 me-3">
                        <div className="progress progress-primary" style={{ height: "6px" }}>
                          <div className="progress-bar" style={{ width: "90%" }}></div>
                                </div>
                            </div>
                            <div className="flex-shrink-0">
                                <p className="mb-0 text-muted">90%</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="align-items-center mb-3 row">
                    <div className="mb-2 mb-sm-0 col-sm-6">
                        <p className="mb-0">HTML</p>
                    </div>
                    <div className="col-sm-6">
                        <div className="d-flex align-items-center">
                            <div className="flex-grow-1 me-3">
                                <div className="progress progress-primary" style={{height: "6px"}}>
                                    <div className="progress-bar" style={{width: "30%"}}></div>
                                </div>
                            </div>
                            <div className="flex-shrink-0">
                                <p className="mb-0 text-muted">30%</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="align-items-center mb-3 row">
                    <div className="mb-2 mb-sm-0 col-sm-6">
                        <p className="mb-0">Graphic Design</p>
                    </div>
                    <div className="col-sm-6">
                        <div className="d-flex align-items-center">
                            <div className="flex-grow-1 me-3">
                                <div className="progress progress-primary" style={{height: "6px"}}>
                          <div className="progress-bar" style={{ width: "95%" }}></div>
                                </div>
                            </div>
                            <div className="flex-shrink-0">
                                <p className="mb-0 text-muted">95%</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="align-items-center row">
                    <div className="mb-2 mb-sm-0 col-sm-6">
                        <p className="mb-0">Code Style</p>
                    </div>
                    <div className="col-sm-6">
                        <div className="d-flex align-items-center">
                            <div className="flex-grow-1 me-3">
                                <div className="progress progress-primary" style={{height: "6px"}}>
                          <div className="progress-bar" style={{ width: "75" }}></div>
                                </div>
                            </div>
                            <div className="flex-shrink-0">
                                <p className="mb-0 text-muted">75%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div className="col-xxl-9 col-lg-7">
        <div className="tab-content" id="user-set-tabContent">
            <div id="react-aria8348725315-:r6:-tabpane-ProfileInfo" role="tabpanel"
                aria-labelledby="react-aria8348725315-:r6:-tab-ProfileInfo" className="fade fade tab-pane active show">
                <div className="card">
                    <div className="card-header">
                        <h5>About me</h5>
                    </div>
                    <div className="card-body">
                        <p className="mb-0">Hello, I’m Anshan Handgun Creative Graphic Designer &amp; User Experience
                            Designer based in Website, I create digital Products a more Beautiful and usable place.
                            Morbid accusant ipsum. Nam nec tellus at.</p>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Personal Details</h5>
                    </div>
                    <div className="card-body">
                        <ul className="list-group list-group-flush">
                            <li className="list-group-item px-0 pt-0">
                                <div className="row">
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Full Name</p>
                                        <p className="mb-0">Anshan Handgun</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Father Name</p>
                                        <p className="mb-0">Mr. Deepen Handgun</p>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item px-0">
                                <div className="row">
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Phone</p>
                                        <p className="mb-0">(+1-876) 8654 239 581</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Country</p>
                                        <p className="mb-0">New York</p>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item px-0">
                                <div className="row">
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Email</p>
                                        <p className="mb-0">anshan.dh81@gmail.com</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Zip Code</p>
                                        <p className="mb-0">956 754</p>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item px-0 pb-0">
                                <p className="mb-1 text-muted">Address</p>
                                <p className="mb-0">Street 110-B Kalians Bag, Dewan, M.P. New York</p>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Education</h5>
                    </div>
                    <div className="card-body">
                        <ul className="list-group list-group-flush acc-feeds-list">
                            <li className="list-group-item p-0">
                                <div className="row">
                                    <div className="feed-title col-md-4">
                                        <p className="mb-1 text-muted">Master Degree (Year)</p>
                                        <p className="mb-0">2014-2017</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Institute</p>
                                        <p className="mb-0">-</p>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item p-0">
                                <div className="row">
                                    <div className="feed-title col-md-4">
                                        <p className="mb-1 text-muted">Bachelor (Year)</p>
                                        <p className="mb-0">2011-2013</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Institute</p>
                                        <p className="mb-0">Imperial College London</p>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item p-0">
                                <div className="row">
                                    <div className="feed-title col-md-4">
                                        <p className="mb-1 text-muted">School (Year)</p>
                                        <p className="mb-0">2009-2011</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Institute</p>
                                        <p className="mb-0">School of London, England</p>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Employment</h5>
                    </div>
                    <div className="card-body">
                        <ul className="list-group list-group-flush acc-feeds-list">
                            <li className="list-group-item p-0">
                                <div className="row">
                                    <div className="feed-title col-md-4">
                                        <p className="mb-1 text-muted">Senior</p>
                                        <p className="mb-0">Senior UI/UX designer (Year)</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Job Responsibility</p>
                                        <p className="mb-0">Perform task related to project manager with the 100+ team under
                                            my observation. Team management is key role in this company.</p>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item p-0">
                                <div className="row">
                                    <div className="feed-title col-md-4">
                                        <p className="mb-1 text-muted">Trainee cum Project Manager (Year)</p>
                                        <p className="mb-0">2017-2019</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Job Responsibility</p>
                                        <p className="mb-0">Team management is key role in this company.</p>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item p-0">
                                <div className="row">
                                    <div className="feed-title col-md-4">
                                        <p className="mb-1 text-muted">School (Year)</p>
                                        <p className="mb-0">2009-2011</p>
                                    </div>
                                    <div className="col-md-6">
                                        <p className="mb-1 text-muted">Institute</p>
                                        <p className="mb-0">School of London, England</p>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div id="react-aria8348725315-:r6:-tabpane-PersonalInfo" role="tabpanel"
                aria-labelledby="react-aria8348725315-:r6:-tab-PersonalInfo" className="fade fade tab-pane">
                <div className="card">
                    <div className="card-header">
                        <h5>Personal Information</h5>
                    </div>
                    <div className="card-body">
                        <div className="row">
                            <div className="col-sm-6">
                                <div className="form-group"><label className="form-label">First Name</label><input type="text"
                                        className="form-control" value="Anshan"/></div>
                            </div>
                            <div className="col-sm-6">
                                <div className="form-group"><label className="form-label">Last Name</label><input type="text"
                                        className="form-control" value="Handgun"/></div>
                            </div>
                            <div className="col-sm-6">
                                <div className="form-group"><label className="form-label">Country</label><input type="text"
                                        className="form-control" value="New York"/></div>
                            </div>
                            <div className="col-sm-6">
                                <div className="form-group"><label className="form-label">Zip code</label><input type="text"
                                        className="form-control" value="956754"/></div>
                            </div>
                            <div className="col-sm-12">
                                <div className="form-group"><label className="form-label">Bio</label><textarea
                                        className="form-control">Hello, I’m Anshan Handgun Creative Graphic Designer &amp;
                                        User Experience Designer based in Website, I create digital Products a more
                                        Beautiful and usable place. Morbid accusant ipsum. Nam nec tellus at.</textarea>
                                </div>
                            </div>
                            <div className="col-sm-12">
                                <div className="form-group mb-0"><label className="form-label">Experience</label><select
                                        className="form-control">
                                        <option>Startup</option>
                                        <option>2 year</option>
                                        <option>3 year</option>
                                        <option selected="">4 year</option>
                                        <option>5 year</option>
                                    </select></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Social Network</h5>
                    </div>
                    <div className="card-body">
                        <div className="d-flex align-items-center mb-2">
                            <div className="flex-grow-1 me-3">
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avtar avtar-xs btn-light-twitter"><i
                                                className="fab fa-twitter f-16"></i></div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h6 className="mb-0">Twitter</h6>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-shrink-0"><button className="btn btn-link-primary">Connect</button></div>
                        </div>
                        <div className="d-flex align-items-center mb-2">
                            <div className="flex-grow-1 me-3">
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avtar avtar-xs btn-light-facebook"><i
                                                className="fab fa-facebook-f f-16"></i></div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h6 className="mb-0">Facebook <small className="text-muted f-w-400">/Anshan
                                                Handgun</small></h6>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-shrink-0"><button className="btn btn-link-danger">Remove</button></div>
                        </div>
                        <div className="d-flex align-items-center">
                            <div className="flex-grow-1 me-3">
                                <div className="d-flex align-items-center">
                                    <div className="flex-shrink-0">
                                        <div className="avtar avtar-xs btn-light-linkedin"><i
                                                className="fab fa-linkedin-in f-16"></i></div>
                                    </div>
                                    <div className="flex-grow-1 ms-3">
                                        <h6 className="mb-0">Linkedin</h6>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-shrink-0"><button type="button"
                                    className="btn btn-link-primary">Connect</button></div>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Contact Information</h5>
                    </div>
                    <div className="card-body">
                        <div className="row">
                            <div className="col-sm-6">
                                <div className="form-group"><label className="form-label">Contact Phone</label><input
                                        type="text" className="form-control" value="(+99) 9999 999 999"/></div>
                            </div>
                            <div className="col-sm-6">
                                <div className="form-group"><label className="form-label">Email <span
                                            className="text-danger">*</span></label><input type="email" className="form-control"
                                        value="demo@sample.com"/ ></div>
                            </div>
                            <div className="col-sm-12">
                                <div className="form-group"><label className="form-label">Portfolio Url</label><input
                                        type="text" className="form-control" value="https://demo.com"/></div>
                            </div>
                            <div className="col-sm-12">
                                <div className="form-group mb-0"><label className="form-label">Address</label><textarea
                                        className="form-control">3379 Monroe Avenue, Fort Myers, Florida(33912)</textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="text-end btn-page">
                    <div className="btn btn-outline-secondary">Cancel</div>
                    <div className="btn btn-primary">Update Profile</div>
                </div>
            </div>
            <div id="react-aria8348725315-:r6:-tabpane-AccountInfo"
                aria-labelledby="react-aria8348725315-:r6:-tab-AccountInfo" role="tabpanel" className="fade fade tab-pane">
                <div className="card">
                    <div className="card-header">
                        <h5>General Settings</h5>
                    </div>
                    <div className="card-body">
                        <ul className="list-group list-group-flush">
                            <li className="list-group-item px-0 pt-0">
                                <div className="form-group mb-0 row"><label
                                        className="col-form-label col-md-4 col-sm-12 text-md-end">Username <span
                                            className="text-danger">*</span></label>
                                    <div className="col-md-8 col-sm-12"><input type="text" className="form-control"
                                            value="Ashoka_Tano_16"/>
                                        <div className="form-text">Your Profile URL: <a href="#"
                                                className="link-primary">https://pc.com/Ashoka_Tano_16</a></div>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item px-0">
                                <div className="form-group mb-0 row"><label
                                        className="col-form-label col-md-4 col-sm-12 text-md-end">Account Email <span
                                            className="text-danger">*</span></label>
                                    <div className="col-md-8 col-sm-12"><input type="text" className="form-control"
                                            value="demo@sample.com"/></div>
                                </div>
                            </li>
                            <li className="list-group-item px-0">
                                <div className="form-group mb-0 row"><label
                                        className="col-form-label col-md-4 col-sm-12 text-md-end">Language</label>
                                    <div className="col-md-8 col-sm-12"><select className="form-control">
                                            <option>Washington</option>
                                            <option>India</option>
                                            <option>Africa</option>
                                            <option>New York</option>
                                            <option>Malaysia</option>
                                        </select></div>
                                </div>
                            </li>
                            <li className="list-group-item px-0 pb-0">
                                <div className="form-group mb-0 row"><label
                                        className="col-form-label col-md-4 col-sm-12 text-md-end">Sign in Using <span
                                            className="text-danger">*</span></label>
                                    <div className="col-md-8 col-sm-12"><select className="form-control">
                                            <option>Password</option>
                                            <option>Face Recognition</option>
                                            <option>Thumb Impression</option>
                                            <option>Key</option>
                                            <option>Pin</option>
                                        </select></div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Advance Settings</h5>
                    </div>
                    <div className="card-body">
                        <ul className="list-group list-group-flush">
                            <li className="list-group-item px-0 pt-0">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <p className="mb-1">Secure Browsing</p>
                                        <p className="text-muted text-sm mb-0">Browsing Securely ( https ) wh
                                            necessary</p>
                                    </div>
                                    <div className="form-check form-switch p-0"><input
                                            className="form-check-input h4 position-relative m-0" type="checkbox"
                                            role="switch" checked=""/></div>
                                </div>
                            </li>
                            <li className="list-group-item px-0">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <p className="mb-1">Login Notifications</p>
                                        <p className="text-muted text-sm mb-0">Notify when login attempted from other place
                                        </p>
                                    </div>
                                    <div className="form-check form-switch p-0"><input
                                            className="form-check-input h4 position-relative m-0" type="checkbox"
                                            role="switch" checked=""/></div>
                                </div>
                            </li>
                            <li className="list-group-item px-0 pb-0">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div>
                                        <p className="mb-1">Login Approvals</p>
                                        <p className="text-muted text-sm mb-0">Approvals is not required when login from
                                            unrecognized devices.</p>
                                    </div>
                                    <div className="form-check form-switch p-0"><input
                                            className="form-check-input h4 position-relative m-0" type="checkbox"
                                            role="switch" checked=""/></div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Recognized Devices</h5>
                    </div>
                    <div className="card-body">
                        <ul className="list-group list-group-flush">
                            <li className="list-group-item px-0 pt-0">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div className="me-2">
                                        <div className="d-flex align-items-center">
                                            <div className="avtar bg-light-primary"><i
                                                    className="ph-duotone ph-desktop f-24"></i></div>
                                            <div className="ms-2">
                                                <p className="mb-1">Celt Desktop</p>
                                                <p className="mb-0 text-muted">4351 Deans Lane</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-success d-inline-block me-2"><i
                                                className="fas fa-circle f-10 me-2"></i>Current Active</div><a
                                            className="text-danger" href="/application/account-profile#!"><i
                                                className="feather icon-x-circle"></i></a>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item px-0">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div className="me-2">
                                        <div className="d-flex align-items-center">
                                            <div className="avtar bg-light-primary"><i
                                                    className="ph-duotone ph-device-tablet-camera f-24"></i></div>
                                            <div className="ms-2">
                                                <p className="mb-1">Imco Tablet</p>
                                                <p className="mb-0 text-muted">4185 Michigan Avenue</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted d-inline-block me-2"><i
                                                className="fas fa-circle f-10 me-2"></i>Active 5 days ago</div><a
                                            className="text-danger" href="/application/account-profile#!"><i
                                                className="feather icon-x-circle"></i></a>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item px-0 pb-0">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div className="me-2">
                                        <div className="d-flex align-items-center">
                                            <div className="avtar bg-light-primary"><i
                                                    className="ph-duotone ph-device-mobile-camera f-24"></i></div>
                                            <div className="ms-2">
                                                <p className="mb-1">Albs Mobile</p>
                                                <p className="mb-0 text-muted">3462 Fairfax Drive</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted d-inline-block me-2"><i
                                                className="fas fa-circle f-10 me-2"></i>Active 1 month ago</div><a
                                            className="text-danger" href="/application/account-profile#!"><i
                                                className="feather icon-x-circle"></i></a>
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Active Sessions</h5>
                    </div>
                    <div className="card-body">
                        <ul className="list-group list-group-flush">
                            <li className="list-group-item px-0 pt-0">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div className="me-2">
                                        <div className="d-flex align-items-center">
                                            <div className="avtar bg-light-primary"><i
                                                    className="ph-duotone ph-desktop f-24"></i></div>
                                            <div className="ms-2">
                                                <p className="mb-1">Celt Desktop</p>
                                                <p className="mb-0 text-muted">4351 Deans Lane</p>
                                            </div>
                                        </div>
                                    </div><button className="btn btn-link-danger">Logout</button>
                                </div>
                            </li>
                            <li className="list-group-item px-0 pb-0">
                                <div className="d-flex align-items-center justify-content-between">
                                    <div className="me-2">
                                        <div className="d-flex align-items-center">
                                            <div className="avtar bg-light-primary"><i
                                                    className="ph-duotone ph-device-tablet-camera f-24"></i></div>
                                            <div className="ms-2">
                                                <p className="mb-1">Moon Tablet</p>
                                                <p className="mb-0 text-muted">4185 Michigan Avenue</p>
                                            </div>
                                        </div>
                                    </div><button className="btn btn-link-danger">Logout</button>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="card">
                    <div className="text-end card-body"><button className="btn btn-outline-dark me-2">Clear</button><button
                            className="btn btn-primary">Update Profile</button></div>
                </div>
            </div>
            <div id="react-aria8348725315-:r6:-tabpane-ChangePassword"
                aria-labelledby="react-aria8348725315-:r6:-tab-ChangePassword" role="tabpanel"
                className="fade fade tab-pane">
                <div className="alert alert-warning p-0 card">
                    <div className="card-body">
                        <div className="d-flex align-items-center">
                            <div className="flex-grow-1 me-3">
                                <h4 className="alert-heading">Alert!</h4>
                                <p className="mb-2">Your Password will expire in every 3 months. So change it periodically.
                                </p><a href="#" className="alert-link"><u>Do not share your password</u></a>
                            </div>
                      <div className="flex-shrink-0"><img alt="img" loading="lazy" width="92" height="90"
                        decoding="async" data-nimg="1" className="img-fluid wid-80"
                              
                        src="/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fimg-accout-password-alert.54f1e0f5.png&amp;w=256&amp;q=75"
                        style={{ color: "transparent" }} /></div>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Change Password</h5>
                    </div>
                    <div className="card-body">
                        <ul className="list-group list-group-flush">
                            <li className="list-group-item pt-0 px-0">
                                <div className="form-group mb-0 row"><label
                                        className="col-form-label col-md-4 col-sm-12 text-md-end">Current Password <span
                                            className="text-danger">*</span></label>
                                    <div className="col-md-8 col-sm-12"><input type="password" className="form-control"/>
                                        <div className="form-text"> Forgot password? <a className="link-primary"
                                                href="/application/account-profile#">Click here</a></div>
                                    </div>
                                </div>
                            </li>
                            <li className="list-group-item px-0">
                                <div className="form-group mb-0 row"><label
                                        className="col-form-label col-md-4 col-sm-12 text-md-end">New Password <span
                                            className="text-danger">*</span></label>
                                    <div className="col-md-8 col-sm-12"><input type="password" className="form-control"/></div>
                                </div>
                            </li>
                            <li className="list-group-item pb-0 px-0">
                                <div className="form-group mb-0 row"><label
                                        className="col-form-label col-md-4 col-sm-12 text-md-end">Confirm Password <span
                                            className="text-danger">*</span></label>
                                    <div className="col-md-8 col-sm-12"><input type="password" className="form-control"/></div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="card">
                    <div className="text-end card-body">
                        <div className="btn btn-outline-secondary me-2">Cancel</div>
                        <div className="btn btn-primary">Change Password</div>
                    </div>
                </div>
            </div>
            <div id="react-aria8348725315-:r6:-tabpane-EmailSetting" role="tabpanel"
                aria-labelledby="react-aria8348725315-:r6:-tab-EmailSetting" className="fade fade tab-pane">
                <div className="card">
                    <div className="card-header">
                        <h5>Email Settings</h5>
                    </div>
                    <div className="card-body">
                        <h6 className="mb-3">Setup Email Notification</h6>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div>
                                <p className="text-muted mb-0">Email Notification</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input" checked=""/></div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-0">
                            <div>
                                <p className="text-muted mb-0">Send Copy To Personal Email</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input"/></div>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Activity Related Emails</h5>
                    </div>
                    <div className="card-body">
                        <h6 className="mb-3">When to email?</h6>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div>
                                <p className="text-muted mb-0">Have new notifications</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input" checked=""/></div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div>
                                <p className="text-muted mb-0">Youre sent a direct message</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input"/></div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div>
                                <p className="text-muted mb-0">Someone adds you as a connection</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input" checked=""/></div>
                        </div>
                        <hr className="my-2 border border-secondary-subtle"/>
                        <h6 className="mb-3">When to escalate emails?</h6>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div>
                                <p className="text-muted mb-0">Upon new order</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input" checked=""/></div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div>
                                <p className="text-muted mb-0">New membership approval</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input"/></div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-0">
                            <div>
                                <p className="text-muted mb-0">Member registration</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input" checked=""/></div>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <h5>Updates from System Notification</h5>
                    </div>
                    <div className="card-body">
                        <h6 className="mb-3">Email you with?</h6>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div>
                                <p className="text-muted mb-0">News about PCT-themes products and feature updates</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input" checked=""/></div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div>
                                <p className="text-muted mb-0">Tips on getting more out of PCT-themes</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input" checked=""/></div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div>
                                <p className="text-muted mb-0">Things you missed since you last logged into PCT-themes</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input"/></div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                            <div>
                                <p className="text-muted mb-0">News about products and other services</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input"/></div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between mb-0">
                            <div>
                                <p className="text-muted mb-0">Tips and Document business products</p>
                            </div>
                            <div className="form-switch p-0"><input role="switch" type="checkbox"
                                    className="m-0 h5 position-relative form-check-input"/></div>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="text-end btn-page card-body">
                        <div className="btn btn-outline-secondary">Cancel</div>
                        <div className="btn btn-primary">Update Profile</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
        </>
    );
};
