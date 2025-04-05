import React, { useCallback, useEffect, useState } from "react";
import { getFilesFromGraph, getMSALToken, uploadFile } from "@/app/Utils/microsoft";
import { Box, Paper, Stack, Typography } from "@mui/material";
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
			<Box sx={{ p: 3, bgcolor: "#F8F9FA" }}>
				<LoadingComponent />
			</Box>
		);
	}

	if (error) {
		return (
			<Box sx={{ p: 3, bgcolor: "#F8F9FA" }}>
				<ErrorComponent
					errorMessage={error.errorMessage || "Error inesperado"}
					errorDetails={
						error.errorDetails || "Intente de nuevo más tarde"
					}
				/>
			</Box>
		);
	}

	return (
		<Box
			sx={{
				width: "100%",
				minHeight: "calc(100vh - 200px)",
				bgcolor: "#F8F9FA",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<Box
				sx={{
					width: "100%",
					bgcolor: "#F8F9FA",
					p: 3,
					display: "flex",
					flexDirection: "column",
					gap: 2,
				}}
			>
				<Paper
					elevation={0}
					sx={{
						width: "100%",
						bgcolor: "#FFFFFF",
						borderRadius: 1,
						border: "1px solid #E5E5E5",
						p: 3,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						minHeight: "200px",
					}}
				>
					<UploaderElement
						folderId={folder.id}
						currentFiles={files.map((file) => file.name)}
						fetchFiles={fetchFiles}
						setError={setError}
					/>
				</Paper>

				<Paper
					elevation={0}
					sx={{
						width: "100%",
						bgcolor: "#FFFFFF",
						borderRadius: 1,
						border: "1px solid #E5E5E5",
						overflow: "hidden",
					}}
				>
					<Box
						sx={{
							width: "100%",
							p: 2,
							borderBottom: "1px solid #E5E5E5",
							bgcolor: "#FFFFFF",
						}}
					>
						<Typography
							variant="subtitle2"
							sx={{
								color: "#666",
								fontSize: "14px",
								fontWeight: 500,
							}}
						>
							Archivos
						</Typography>
					</Box>
					<Box sx={{ width: "100%" }}>
						<FilesElement files={files} loading={loadingElement} />
					</Box>
				</Paper>
			</Box>
		</Box>
	);
};

export default FolderElement;
