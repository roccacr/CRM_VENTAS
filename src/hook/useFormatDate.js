// La función formatDate que formatea la fecha y hora
export const formatDate = (dateString) => {
    const date = new Date(dateString);

    // Ajustar la fecha a la zona horaria de Costa Rica (UTC-6)
    const localDate = new Date(date.getTime() - 6 * 60 * 60 * 1000);

    // Extraer año, mes y día
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");

    // Extraer horas, minutos y segundos, ajustando al formato de 12 horas
    let hours = localDate.getHours();
    const minutes = String(localDate.getMinutes()).padStart(2, "0");
    const seconds = String(localDate.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // Si la hora es '0', que sea '12'
    hours = String(hours).padStart(2, "0");

    // Formato de la fecha
    const formattedDate = `${year}-${month}-${day}`;

    // Formato de la hora
    const formattedTime = `${hours}:${minutes}:${seconds} ${ampm}`;

    // Retornar ambos valores por separado
    return { formattedDate, formattedTime };
};
