import {
	Box,
	CircularProgress,
	List,
	ListItem,
	ListItemIcon,
	ListItemText,
	Paper,
	Typography,
} from "@mui/material";
import React, { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle"; // Ícono para indicar que la carga está completa
import styles from "./uploader.module.css";
import CustomConfirmDialogComponent from "../../dialogs/CustomConfirmDialog";
import { useSelector } from "react-redux";
import { uploadFile } from "@/app/Utils/microsoft";
import { useForm } from "react-hook-form";

const UploaderElement = ({ folderId, currentFiles, fetchFiles, setError }) => {
	const { microsoftUser } = useSelector((state) => state.auth); 	
	const { watch, setValue, reset } = useForm({
		defaultValues: {
			files: [],
			completeFiles: [],
		},
	});

	const filesToUpload = watch("files");
	const completeFiles = watch("completeFiles");

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
		setValue("files", [...filesToUpload, ...filesWithStatus]);
	};

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop: handleFilesDropped,
	});

	const validateDuplicate = (fileName) => {
		return new Promise((resolve) => {
			if (currentFiles.includes(fileName)) {
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

	const processFilesToUpload = useCallback(async () => {
		const completedFiles = [];
		if (filesToUpload.length === 0) {
			return;
		}

		for (let i = 0; i < filesToUpload.length; i++) {
			const fileObj = filesToUpload[i];
			try {
				const updatedFiles = [...filesToUpload];
				updatedFiles[i] = { ...updatedFiles[i], loading: true };
				setValue("files", updatedFiles);

				const duplicateAction = await validateDuplicate(
					fileObj.file.name
				);

				// Realizamos el proceso de carga del archivo
				const result = await uploadFile(
					fileObj.file,
					duplicateAction,
					folderId,
					microsoftUser
				);

				const completeFileObj = {
					file: fileObj.file,
					loading: false,
					complete: true,
				};

				completedFiles.push(completeFileObj);
				setValue("completeFiles", completedFiles);
			} catch (error) {
				console.error("Error al cargar archivo:", error);
				setError({
					errorMessage: "Error al cargar archivo",
					errorDetails: "Por favor, intente de nuevo más tarde.",
				});
			}
		}

		// Ejecutar fetchFiles al final de todo el proceso
		await fetchFiles(false);
		// Reseteamos los values a sus valores iniciales
		reset();
	}, [
		filesToUpload,
		completeFiles,
		setValue,
		fetchFiles,
		microsoftUser,
		folderId,
		setError,
	]);

	useEffect(() => {
		if (
			filesToUpload.length > 0 &&
			filesToUpload.every((file) => file.loading === false)
		) {
			processFilesToUpload();
		}
	}, [filesToUpload, processFilesToUpload]);

	// Renderiza la lista de archivos pendientes de carga
	const renderPendingFiles = () => {
		return (
			<List sx={{ width: "100%", mt: 2 }}>
				{filesToUpload.map((fileObj, index) => (
					<ListItem
						key={index}
						sx={{
							py: 1,
							px: 2,
							borderRadius: 1,
							mb: 1,
							bgcolor: "#F8F9FA",
						}}
					>
						<ListItemIcon>
							<InsertDriveFileIcon sx={{ color: "#91A3B0" }} />
						</ListItemIcon>
						<ListItemText
							primary={fileObj.file.name}
							sx={{
								"& .MuiTypography-root": {
									fontSize: "14px",
									color: "#333",
								},
							}}
						/>
						{completeFiles.some(
							(completeFile) =>
								completeFile.file.name === fileObj.file.name
						) ? (
							<CheckCircleIcon sx={{ color: "#0078D4" }} />
						) : (
							<CircularProgress
								size={20}
								thickness={4}
								sx={{ color: "#0078D4" }}
							/>
						)}
					</ListItem>
				))}
			</List>
		);
	};

	return (
		<React.Fragment>
			<Box
				sx={{
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
				}}
			>
				{filesToUpload.length > 0 ? (
					<Box
						sx={{
							width: "100%",
							p: 2,
						}}
					>
						<Typography
							variant="subtitle1"
							sx={{
								fontSize: "16px",
								fontWeight: 500,
								color: "#333",
								mb: 2,
							}}
						>
							Archivos pendientes
						</Typography>
						{renderPendingFiles()}
					</Box>
				) : (
					<Box
						{...getRootProps()}
						sx={{
							width: "100%",
							height: "100%",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							cursor: "pointer",
							transition: "all 0.2s ease",
							"&:hover": {
								bgcolor: "#F0F0F0",
							},
						}}
					>
						<input {...getInputProps()} />
						<CloudUploadIcon
							sx={{
								fontSize: 64,
								color: "#0078D4",
								mb: 2,
							}}
						/>
						<Typography
							variant="h6"
							sx={{
								color: "#333",
								fontSize: "16px",
								fontWeight: 500,
								textAlign: "center",
							}}
						>
							{isDragActive
								? "Suelta los archivos aquí"
								: "Arrastra y suelta los archivos aquí"}
						</Typography>
						<Typography
							variant="body2"
							sx={{
								color: "#666",
								fontSize: "14px",
								mt: 1,
								textAlign: "center",
							}}
						>
							o haz clic para seleccionar
						</Typography>
					</Box>
				)}
			</Box>
			<CustomConfirmDialogComponent
				open={dialogState.open}
				title={dialogState.title}
				message={dialogState.message}
				confirmButtonText={dialogState.confirmButtonText}
				cancelButtonText={dialogState.cancelButtonText}
				onConfirm={dialogState.onConfirm}
				onCancel={dialogState.onCancel}
			/>
		</React.Fragment>
	);
};

export default UploaderElement;
