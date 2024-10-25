
export const HeaderContent = ({leadInformations }) => {
  return (
      <>
          {" "}
          <div className="bg-dark card">
              <div className="card-body">
                  <div className="d-flex align-items-center">
                      <div className="flex-grow-1 me-3">
                          <h3 className="text-white">{leadInformations.nombre_lead}</h3>
                          <p className="text-white text-opacity-75 text-opa mb-0">perfil del usuario</p>
                      </div>
                      <div className="flex-shrink-0">
                          <img alt="img" loading="lazy" width="92" height="90" decoding="async" data-nimg="1" className="img-fluid wid-80" srcSet="" src="https://light-able-react-light.vercel.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fimg-accout-alert.a2294f08.png&w=96&q=75" style={{ color: "transparent" }} />
                      </div>
                  </div>
              </div>
          </div>
      </>
  );
}
