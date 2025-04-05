// utils/microsoft.js
import {
	Client,
	FileUpload,
	LargeFileUploadTask,
} from "@microsoft/microsoft-graph-client";
import { initializeMSAL, msalInstance } from "@/config/msalConfig";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

const groupId = "46b0a57a-45ab-4534-8dde-cd4ba39e29b7";

export async function getMSALToken(microsoftUser) {
	if (!microsoftUser) {
		throw new Error(
			"Usuario no autenticado. Por favor, cierre sesión y vuelva a iniciar sesión."
		);
	}

	await initializeMSAL();

	try {
		let account = sessionStorage.getItem("msalAccount");
		
		// Si no hay cuenta en sesión, guardamos el username
		if (!account) {
			sessionStorage.setItem("msalAccount", microsoftUser.email);
			account = microsoftUser.email;
		}

		const silentRequest = {
			scopes: ["User.Read", "Files.Read"],
			account: msalInstance.getAccountByUsername(account)
		};

		try {
			const silentResult = await msalInstance.acquireTokenSilent(silentRequest);
			return silentResult.accessToken;
		} catch (silentError) {
			if (silentError instanceof InteractionRequiredAuthError) {
				const interactiveResult = await msalInstance.acquireTokenPopup(silentRequest);
				return interactiveResult.accessToken;
			} else {
				throw silentError;
			}
		}
	} catch (error) {
		console.error("Error en autenticación:", error);
		throw new Error("Error al obtener el token de acceso. Por favor, inicie sesión nuevamente.");
	}
}

export async function getUserDetailsGraph(accessToken) {
	const client = Client.init({
		authProvider: (done) => {
			done(null, accessToken);
		},
	});

	try {
		const userDetails = await client.api("/me").get();
		return userDetails;
	} catch (error) {
		console.error("Error al obtener los detalles del usuario: ", error);
		throw error;
	}
}

export async function getFolderFromGraph(
	accessToken,
	recordFolderId,
	folderId
) {

	
	const client = Client.init({
		authProvider: (done) => {
			done(null, accessToken);
		},
	});


	try {
		const folder = await client
			.api(`/groups/${groupId}/drive/items/01QPXOKICVOQPUSDN67VH3WHUUBQOWY7KQ/children`)
			.select("id,name,folder,package")
			.filter(`name eq '${folderId}'`)
			.get();

		if (folder.value.length > 0) {
			return folder.value[0];
		} else {
			return null;
		}
	} catch (error) {
		console.error("Error al obtener la carpeta: ", error);
		throw error;
	}
}

export async function getFilesFromGraph(accessToken, folderId) {
	const client = Client.init({
		authProvider: (done) => {
			done(null, accessToken);
		},
	});

	try {
		const files = await client
			.api(`/groups/${groupId}/drive/items/${folderId}/children`)
			.select("id,name,size,fileSystemInfo,folder,package")
			.get();

		return files.value;
	} catch (error) {
		console.error("Error al obtener los archivos: ", error);
		throw error;
	}
}

export async function downloadFile(fileId, microsoftUser) {
	const accessToken = await getMSALToken(microsoftUser);

	const client = Client.init({
		authProvider: (done) => {
			done(null, accessToken);
		},
	});

	try {
		const file = await client
			.api(`/groups/${groupId}/drive/items/${fileId}`)
			.select("@microsoft.graph.downloadUrl")
			.get();

		const downloadUrl = file["@microsoft.graph.downloadUrl"];
		//Abriendo el archivo en ventana nueva
		window.open(downloadUrl, "_self");

		return file;
	} catch (error) {
		console.error("Error al descargar el archivo: ", error);
		throw error;
	}
}

export async function uploadFile(
	file,
	action = "create",
	folderId,
	microsoftUser
) {
	const accessToken = await getMSALToken(microsoftUser);

	const client = Client.init({
		authProvider: (done) => {
			done(null, accessToken);
		},
	});

	try {
		// Limpiar el nombre del archivo
		const nombreArchivo = file.name.replace(/[\/\\:*?"<>|#%]/g, "");
		// URL de la API de Graph para subir archivos
		const apiUrl = `/groups/${groupId}/drive/items/${folderId}:/${nombreArchivo}://createUploadSession`;

		// Configuración para la carga de archivos grandes
		const options = { rangeSize: 1024 * 1024 }; // Tamaño de los fragmentos (1MB)
		const payload = {
			item: { "@microsoft.graph.conflictBehavior": action }, // Acción para manejar conflictos (e.g., renombrar, sobrescribir)
		};
		// Crear un objeto de archivo
		const fileObject = new FileUpload(file, nombreArchivo, file.size);

		// Crear la sesión de carga
		const uploadSession = await LargeFileUploadTask.createUploadSession(
			client,
			apiUrl,
			payload
		);

		// Crear una tarea de carga de archivos grandes
		const task = new LargeFileUploadTask(
			client,
			fileObject,
			uploadSession,
			options
		);

		// Ejecutar la tarea de carga
		const uploadResult = await task.upload();

		return uploadResult;
	} catch (error) {
		console.error("Error al subir el archivo: ", error);
		throw error;
	}
}

export async function previewFile(fileId, microsoftUser) {
	const accessToken = await getMSALToken(microsoftUser);

	const client = Client.init({
		authProvider: (done) => {
			done(null, accessToken);
		},
	});

	try {
		const file = await client
			.api(`/groups/${groupId}/drive/items/${fileId}/preview`)
			.select("@microsoft.graph.getUrl")
			.post();

		const previewLink = file["getUrl"];
		//Abriendo el archivo en ventana nueva
		window.open(previewLink, "_blank");

		return file;
	} catch (error) {
		console.error("Error al obtener la vista previa del archivo: ", error);
		throw error;
	}
}

export async function createFolderGraph(rootFolder, microsoftUser, folderName) {
	const accessToken = await getMSALToken(microsoftUser);

	const client = Client.init({
		authProvider: (done) => {
			done(null, accessToken);
		},
	});

	try {
		let options = {
			name: folderName,
			folder: {},
			"@microsoft.graph.conflictBehavior": "rename",
		};

		const folder = await client
			.api(`/groups/${groupId}/drive/items/${rootFolder}/children`)
			.post(options);

		return folder;
	} catch (error) {
		console.error("Error al crear la carpeta: ", error);
		throw error;
	}
}

const searchParams = new URLSearchParams(location.search);
const dataValue = searchParams.get('data');
