export const columns = [
    {
        title: "ID",
        data: "id",
    },
    {
        title: "Nombre",
        data: "name",
    },
    {
        title: "Email",
        data: "email",
    },
    {
        title: "Teléfono",
        data: "phone",
    },
    {
        title: "Empresa",
        data: "company",
    },
    {
        title: "Estado",
        data: "status",
    },
    {
        title: "Último Contacto",
        data: "lastContact",
    },
    {
        title: "ACCIÓN",
        data: null,
        render: function (data, type, row) {
            // El color del botón y el icono cambian según el valor de la columna "status"
            const buttonClass = row.status === "Active" ? "success" : "danger";
            // El icono cambia según el valor de la columna "status"
            const iconClass = row.status === "Active" ? "check" : "x";

            // El botón muestra un alert con el ID del registro seleccionado
            return `
            <button class="btn avtar avtar-xs btn-light-${buttonClass}" data-id="${row.id}">
                <i class="ti ti-${iconClass}"></i>
            </button>`;
        },
        // La columna "Actions" no es ordenable
        orderable: false,
    },
];
