// utils/accessControl.js

const recordFolderId = {
	purchaseRequest: "01QPXOKID232NUU3JJGJCJ7KJFXORO63IN",
	purchaseOrder: "01QPXOKIBZSTMKWLEAZFBZJIQRKWMGX6WL",
	itemReceipt: "01QPXOKIAFGZW7DTRXLNFKLQUR4MDD2NME",
	customer: "01QPXOKICVOQPUSDN67VH3WHUUBQOWY7KQ"  // ID de la carpeta de clientes
};

const matchRoute = (path, pattern) => {
	const regexPattern = new RegExp(
		"^" +
			pattern
				.replace(/:[^\s/]+/g, "([\\w-]+)") // Reemplaza :id por un grupo de captura
				.replace(/\//g, "\\/") + // Escapa las barras
			"$"
	);
	return regexPattern.test(path);
};

export const hasAccess = (user, roles, path, action) => {
	if (!user || !roles || !user.role_id) {
		return false;
	}

	const role = roles.find((role) => role.id === user.role_id);
	if (!role) {
		return false;
	}

	return role.routes.some((route) => {
		return (
			matchRoute(path, route.url_path) && route.actions.includes(action)
		);
	});
};

export const getFolderIdFromPathname = (pathname) => {
	const pathParts = pathname.split("/");
	const recordType = pathParts[2];

	return recordFolderId[recordType] || "Desconocido";
};

export const getRecordIdFromPathname = (pathname) => {
	// Si pathname es un string simple (solo el ID), retornarlo directamente
	if (!pathname || pathname.indexOf('/') === -1) {
		return pathname;
	}
	// Si es un path completo, extraer el ID
	const pathParts = pathname.split("/");
	return pathParts[3];
};
