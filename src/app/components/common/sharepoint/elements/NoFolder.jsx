import React from "react";
import { Box, Button, Typography } from "@mui/material";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import { createFolderGraph } from "@/app/Utils/microsoft";

const NoFolderElement = ({
	recordFolderId,
	recordId,
	microsoftUser,
	fetchData,
}) => {
	const handleCreateFolder = async () => {
		try {
			await createFolderGraph(recordFolderId, microsoftUser, recordId);
			await fetchData();
		} catch (error) {
			console.log("Error al crear carpeta: ", error);
		}
	};

	return (
		<Box
			sx={{
				width: "100%",
				height: "calc(100vh - 200px)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				bgcolor: "#F8F9FA",
				p: 3,
			}}
		>
			<CreateNewFolderIcon
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
					fontSize: "18px",
					fontWeight: 500,
					textAlign: "center",
					mb: 1,
				}}
			>
				No se ha encontrado la carpeta
			</Typography>
			<Typography
				variant="body1"
				sx={{
					color: "#666",
					fontSize: "14px",
					textAlign: "center",
					mb: 3,
				}}
			>
				Este registro no tiene una carpeta asociada en OneDrive
			</Typography>
			<Button
				variant="contained"
				startIcon={<CreateNewFolderIcon />}
				onClick={handleCreateFolder}
				sx={{
					bgcolor: "#0078D4",
					"&:hover": {
						bgcolor: "#106EBE",
					},
					textTransform: "none",
					px: 4,
				}}
			>
				Crear carpeta
			</Button>
		</Box>
	);
};

export default NoFolderElement;
