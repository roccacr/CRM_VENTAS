const templatePassword = (data) => {
    return `
     <!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bienvenido a ROCCA CRM VENTAS</title>
<style>
    body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        color: #333;
        line-height: 1.6;
        padding: 20px;
    }
    .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        padding: 20px;
    }
    .header {
        background-color: #000;
        color: #fff;
        text-align: center;
        padding: 10px;
        border-radius: 8px 8px 0 0;
    }
    .content {
        padding: 20px;
    }
    .footer {
        font-size: 12px;
        color: #777;
        text-align: center;
        margin-top: 20px;
    }
    .button-container {
        text-align: center;
        margin-top: 20px;
    }
    .button {
        display: inline-block;
        background-color: #000;
        color: #fff;
        padding: 10px 20px;
        text-decoration: none;
        border-radius: 5px;
    }
    .button:hover {
        background-color: #333;
    }
</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Bienvenido a ROCCA CRM VENTAS</h2>
        </div>
        <div class="content">
            <p>Estimado(a) <strong>${data.name}</strong>,</p>
            <p>Nos complace informarle que se ha creado un usuario para usted en el sistema de <strong>CRM VENTAS</strong>. A continuación, encontrará sus credenciales de acceso:</p>
            <p>
                <strong>Usuario:</strong> ${data.email}<br>
                <strong>Contraseña:</strong> ${data.password}
            </p>
            <div class="button-container">
                <a href="https://crmtest.roccacr.com" class="button">Acceder a CRM VENTAS</a>
            </div>
            <p><strong>Importante:</strong></p>
            <ul>
                <li>No comparta su contraseña con nadie.</li>
                <li>Cambie su contraseña al iniciar sesión por primera vez.</li>
                <li>Si no inicia sesión en las próximas 24 horas, su usuario será bloqueado automáticamente.</li>
            </ul>
        </div>
        <div class="footer">
            <p>Este es un correo automático, por favor no responda ni comparta esta información.</p>
            <p>&copy; 2024 ROCCA CRM VENTAS. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
    `;
};

module.exports = { templatePassword };
