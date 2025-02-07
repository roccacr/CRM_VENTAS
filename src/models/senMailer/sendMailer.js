const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();
const { templatePassword } = require("./templates/templatePassword");
const { templatePasswordRecover } = require("./templates/templatePasswordRecover");

const API_NOTIFICATION_EMAIL = process.env.API_NOTIFICATION_EMAIL;
const API_SECURITY_PREFIX = process.env.API_SECURITY_PREFIX;
const FROM_NAME = "ROCCA CRM";

if (!API_NOTIFICATION_EMAIL || !API_SECURITY_PREFIX) {
    throw new Error("Las variables de entorno API_NOTIFICATION_EMAIL o API_SECURITY_PREFIX no están configuradas.");
}

const sendMailer = {};

sendMailer.toolMail = async (data, type, subjects ) => {
    try {
        // Crear la plantilla de correo
        const templateMail = type === "templatePassword" ? templatePassword(data) : type === "templatePasswordRecover" ?  templatePasswordRecover(data) : null;
        const subject = subjects;
        const recipientEmail = data?.email;

        if (!recipientEmail) {
            throw new Error("El correo del destinatario no está proporcionado en 'data.email'.");
        }

        // Configurar transporte de correo
        const transporter = nodemailer.createTransport({
            host: "smtp.office365.com",
            port: 587,
            secure: false,
            auth: {
                user: API_NOTIFICATION_EMAIL,
                pass: API_SECURITY_PREFIX,
            },
        });

        // Configurar opciones del correo
        const mailOptions = {
            from: `"${FROM_NAME}" <${API_NOTIFICATION_EMAIL}>`,
            to: data?.email,
            subject: subject,
            html: templateMail,
        };

        // Enviar correo
        await transporter.sendMail(mailOptions);
        return "ok";
    } catch (error) {
        console.error("Error al enviar correo:", error.message);
        return 'error';
    }
};

module.exports = sendMailer;
