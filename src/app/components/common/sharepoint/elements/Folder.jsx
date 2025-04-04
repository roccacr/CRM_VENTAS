import React, { useCallback, useEffect, useState } from "react";
import { getFilesFromGraph, getMSALToken, uploadFile } from "@/utils/microsoft";
import { Stack, Typography } from "@mui/material";
import LoadingComponent from "../../loading/Loading";
import ErrorComponent from "../../error/Error";
import UploaderElement from "./Uploader";
import FilesElement from "./Files";

const FolderElement = ({ folder, microsoftUser }) => {
	const [files, setFiles] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [loadingElement, setLoadingElement] = useState(false);

	// Definir fetchFiles usando useCallback para evitar que se redefina en cada render
	const fetchFiles = useCallback(
		async (firstRender) => {
			try {
				firstRender === true
					? setLoading(true)
					: setLoadingElement(true);
				const token = await getMSALToken(microsoftUser);
				const files = await getFilesFromGraph(token, folder.id);
				setFiles(files);
			} catch (error) {
				console.log("Error al cargar archivos: ", error);
				setError({
					errorMessage: "Error al cargar archivos",
					errorDetails: "Por favor, intente de nuevo más tarde.",
				});
			} finally {
				firstRender === true
					? setLoading(false)
					: setLoadingElement(false);
			}
		},
		[microsoftUser, folder.id]
	);

	useEffect(() => {
		fetchFiles(true);
	}, [fetchFiles]);

	if (loading) {
		return (
			<Stack direction={"column"} spacing={2}>
				<LoadingComponent />
			</Stack>
		);
	}

	if (error) {
		return (
			<Stack direction={"column"} spacing={2}>
				<ErrorComponent
					errorMessage={error.errorMessage || "Error inesperado"}
					errorDetails={
						error.errorDetails || "Intente de nuevo más tarde"
					}
				/>
			</Stack>
		);
	}

	return (
		<Stack
			direction={"row"}
			spacing={2}
			sx={{
				width: "100%",
				minHeight: "300px",
				border: "1px solid rgba(255, 144, 33, 0.77)",
			}}
		>
			<UploaderElement
				folderId={folder.id}
				currentFiles={files.map((file) => file.name)}
				fetchFiles={fetchFiles}
				setError={setError}
			/>
			<FilesElement files={files} loading={loadingElement} />
		</Stack>
	);
};

export default FolderElement;
