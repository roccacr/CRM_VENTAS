const mysql = require("mysql2/promise");
const config = require("../../config/config");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const sendMailer = require("../senMailer/sendMailer");


const authenticated = {};

// Función para crear una conexión a la base de datos
const createConnection = async (database) => {
    return await mysql.createConnection(config.database[database]);
};

// Función para manejar operaciones de base de datos de forma segura
const handleDatabaseOperation = async (operation, database) => {
    let connection;
    try {
        connection = await createConnection(database);
        return await operation(connection);
    } catch (error) {
        console.error(`Error en la operación de base de datos: ${error.message}`);
        // SEGURIDAD: No exponer detalles internos del error al cliente
        return { statusCode: 500, error: "Error interno del servidor" };
    } finally {
        // SEGURIDAD: Asegurar que la conexión siempre se cierre para prevenir fugas de recursos
        if (connection) await connection.end();
    }
};

// Genera un token JWT
authenticated.generatedToken = async (dataParams) => {
    const payload = {
        iat: Math.floor(Date.now() / 1000),
        // SEGURIDAD: Establecer una expiración para el token
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 5, // 5 horas
        data: {
            id: dataParams.id_admin || 0,
            name_admin: dataParams.name_admin || "null",
            email: dataParams.email,
        },
    };
    // SEGURIDAD: Usar una clave secreta fuerte para firmar el token
    return jwt.sign(payload, config.jwtSecret);
};



// Inicia el proceso de recuperación de contraseña
authenticated.recoverPassword = async (dataParams) => {
    return handleDatabaseOperation(async (connection) => {
        const token = await authenticated.generatedToken(dataParams);
        const [result] = await connection.execute("UPDATE admins SET token_admin=?, status_admin=?, passRecovery_admin=? WHERE email_admin=?", [token, 0, 1, dataParams.email]);
        // SEGURIDAD: No revelar si el email existe o no
        return { statusCode: 200, message: "Si el email existe, se ha enviado un enlace de recuperación" };
    }, dataParams.database);
};

// Obtiene información del usuario
authenticated.getUser = async (dataParams) => {
    return handleDatabaseOperation(async (connection) => {
        // SEGURIDAD: Usar consultas parametrizadas para prevenir inyección SQL
        const [result] = await connection.execute("SELECT id_admin,idnetsuite_admin , name_admin, token_admin, id_rol_admin, password_admin, email_admin, status_admin FROM admins WHERE email_admin=?", [dataParams.email]);
        return { statusCode: result.length > 0 ? 200 : 210, data: result };
    }, dataParams.database);
};

// Actualiza el token del usuario
authenticated.updateTokenUser = async (dataParams) => {
    return handleDatabaseOperation(async (connection) => {
        const token = await authenticated.generatedToken(dataParams);
        const [result] = await connection.execute("UPDATE admins SET token_admin=? WHERE email_admin=?", [token, dataParams.email]);
        return { statusCode: result.affectedRows === 0 ? 210 : 200, data: result };
    }, dataParams.database);
};

// Inicia sesión del usuario
authenticated.startSession = async (dataParams) => {
    return handleDatabaseOperation(async () => {
        const getUser = await authenticated.getUser(dataParams);
        if (getUser.statusCode !== 200) {
            // SEGURIDAD: No revelar si el usuario existe o no
            return { statusCode: 401, data: { message: "Credenciales incorrectas" } };
        }

        const { password_admin } = getUser.data[0];
        // SEGURIDAD: Usar bcrypt para comparar contraseñas de forma segura
        const passwordMatch = await bcrypt.compare(dataParams.password, password_admin);


        if (!passwordMatch) {
            // SEGURIDAD: Usar el mismo mensaje para credenciales incorrectas
            return { statusCode: 401, data: { message: "Credenciales incorrectas" } };
        }

        await authenticated.updateTokenUser(dataParams);
        const updatedUser = await authenticated.getUser(dataParams);
        // SEGURIDAD: No devolver información sensible como la contraseña
        const { password_admin: _, ...safeUserData } = updatedUser.data[0];
        return { statusCode: 200, data: safeUserData };
    }, dataParams.database);
};

// Valida un token JWT
authenticated.validateToken = (token_admin) => {
    try {
        // SEGURIDAD: Verificar el token con la clave secreta
        const decoded = jwt.verify(token_admin, config.jwtSecret);

        if (decoded.exp * 1000 < Date.now()) {
            throw new jwt.TokenExpiredError("El token ha expirado", new Date(decoded.exp * 1000));
        }
        return { statusCode: 200, data: "El token es válido" };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return { statusCode: 401, data: "El token ha expirado" };
        } else if (error instanceof jwt.JsonWebTokenError) {
            return { statusCode: 400, data: "El token no es válido" };
        }
        // SEGURIDAD: No exponer detalles internos del error
        return { statusCode: 500, data: "Error en la validación del token" };
    }
};

/**
 * Verifica si un correo electrónico ya está registrado en la base de datos.
 *
 * @param {Object} dataParams - Parámetros para la validación del correo electrónico.
 * @param {string} dataParams.email - Correo electrónico a validar.
 * @param {string} dataParams.database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} Promesa que resuelve con el resultado de la consulta, indicando si el correo ya existe.
 */
authenticated.SP_VALIDAR_EMAIL = async (dataParams) => {
    return handleDatabaseOperation(async (connection) => {
        // Definición de la consulta SQL para contar cuántos registros existen con el correo proporcionado.
        const query = `
            SELECT COUNT(*) AS count
            FROM admins
            WHERE email_admin = ?
        `;

        // Parámetros de la consulta: el correo electrónico a validar.
        const params = [dataParams.email ?? null];

        // Ejecuta la consulta en la base de datos y obtiene el resultado.
        const [result] = await connection.execute(query, params);

        return { statusCode: 200, data: result };
    }, dataParams.database);
};


authenticated.SP_RECUPERAR_CONTRASENA = async (dataParams) => {
    return handleDatabaseOperation(async (connection) => {
        try {
            // Obtener el año actual.
            const currentYear = new Date().getFullYear();

            /**
             * Genera una nueva contraseña siguiendo el formato `!Rocca.[año][caracteres aleatorios]`.
             *
             * @returns {string} Contraseña generada.
             */
            const generatePassword = () => {
                const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
                return `!Rocca.${currentYear}${randomChars}`;
            };

            // Generar una nueva contraseña y encriptarla usando bcrypt.
            const rawPassword = generatePassword();

            // Usar una sal fija como en el ejemplo de PHP.
            const salt = "$2a$07$azybxcags23425sdg23sdfhsd$";
            // Generar el hash con la sal fija.
            const encryptedPassword = await bcrypt.hash(rawPassword, salt);

            // Definir la consulta SQL para actualizar la contraseña del administrador.
            const query = `
                UPDATE admins
                SET password_admin = ?
                WHERE email_admin = ?;
            `;

            // Parámetros para la consulta SQL: contraseña encriptada y correo del administrador.
            const params = [
                encryptedPassword, // Contraseña encriptada.
                dataParams.email, // Correo electrónico del administrador.
            ];

            // Ejecutar la consulta en la base de datos para actualizar la contraseña.
            const [result] = await connection.execute(query, params);

            // Preparar los datos para enviar el correo electrónico con la nueva contraseña.
            const mailData = {
                email: dataParams.email,
                password: rawPassword, // Contraseña sin encriptar para el correo.
            };

            // Verificar si la consulta afectó alguna fila (contraseña actualizada con éxito).
            if (result.affectedRows > 0) {
                // Enviar el correo electrónico utilizando el servicio de correo.
                await sendMailer.toolMail(mailData, "templatePasswordRecover", "CRM HOTEL : Recuperación de clave");
            }

            // Retornar el resultado de la consulta.
            return { statusCode: result.affectedRows > 0 ? 200 : 404, message: result.affectedRows > 0 ? "Contraseña actualizada y correo enviado" : "Correo no encontrado" };
        } catch (error) {
            // Manejar y registrar cualquier error ocurrido durante el proceso.
            console.error("Error al recuperar contraseña:", error.message);
            return { statusCode: 500, error: "Error interno en la recuperación de contraseña" };
        }
    }, dataParams.database);
};

// $2a$07$azybxcags23425sdg23sdeBuMTaZMjxh107gGCUvdA7ES6SKZvGby;



module.exports = authenticated;
