/**
 * @fileoverview Microsoft Graph API integration utilities
 * This module provides a set of utilities for interacting with Microsoft Graph API,
 * handling authentication, file operations, and folder management.
 */

import {
	Client,
	FileUpload,
	LargeFileUploadTask,
} from "@microsoft/microsoft-graph-client";
import { initializeMSAL, msalInstance } from "@/config/msalConfig";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

// Constants
const GROUP_ID = "46b0a57a-45ab-4534-8dde-cd4ba39e29b7";
const DEFAULT_SCOPES = ["User.Read", "Files.Read"];	
const CHUNK_SIZE = 1024 * 1024; // 1MB for file uploads

/**
 * Authentication Service class handling MSAL token operations
 */
class AuthenticationService {
	/**
	 * Obtains an authentication token for Microsoft Graph API
	 * @param {Object} microsoftUser - The Microsoft user object containing email
	 * @returns {Promise<string>} The access token
	 * @throws {Error} If authentication fails
	 */
	static async getMSALToken(microsoftUser) {
		if (!microsoftUser) {
			throw new Error(
				"Usuario no autenticado. Por favor, cierre sesión y vuelva a iniciar sesión."
			);
		}

		await initializeMSAL();

		try {
			// console.log("Iniciando proceso de autenticación para:", microsoftUser.email);
			// Obtener todas las cuentas
			const accounts = msalInstance.getAllAccounts();
		
			let account;

			// Si hay cuentas existentes, buscar la que coincide con el email
			if (accounts.length > 0) {
				account = accounts.find(acc => acc.username.toLowerCase() === microsoftUser.email.toLowerCase());
				//console.log("Cuenta encontrada:", account ? "Sí" : "No");
			}

			// Si no se encuentra la cuenta, forzar login
			if (!account) {
				//console.log("Iniciando login popup...");
				const loginResult = await msalInstance.loginPopup({
					scopes: DEFAULT_SCOPES,
					prompt: "select_account"
				});
				account = loginResult.account;
				//console.log("Login popup completado");
			}

			// Establecer la cuenta como activa
			msalInstance.setActiveAccount(account);
			//console.log("Cuenta activa establecida");

			// Intentar adquirir el token
			const silentRequest = {
				scopes: DEFAULT_SCOPES,
				account: account
			};

			try {
				///console.log("Intentando adquirir token silenciosamente...");
				const silentResult = await msalInstance.acquireTokenSilent(silentRequest);
				//console.log("Token adquirido silenciosamente");
				return silentResult.accessToken;
			} catch (silentError) {
				//console.log("Error en adquisición silenciosa:", silentError);
				if (silentError instanceof InteractionRequiredAuthError) {
					console.log("Intentando adquirir token con popup...");
					const interactiveResult = await msalInstance.acquireTokenPopup(silentRequest);
					console.log("Token adquirido con popup");
					return interactiveResult.accessToken;
				}
				throw silentError;
			}
		} catch (error) {
			//console.error("Error en autenticación:", error);
			throw new Error("Error al obtener el token de acceso. Por favor, inicie sesión nuevamente.");
		}
	}
}

/**
 * Graph Client Factory to create authenticated Microsoft Graph clients
 */
class GraphClientFactory {
	/**
	 * Creates a new Microsoft Graph client with the provided access token
	 * @param {string} accessToken - The access token for authentication
	 * @returns {Client} Authenticated Microsoft Graph client
	 */
	static createClient(accessToken) {
		return Client.init({
			authProvider: (done) => {
				done(null, accessToken);
			},
		});
	}
}

/**
 * User Service for handling Microsoft Graph user operations
 */
class UserService {
	/**
	 * Retrieves user details from Microsoft Graph
	 * @param {string} accessToken - The access token for authentication
	 * @returns {Promise<Object>} User details from Microsoft Graph
	 */
	static async getUserDetails(accessToken) {
		const client = GraphClientFactory.createClient(accessToken);
		try {
			return await client.api("/me").get();
		} catch (error) {
			//console.error("Error al obtener los detalles del usuario: ", error);
			throw error;
		}
	}
}

/**
 * File Service for handling Microsoft Graph file operations
 */
class FileService {
	/**
	 * Downloads a file from Microsoft Graph
	 * @param {string} fileId - The ID of the file to download
	 * @param {Object} microsoftUser - The Microsoft user object
	 * @returns {Promise<Object>} The file object with download URL
	 */
	static async downloadFile(fileId, microsoftUser) {
		const accessToken = await AuthenticationService.getMSALToken(microsoftUser);
		const client = GraphClientFactory.createClient(accessToken);

		try {
			const file = await client
				.api(`/groups/${GROUP_ID}/drive/items/${fileId}`)
				.select("@microsoft.graph.downloadUrl")
				.get();

			window.open(file["@microsoft.graph.downloadUrl"], "_self");
			return file;
		} catch (error) {
			//console.error("Error al descargar el archivo: ", error);
			throw error;
		}
	}

	/**
	 * Uploads a file to Microsoft Graph
	 * @param {File} file - The file to upload
	 * @param {string} action - The conflict behavior ('create' or 'replace')
	 * @param {string} folderId - The ID of the destination folder
	 * @param {Object} microsoftUser - The Microsoft user object
	 * @returns {Promise<Object>} The upload result
	 */
	static async uploadFile(file, action = "create", folderId, microsoftUser) {
		const accessToken = await AuthenticationService.getMSALToken(microsoftUser);
		const client = GraphClientFactory.createClient(accessToken);

		try {
			const cleanFileName = this._sanitizeFileName(file.name);
			const uploadSession = await this._createUploadSession(client, folderId, cleanFileName, action);
			const uploadTask = this._createUploadTask(client, file, cleanFileName, uploadSession);
			
			return await uploadTask.upload();
		} catch (error) {
			//console.error("Error al subir el archivo: ", error);
			throw error;
		}
	}

	/**
	 * Sanitizes a file name by removing invalid characters
	 * @private
	 */
	static _sanitizeFileName(fileName) {
		return fileName.replace(/[\/\\:*?"<>|#%]/g, "");
	}

	/**
	 * Creates an upload session for large file upload
	 * @private
	 */
	static async _createUploadSession(client, folderId, fileName, action) {
		const apiUrl = `/groups/${GROUP_ID}/drive/items/${folderId}:/${fileName}://createUploadSession`;
		const payload = {
			item: { "@microsoft.graph.conflictBehavior": action }
		};
		return await LargeFileUploadTask.createUploadSession(client, apiUrl, payload);
	}

	/**
	 * Creates a large file upload task
	 * @private
	 */
	static _createUploadTask(client, file, fileName, uploadSession) {
		const fileObject = new FileUpload(file, fileName, file.size);
		return new LargeFileUploadTask(
			client,
			fileObject,
			uploadSession,
			{ rangeSize: CHUNK_SIZE }
		);
	}

	/**
	 * Previews a file from Microsoft Graph
	 * @param {string} fileId - The ID of the file to preview
	 * @param {Object} microsoftUser - The Microsoft user object
	 * @returns {Promise<Object>} The file preview object
	 */
	static async previewFile(fileId, microsoftUser) {
		const accessToken = await AuthenticationService.getMSALToken(microsoftUser);
		const client = GraphClientFactory.createClient(accessToken);

		try {
			const file = await client
				.api(`/groups/${GROUP_ID}/drive/items/${fileId}/preview`)
				.select("@microsoft.graph.getUrl")
				.post();

			window.open(file["getUrl"], "_blank");
			return file;
		} catch (error) {
			//console.error("Error al obtener la vista previa del archivo: ", error);
			throw error;
		}
	}
}

/**
 * Folder Service for handling Microsoft Graph folder operations
 */
class FolderService {
	/**
	 * Gets a folder from Microsoft Graph
	 * @param {string} accessToken - The access token for authentication
	 * @param {string} recordFolderId - The record folder ID
	 * @param {string} folderId - The folder ID to get
	 * @returns {Promise<Object|null>} The folder object or null if not found
	 */
	static async getFolder(accessToken, recordFolderId, folderId) {
		const client = GraphClientFactory.createClient(accessToken);

		try {
			const folder = await client
				.api(`/groups/${GROUP_ID}/drive/items/${recordFolderId}/children`)
				.select("id,name,folder,package")
				.filter(`name eq '${folderId}'`)
				.get();

			return folder.value.length > 0 ? folder.value[0] : null;
		} catch (error) {
			//console.error("Error al obtener la carpeta: ", error);
			throw error;
		}
	}

	/**
	 * Gets files from a folder in Microsoft Graph
	 * @param {string} accessToken - The access token for authentication
	 * @param {string} folderId - The folder ID to get files from
	 * @returns {Promise<Array>} Array of file objects
	 */
	static async getFiles(accessToken, folderId) {
		const client = GraphClientFactory.createClient(accessToken);

		try {
			const files = await client
				.api(`/groups/${GROUP_ID}/drive/items/${folderId}/children`)
				.select("id,name,size,fileSystemInfo,folder,package")
				.get();

			return files.value;
		} catch (error) {
			//console.error("Error al obtener los archivos: ", error);
			throw error;
		}
	}

	/**
	 * Creates a new folder in Microsoft Graph
	 * @param {string} rootFolder - The parent folder ID
	 * @param {Object} microsoftUser - The Microsoft user object
	 * @param {string} folderName - The name for the new folder
	 * @returns {Promise<Object>} The created folder object
	 */
	static async createFolder(rootFolder, microsoftUser, folderName) {
		const accessToken = await AuthenticationService.getMSALToken(microsoftUser);
		const client = GraphClientFactory.createClient(accessToken);

		try {
			const options = {
				name: folderName,
				folder: {},
				"@microsoft.graph.conflictBehavior": "rename",
			};
			return await client
				.api(`/groups/${GROUP_ID}/drive/items/${rootFolder}/children`)
				.post(options);
		} catch (error) {
			//console.error("Error al crear la carpeta: ", error);
			throw error;
		}
	}
}

// Export service classes and their methods
export const MicrosoftGraphServices = {
	auth: AuthenticationService,
	user: UserService,
	file: FileService,
	folder: FolderService,
};

// Export individual functions for backward compatibility
export const getMSALToken = AuthenticationService.getMSALToken.bind(AuthenticationService);
export const getUserDetailsGraph = UserService.getUserDetails;
export const getFolderFromGraph = FolderService.getFolder;
export const getFilesFromGraph = FolderService.getFiles;
export const downloadFile = FileService.downloadFile.bind(FileService);
export const uploadFile = FileService.uploadFile.bind(FileService);
export const previewFile = FileService.previewFile.bind(FileService);
export const createFolderGraph = FolderService.createFolder.bind(FolderService);

const searchParams = new URLSearchParams(location.search);
const dataValue = searchParams.get('data');
