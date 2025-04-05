import {
	CircularProgress,
	List,
	ListItem,
	ListItemText,
	Stack,
	Typography,
} from "@mui/material";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import styles from "./uploader.module.css";
import CustomConfirmDialogComponent from "../../dialogs/CustomConfirmDialog";
import { useSelector } from "react-redux";
import { uploadFile } from "@/app/Utils/microsoft";

const UploaderElement = ({ filderId, currentFiles, fetchFiles, setError }) => {
	const { microsoftUser } = useSelector((state) => state.auth); 
	const filesToUploadRef = useRef([]);
	const [dialogState, setDialogState] = useState({
		open: false,
		title: "",
		message: "",
		confirmButtonText: "",
		onConfirm: () => {},
		cancelButtonText: "",
		onCancel: () => {},
	});

	const handleFilesDropped = (acceptedFiles) => {
		const filesWithStatus = acceptedFiles.map((file) => ({
			file,
			loading: false,
		}));
		filesToUploadRef.current.push(...filesWithStatus);
		processFilesToUpload(); // Procesar los archivos después de añadirlos
	};

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: handleFilesDropped,
	});

	const validateDuplicate = (fileName, existingFiles) => {
		return new Promise((resolve) => {
			if (existingFiles.some((file) => file.name === fileName)) {
				setDialogState({
					open: true,
					title: "Archivo Duplicado",
					message: `El archivo ${fileName} ya existe. ¿Cómo desea proceder?`,
					confirmButtonText: "Reemplazar",
					cancelButtonText: "Renombrar",
					onConfirm: () => resolve("replace"),
					onCancel: () => resolve("rename"),
				});
			} else {
				resolve("rename");
			}
		});
	};

	const processFilesToUpload = async () => {
		while (filesToUploadRef.current.length > 0) {
			// Extraer el primer archivo de la lista
			const fileObj = filesToUploadRef.current.shift();
			try {
				fileObj.loading = true;

				/*Esperamos 10 segundos y quitamos el archivo de la lista de carga, modificando el ref para que quede limpio*/
				await new Promise((resolve) => setTimeout(resolve, 10000));
				filesToUploadRef.current = filesToUploadRef.current.filter(
					(file) => file !== fileObj
				);

				return;

				// const action = await validateDuplicate(
				// 	fileObj.file.name,
				// 	files
				// );

				// await uploadFile(
				// 	fileObj.file,
				// 	action,
				// 	folder.id,
				// 	microsoftUser
				// );

				// await fetchFiles();
			} catch (error) {
				console.error("Error al cargar archivo:", error);
				setError({
					errorMessage: "Error al cargar archivo",
					errorDetails: "Por favor, intente de nuevo más tarde.",
				});
			}
		}
	};

	// Renderiza la lista de archivos pendientes de carga
	const renderPendingFiles = () => {
		return (
			<List>
				{filesToUploadRef.current.map((fileObj, index) => (
					<ListItem key={index}>
						<ListItemText primary={fileObj.file.name} />
						{fileObj.loading && <CircularProgress size={20} />}
					</ListItem>
				))}
			</List>
		);
	};

	return (
		<Stack
			direction={"row"}
			spacing={2}
			alignItems={"center"}
			sx={{
				width: "30%",
				minHeight: "300px",
				backgroundColor: "rgba(0, 0, 0, 0.04)",
				padding: "10px",
			}}
		>
			{
				// Si hay archivos pendientes de carga, se muestra un mensaje
				// y la lista de archivos
				filesToUploadRef.current.length > 0 ? (
					<Stack
						direction={"column"}
						rowGap={2}
						justifyContent={"center"}
						alignItems={"center"}
					>
						<Typography variant={"body1"}>
							Archivos pendientes de carga
						</Typography>
						{renderPendingFiles()}
					</Stack>
				) : (
					// Si no hay archivos pendientes de carga, se muestra un mensaje
					// y el área de arrastre
					<div
						component={"div"}
						{...getRootProps({
							className: `dropzone ${styles.block} ${
								isDragActive ? styles.blockActive : ""
							}`,
						})}
					>
						<input {...getInputProps()} />
						{isDragActive ? (
							<Stack
								direction={"column"}
								rowGap={2}
								justifyContent={"center"}
								alignItems={"center"}
								sx={{
									padding: "20px",
								}}
							>
								<DriveFileMoveIcon
									sx={{ fontSize: "4rem", color: "black" }}
								/>
								<Typography
									variant={"body1"}
									sx={{ color: "black" }}
								>
									Suelta los archivos aquí...
								</Typography>
							</Stack>
						) : (
							<Stack
								direction={"column"}
								rowGap={2}
								justifyContent={"center"}
								alignItems={"center"}
								sx={{
									padding: "20px",
								}}
							>
								<CloudUploadIcon
									sx={{
										fontSize: "4rem",
										color: "primary.main",
									}}
								/>
								<Typography variant={"body1"}>
									Arrastra y suelta los archivos aquí, o haz
									clic para seleccionarlos
								</Typography>
							</Stack>
						)}
					</div>
				)
			}

			<CustomConfirmDialogComponent
				dialogState={dialogState}
				setDialogState={setDialogState}
			/>
		</Stack>
	);
};

export default UploaderElement;
