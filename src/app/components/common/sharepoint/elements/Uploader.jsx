import {
	Box,
	CircularProgress,
	List,
	ListItem,
	ListItemText,
	Stack,
	Typography,
} from "@mui/material";
import React, { useState, useEffect, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import CheckCircleIcon from "@mui/icons-material/CheckCircle"; // Ícono para indicar que la carga está completa
import styles from "./uploader.module.css";
import CustomConfirmDialogComponent from "../../dialogs/CustomConfirmDialog";
import { useSelector } from "react-redux";
import { uploadFile } from "@/utils/microsoft";
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
			<List
				sx={{
					width: "100%",
					border: "1px solid rgba(100, 35, 185, 0.92)",
					padding: "5px 10px",
					overflowY: "auto",
				}}
			>
				{filesToUpload.map((fileObj, index) => (
					<ListItem
						key={index}
						sx={{
							border: "1px solid rgba(100, 135, 85, 0.12)",
							padding: "0",
							margin: "0",
						}}
					>
						<ListItemText
							primary={fileObj.file.name}
							sx={{
								textOverflow: "ellipsis",
								overflow: "hidden",
								whiteSpace: "nowrap",
								"& span": {
									fontSize: "14px",
								},
							}}
						/>
						{completeFiles.some(
							(completeFile) =>
								completeFile.file.name === fileObj.file.name
						) ? (
							<CheckCircleIcon sx={{ color: "green" }} />
						) : (
							<CircularProgress
								size={20}
								thickness={5}
								color={"primary"}
							/>
						)}
					</ListItem>
				))}
			</List>
		);
	};

	return (
		<React.Fragment>
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
				{filesToUpload.length > 0 ? (
					<Stack
						direction={"column"}
						rowGap={1}
						justifyContent={"center"}
						alignItems={"flex-start"}
						sx={{
							width: "100%",
							height: "100%",
							padding: "10px",

							border: "1px solid rgba(0, 135, 85, 0.12)",
						}}
					>
						<Typography
							variant={"body1"}
							style={{
								fontWeight: "bold",
								fontSize: "14px",
							}}
						>
							Archivos pendientes de carga
						</Typography>
						{renderPendingFiles()}
					</Stack>
				) : (
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
				)}
			</Stack>
			<CustomConfirmDialogComponent
				dialogState={dialogState}
				setDialogState={setDialogState}
			/>
		</React.Fragment>
	);
};

export default UploaderElement;
