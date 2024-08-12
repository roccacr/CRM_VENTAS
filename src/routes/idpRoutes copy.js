
/*======= NUEVO SISTEMA DE CRM======== */

const oportunidades_file = require('../models/oportunidades/oportunidades');
const clients_file = require('../models/clients/clients');
const leads = require('../models/leads/leads');
const estimaciones_file = require('../models/estimaciones/estimaciones');
const supervisor = require('../models/supervisor/supervisor');
const cotizaciones = require('../models/cotizaciones/cotizaciones');
/*======= NUEVO SISTEMA DE CRM======== */

const salesorders_file = require('../models/salesorders/salesorders');
const oportunidades = require('../models/oportunidades');
const estimaciones = require('../models/estimaciones');
const salesorders = require('../models/salesorders');
const expedientes = require('../models/expedientes');
const employees = require('../models/employees');
const clients = require('../models/clients');
const helpers = require('../utils/helpers');
const multer = require('multer');



/*======= nueva integracion de CRM ======== */
const homeCors = require('../models/homeCors/leadManagement');
const bitacoras = require('../models/bitacoras');
const login = require('../models/login/login');
const select = require('../models/select/select');
const update = require('../models/update/update');

module.exports = function (app) {


    /*======= FUNCIONALIDADES CON PARAMETRO DE BASE DE DATOS======== */



    /*FUNCIONES DE LEAD A NETSUITE */
    app.post('/api/v2/client/add/netsuite', (req, res) => {
        clients_file.crerCliente(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });

    app.post('/api/v2/client/consult', (req, res) => {
        clients_file.obtenerCliente(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });

    app.post('/api/v2/client/editNetsuite', (req, res) => {
        clients_file.actualizarCliente(req.body)
            .then(clients => helpers.manageResponse(res, clients, null))
            .catch(err => helpers.manageResponse(res, null, err))
    });
    /*FUNCIONES DE LEAD A NETSUITE */

    /*CREAMOS LA ESTIMACION */
    app.post('/api/v2/estimacion/add/Netsuite', (req, res) => {
        estimaciones_file.CrearNetsuite(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });

    app.post('/api/v2/estimacion/edit/Netsuite', (req, res) => {
        estimaciones_file.EditarEstimacion(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });
    /*CREAMOS LA ESTIMACION */

    /*FUNCIONES DE oportunidades */
    app.get('/api/v2/oportunidad/:id', (req, res) => {
        const id = req.params.id;
        oportunidades_file.getDataiD(id, "pruebas")
            .then(response => helpers.manageResponse(res, response, null))
            .catch(err => helpers.manageResponse(res, null, err))
    });


    app.post('/api/v2/oportunidades/editNetsuite', (req, res) => {
        oportunidades_file.editarOportunidad(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });

    app.get('/api/v2/oportuindades/lead/:id', (req, res) => {
        const id = req.params.id;
        oportunidades_file.getDataiDLead(id, "pruebas")
            .then(response => helpers.manageResponse(res, response, null))
            .catch(err => helpers.manageResponse(res, null, err))
    });
	/*FUNCIONES DE oportunidades */

    /*FUNCIONES DE ESTIMACIONES */
    app.post('/api/v2/estimacion/consult', (req, res) => {
        estimaciones_file.obtenerEstimacion(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });

    app.post('/api/v2/estimacion/prereserva', (req, res) => {
        estimaciones_file.PreReserva(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });

    app.post('/api/v2/estimacion/prereservaCaida', (req, res) => {
        estimaciones_file.caidaReserva(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });
    /*FUNCIONES DE ESTIMACIONES */

    /*******************************CREAR ORDEN DE VENTA****************************************** */
    app.post('/api/v2/orden/recordTraform', (req, res) => {
        salesorders_file.crerSalesorderss(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });
	app.post('/api/v2/orden/GuardarEstimacion', (req, res) => {
		salesorders_file.GuardarEstimacion(req.body, "pruebas")
			.then(resp => helpers.manageResponse(res, resp, null))
			.catch(err => helpers.manageResponse(res, null, err));
	});

	app.post('/api/v2/orden/consult', (req, res) => {
		salesorders_file.ExtraerOrden(req.body)
			.then(resp => helpers.manageResponse(res, resp, null))
			.catch(err => helpers.manageResponse(res, null, err));
	});



    app.post('/api/v2/orden/edit/Netsuite', (req, res) => {
        salesorders_file.EditarOrden(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });

    app.post('/api/v2/orden/reserva', (req, res) => {
        salesorders_file.Reserva(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });



    app.post('/api/v2/orden/cierre', (req, res) => {
        salesorders_file.cierre(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });

    /*======= FUNCIONALIDADES CON PARAMETRO DE BASE DE DATOS======== */


    function createRoute(route, method, callback) {
        app[method](route, (req, res) => {
            callback(req.body, "pruebas")
                .then(resp => helpers.manageResponse(res, resp, null))
                .catch(err => helpers.manageResponse(res, null, err));
        });
    }
    createRoute('/api/v2/oportunidad/estimaciones', 'post', oportunidades_file.getDataEst);
    createRoute('/api/v2/leads/Reactiv', 'post', leads.Reactiv);
    createRoute('/api/v2/leads/reporte', 'post', leads.reporte);
    createRoute('/api/v2/leads/Update', 'post', leads.Update);
    createRoute('/api/v2/leads/add/', 'post', leads.add);
    createRoute('/api/v2/leads', 'post', leads.getData);


    /*******************************LEAD DE VENDEDORES PARA SUPERVISOR***************************************** */
    createRoute('/api/v2/leads/supervisor', 'post', supervisor.getData);
    createRoute('/api/v2/reporte/supervisor', 'post', supervisor.reporteExcel);


  



    /*FUNCIONES DE LOS SELECTED  */
    /*******************************cotizaciones***************************************** */
    createRoute('/api/v2/cotizaciones/list', 'post', cotizaciones.getData);


    /*******************************EMPLEADO NETSUITE****************************************** */
    app.post( '/employee/actualizar', ( req, res ) => {
        employees.actualizarEmployees( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );


    app.post( '/employee/getDatos', ( req, res ) => {
        employees.obtenerEmployee( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );




    /*******************************CLIENTE NETSUITE****************************************** */
    app.post( '/client/getDatos', ( req, res ) => {
        clients.obtenerCliente( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );

    app.post( '/client/add/crm', ( req, res ) => {
        clients.insertarCliente( req.body, "pruebas" )
            .then( response => helpers.manageResponse( res, response, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );

    app.post( '/client/add/netsuite', ( req, res ) => {
        clients.crerCliente( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );

    /********************************GENERAL****************************************** */
    app.get( '/', ( req, res ) => {
        res.send( "SISTEM APP SAMBOX " )
    } );

   

    /********************************CLIENTES PUT****************************************** */
    app.post( '/client/actualizar', ( req, res ) => {
        clients.actualizarCliente( req.body )
            .then( clients => helpers.manageResponse( res, clients, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) )
    } );

    
    app.post( '/client/actualizar/add', ( req, res ) => {
        clients.actualizarCliente_add( req.body )
            .then( clients => helpers.manageResponse( res, clients, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) )
    } );

      //agregamos un usuario nuevo
      app.post( '/client/insert/bd', ( req, res ) => {
        clients.insertarInformacion( req.body, "pruebas" )
            .then( response => helpers.manageResponse( res, response, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
     } );





    /*******************************oportunidad crear en netsuite****************************************** */
    app.post( '/oportunidades/add', ( req, res ) => {
        oportunidades.crerOportunidades( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );








    app.post( '/oportunidades/add/crm', ( req, res ) => {
        oportunidades.insertarOportunidad( req.body, "pruebas" )
            .then( response => helpers.manageResponse( res, response, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );

    app.post( '/oportunidad/getDatos', ( req, res ) => {
        oportunidades.obtenerOportunidad( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );

    /*******************************estimacion crear en netsuite****************************************** */
    app.post( '/estimaciones/add', ( req, res ) => {
        estimaciones.crerEstimaciones( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );

    app.post( '/estimaciones/add/crm', ( req, res ) => {
        estimaciones.insertarEstimacion( req.body, "pruebas" )
            .then( response => helpers.manageResponse( res, response, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );

    app.post( '/estimaciones/getDatos', ( req, res ) => {
        estimaciones.obtenerEstimacion( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );


    app.post( '/estimaciones/putUpdate', ( req, res ) => {
        estimaciones.actualizarEstimacion( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );






    /*******************************CREAR ORDEN DE VENTA****************************************** */
    app.post( '/salesorder/add', ( req, res ) => {
        salesorders.crerSalesorder( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );

    app.post( '/salesorder/getDatos', ( req, res ) => {
        salesorders.obtenerSalesorders( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );


    app.post( '/salesorder/update_salesorder', ( req, res ) => {
        salesorders.actualizarOv( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );

    app.post( '/salesorder/aprobaciones', ( req, res ) => {
        salesorders.Estados_Aprobaciones( req.body, "pruebas" )
            .then( response => helpers.manageResponse( res, response, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    } );


  /*******************************expedientes expedientes****************************************** */
    app.post( '/expedientes/getDatos', ( req, res ) => {
        expedientes.obtenerExp( req.body )
            .then( resp => helpers.manageResponse( res, resp, null ) )
            .catch( err => helpers.manageResponse( res, null, err ) );
    });
    app.post('/exp/edit', (req, res) => {
        expedientes.Estados_Aprobaciones(req.body, "pruebas")
            .then(response => helpers.manageResponse(res, response, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });




    /*******************************NUEVA INTEGRACION DE CRM****************************************** */

    app.post('/bitacora/add/crm/bitacora', (req, res) => {
        bitacoras.insertarBitacora(req.body, "pruebas")
            .then(response => helpers.manageResponse(res, response, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });
    app.post('/api/v2/bitacora/created', (req, res) => {
        bitacoras.crereBitacora(req.body, "pruebas")
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });
    app.get('/api/v2/bitacora/DivBitacora/:id', (req, res) => {
        const id = req.params.id;
        bitacoras.DivBitacora(id, "pruebas")
            .then(response => helpers.manageResponse(res, response, null))
            .catch(err => helpers.manageResponse(res, null, err))
    });
    app.get('/api/v2/bitacora/lead/:id', (req, res) => {
        const id = req.params.id;
        bitacoras.getBitacoraLead(id, "pruebas")
            .then(response => helpers.manageResponse(res, response, null))
            .catch(err => helpers.manageResponse(res, null, err))
    });


    app.post("/Api/V2/authenticated", (req, res) => {
        const { sqlQuery } = req.body;

        login.auth(sqlQuery)
            .then((resp) => helpers.manageResponse(res, resp, null))
            .catch((err) => helpers.manageResponse(res, null, err));
    });

    /*============================== FUNCTION FOR SELECT * ==========================================*/
    app.post("/Api/V2/select", (req, res) => {
        const { sqlQuery } = req.body;
        const type = "pruebas";
        select.getDatas(sqlQuery, type)
            .then((resp) => helpers.manageResponse(res, resp, null))
            .catch((err) => helpers.manageResponse(res, null, err));
    });

    /*============================== FUNCTION FOR UPDATE * ==========================================*/
    app.put("/Api/V2/update", (req, res) => {
        const { sqlQuery } = req.body;
        console.log(" req.body: ", req.body);
        const type = "pruebas";
        update.putData(sqlQuery, type)
            .then((resp) => helpers.manageResponse(res, resp, null))
            .catch((err) => helpers.manageResponse(res, null, err));
    });


    app.post('/Api/V2/oportunidades/add', (req, res) => {
        oportunidades.crerOportunidades(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });

    app.post('/Api/V2/oportunidades/editNetsuite', (req, res) => {
        oportunidades.editarOportunidad(req.body)
            .then(resp => helpers.manageResponse(res, resp, null))
            .catch(err => helpers.manageResponse(res, null, err));
    });


};