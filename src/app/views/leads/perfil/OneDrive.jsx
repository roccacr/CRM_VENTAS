

export const OneDrive = () => {
    const { microsoftUser } = useSelector((state) => state.auth); 
    const [inProgress, setInProgress] = useState(false);
    const handleLogin = () => {
        setInProgress("microsoft");
    };
   return (
      <>
         <div className="card">
            <div className="card-header">
               <h5>OneDrive Subida de archivos</h5>
            </div>
            <div className="card-body">
               <p className="mb-0">Aquí se desglosan todas las subidas de archivos del cliente</p>
            </div>
         </div>

         <div className="card">
            <div className="card-header">
               <h5>OneDrive Subida de archivos</h5>
            </div>
            <div className="card-body">
               <div className="table-responsive">
               <div className="text-center">
                <button
                  onClick={handleLogin}
                  disabled={inProgress === "microsoft"}
                  className="btn btn-link p-0"
                >
                  <img
                    src="/assets/images/authentication/microsoft.png"
                    alt="Microsoft"
                    style={{ width: "30%", height: "30%" }}
                  />
                </button>
              </div>
               </div>
            </div>
         </div>
      </>
   );
};
