



export const Auth_Layout = ({ children, title = "" }) => {
  return (
    <>
      {/* Estructura principal del layout de autenticación */}
      <div className="auth-main v1">
        <div className="auth-wrapper">
          <div className="auth-form">
            {/* Card que contiene el formulario de autenticación */}
            <div className="card my-5">
              <div className="card-body">
                {/* Renderiza los componentes hijos pasados a AuthLayout */}
                {children}
                {/* Separador con el nombre del grupo de desarrollo */}
                <center>
                  <div className="separator my-3">
                    <span>© CRM VENTAS ROCCA DEVELOPMENT GROUP </span>
                  </div>
                </center>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
