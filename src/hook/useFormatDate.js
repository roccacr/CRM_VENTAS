// La función formatDate que formatea la fecha y hora
export const formatDate = (dateString) => {
 

    const date = new Date(dateString);

    // Convertir la fecha a la zona horaria de Costa Rica (UTC-6) usando toLocaleString
    const options = { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true };
    const localDateString = date.toLocaleString("en-US", options);

    // Extraer partes de la fecha formateada
    const [month, day, year, time] = localDateString.match(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2} [AP]M)/).slice(1);

    // Formato de la fecha
    const formattedDate = `${year}-${month}-${day}`;

    // Formato de la hora (ya incluye AM/PM)
    const formattedTime = "";



    // Retornar ambos valores por separado
    return { formattedDate, formattedTime };
};
