import { TableroHome } from "../../components/TableroHome/TableroHome";
import { AppLayout } from "../../layout/AppLayout"


export const AppPage = () => {
  return (
      <AppLayout>
          <div className="pc-container">
              <div className="pc-content">
                  <div className="row">
                      <div className="col-md-12 col-xxl-4">
                          <div className="card statistics-card-1">
                              <div className="card-body">
                                  <img src="../../../../public/assets/panel/1.svg" alt="img" className="img-fluid img-bg" />
                                  <div className="d-flex align-items-center">
                                      <div className="avtar" style={{ backgroundColor: "#000000", color: "#FFFFFF", marginRight: "1rem" }}>
                                          <i className="ti ti-users"></i>
                                      </div>
                                      <div>
                                          <p className="text-muted mb-0">LEADS NUEVOS</p>
                                          <div className="d-flex align-items-end">
                                              <h2 className="mb-0 f-w-500">50</h2>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="col-md-12 col-xxl-4">
                          <div className="card statistics-card-1">
                              <div className="card-body">
                                  <img src="../../../../public/assets/panel/2.svg" alt="img" className="img-fluid img-bg" />
                                  <div className="d-flex align-items-center">
                                      <div className="avtar" style={{ backgroundColor: "#000000", color: "#FFFFFF", marginRight: "1rem" }}>
                                          <i className="ti ti-user-x"></i>
                                      </div>
                                      <div>
                                          <p className="text-muted mb-0">LEADS REQUIEREN ATENCIÓN</p>
                                          <div className="d-flex align-items-end">
                                              <h2 className="mb-0 f-w-500">250</h2>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="col-md-12 col-xxl-4">
                          <div className="card statistics-card-1">
                              <div className="card-body">
                                  <img src="../../../../public/assets/panel/3.svg" alt="img" className="img-fluid img-bg" />
                                  <div className="d-flex align-items-center">
                                      <div className="avtar" style={{ backgroundColor: "#000000", color: "#FFFFFF", marginRight: "1rem" }}>
                                          <i className="ti ti-calendar"></i>
                                      </div>
                                      <div>
                                          <p className="text-muted mb-0">EVENTOS PARA HOY</p>
                                          <div className="d-flex align-items-end">
                                              <h2 className="mb-0 f-w-500">2</h2>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="row">
                      <div className="col-md-12 col-xxl-4">
                          <div className="card statistics-card-1">
                              <div className="card-body">
                                  <img src="../../../../public/assets/panel/1.svg" alt="img" className="img-fluid img-bg" />
                                  <div className="d-flex align-items-center">
                                      <div className="avtar" style={{ backgroundColor: "#000000", color: "#FFFFFF", marginRight: "1rem" }}>
                                          <i className="ti ti-trending-up"></i>
                                      </div>
                                      <div>
                                          <p className="text-muted mb-0">OPORTUINDADES</p>
                                          <div className="d-flex align-items-end">
                                              <h2 className="mb-0 f-w-500">50</h2>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="col-md-12 col-xxl-4">
                          <div className="card statistics-card-1">
                              <div className="card-body">
                                  <img src="../../../../public/assets/panel/2.svg" alt="img" className="img-fluid img-bg" />
                                  <div className="d-flex align-items-center">
                                      <div className="avtar" style={{ backgroundColor: "#000000", color: "#FFFFFF", marginRight: "1rem" }}>
                                          <i className="ti ti-users"></i>
                                      </div>
                                      <div>
                                          <p className="text-muted mb-0">ORDENES DE VENTA</p>
                                          <div className="d-flex align-items-end">
                                              <h2 className="mb-0 f-w-500">250</h2>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="col-md-12 col-xxl-4">
                          <div className="card statistics-card-1">
                              <div className="card-body">
                                  <img src="../../../../public/assets/panel/3.svg" alt="img" className="img-fluid img-bg" />
                                  <div className="d-flex align-items-center">
                                      <div className="avtar" style={{ backgroundColor: "#000000", color: "#FFFFFF", marginRight: "1rem" }}>
                                          <i className="ti ti-users"></i>
                                      </div>
                                      <div>
                                          <p className="text-muted mb-0">CONTRATO FIRMADO</p>
                                          <div className="d-flex align-items-end">
                                              <h2 className="mb-0 f-w-500">2</h2>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </AppLayout>
  );
}
