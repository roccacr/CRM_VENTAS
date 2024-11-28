export const limpiarCampos = (newValue) => {
    // Remover caracteres no deseados usando regex
    const cleanedValue = newValue.replace(/[^0-9.,-]/g, "");
    return cleanedValue;
};
