// Importación de módulos necesarios
const mysql = require("mysql2/promise"); // Para interacción asíncrona con MySQL
const config = require("../../config/config"); // Configuración del sistema
const jwt = require("jsonwebtoken"); // Para manejo de JSON Web Tokens
const bcrypt = require("bcrypt"); // Para encriptación de contraseñas



// Objeto principal que contiene todas las funciones de autenticación
const authenticated = {
    /**
     * Crea una conexión a la base de datos
     * @param {string} database - Nombre de la base de datos a conectar
     * @returns {Promise<Connection>} Conexión a la base de datos
     */
    async createDbConnection(database) {
        return await mysql.createConnection(config.database[database]);
    },

    /**
     * Genera un token JWT
     * @param {Object} dataParams - Datos del usuario para incluir en el token
     * @returns {string} Token JWT generado
     */
    async generatedToken(dataParams) {
        // Crear el payload del token
        const payload = {
            iat: Math.floor(Date.now() / 1000), // Tiempo de emisión
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 5, // Expiración en 5 horas
            data: {
                id: dataParams.id_user || 0,
                name_user: dataParams.name_user || "null",
                email: dataParams.email,
            },
        };
        // Firmar y retornar el token
        return jwt.sign(payload, config.jwtSecret);
    },

    /**
     * Ejecuta una consulta SQL
     * @param {Connection} connection - Conexión a la base de datos
     * @param {string} sql - Consulta SQL a ejecutar
     * @param {Array} params - Parámetros para la consulta SQL
     * @returns {Object} Resultado de la consulta y código de estado
     */
    async executeQuery(connection, sql, params) {
        try {
            const [result] = await connection.execute(sql, params);
            return {
                statusCode: result.affectedRows === 0 ? 210 : 200,
                data: result,
            };
        } catch (error) {
            console.error(`Error executing query: ${sql}`, error);
            return { statusCode: 500, error: error.message };
        }
    },

    /**
     * Inicia el proceso de recuperación de contraseña
     * @param {Object} dataParams - Datos necesarios para la recuperación
     * @returns {Object} Resultado de la operación y código de estado
     */
    async recoverPassword(dataParams) {
        const { email, database } = dataParams;
        const connection = await this.createDbConnection(database);
        try {
            const token = await this.generatedToken(dataParams);
            return await this.executeQuery(connection, `UPDATE users SET token_user=?, status_user=?, passRecovery_user=? WHERE email_user=?`, [token, 0, 1, email]);
        } finally {
            await connection.end(); // Asegura que la conexión se cierre
        }
    },

    /**
     * Obtiene los datos de un usuario
     * @param {Object} dataParams - Datos para identificar al usuario
     * @returns {Object} Datos del usuario y código de estado
     */
    async getUser(dataParams) {
        const { email, database } = dataParams;
        const connection = await this.createDbConnection(database);
        try {
            return await this.executeQuery(connection, `SELECT id_user, name_user, token_user, rol_user, password_user, email_user, status_user, attempts_user, passRecovery_user FROM users WHERE email_user=?`, [email]);
        } finally {
            await connection.end(); // Asegura que la conexión se cierre
        }
    },

    /**
     * Actualiza el token de un usuario
     * @param {Object} dataParams - Datos del usuario a actualizar
     * @returns {Object} Resultado de la actualización y código de estado
     */
    async updateTokenUser(dataParams) {
        const { email, database } = dataParams;
        const connection = await this.createDbConnection(database);
        try {
            const token = await this.generatedToken(dataParams);
            return await this.executeQuery(connection, `UPDATE users SET token_user=? WHERE email_user=?`, [token, email]);
        } finally {
            await connection.end(); // Asegura que la conexión se cierre
        }
    },

    /**
     * Inicia sesión de usuario
     * @param {Object} dataParams - Credenciales del usuario
     * @returns {Object} Resultado del inicio de sesión y código de estado
     */
    async startSession(dataParams) {
        const { password, database } = dataParams;
        const connection = await this.createDbConnection(database);
        try {
            const getUser = await this.getUser(dataParams);

            if (getUser.statusCode !== 200) {
                return { statusCode: 210, data: "No se encontró al usuario" };
            }

            const { password_user } = getUser.data[0];
            const passwordMatch = await bcrypt.compare(password, password_user);

            if (!passwordMatch) {
                return { statusCode: 401, data: { message: "Credenciales incorrectas." } };
            }

            await this.updateTokenUser(dataParams);
            const updatedUser = await this.getUser(dataParams);
            return { statusCode: 200, data: updatedUser.data[0] };
        } finally {
            await connection.end(); // Asegura que la conexión se cierre
        }
    },

    /**
     * Valida un token JWT
     * @param {string} token_user - Token a validar
     * @returns {Object} Resultado de la validación y código de estado
     */
    async validateToken(token_user) {
        try {
            const decoded = jwt.verify(token_user, config.jwtSecret);

            if (decoded.exp * 1000 < Date.now()) {
                throw new jwt.TokenExpiredError("El token ha expirado", new Date(decoded.exp * 1000));
            }

            return { statusCode: 200, data: "El token es válido para usar aún" };
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                return { statusCode: 401, data: "El token ha expirado" };
            } else if (error instanceof jwt.JsonWebTokenError) {
                return { statusCode: 400, data: "El token no es válido" };
            } else {
                return { statusCode: 500, data: error.message };
            }
        }
    },
};







module.exports = authenticated; // Exporta el objeto para su uso en otros módulos
