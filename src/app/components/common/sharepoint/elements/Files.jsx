import { IconButton, Paper, Typography } from "@mui/material";
import { Stack } from "@mui/system";
import React from "react";
import PreviewIcon from "@mui/icons-material/Preview";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import LoadingComponent from "../../loading/Loading";
import { downloadFile, previewFile } from "@/utils/microsoft";
import { useSelector } from "react-redux";

const FilesElement = ({ files, loading }) => {
	const { microsoftUser } = useSelector((state) => state.auth); 
	if (loading) {
		return (
			<Stack direction={"column"} spacing={2}>
				<LoadingComponent />
			</Stack>
		);
	}

	return (
		<Stack
			direction={"column"}
			spacing={2}
			sx={{
				minWidth: "70%",
				width: "70%",
				padding: "20px",
				height: "300px",
				overflowY: "auto",
			}}
		>
			<Paper key={"title"} elevation={3}>
				<Stack
					direction={"row"}
					spacing={2}
					justifyContent={"space-between"}
					alignItems={"center"}
					sx={{
						padding: "0 10px",
					}}
				>
					<Stack
						direction={"row"}
						width={"88%"}
						alignItems={"center"}
					>
						{/* Si el nombre es muy largo debemos hacer wrap de la información */}
						<Typography
							variant={"body1"}
							sx={{
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								width: "100%",
							}}
						>
							Nombre de Archivo
						</Typography>
						<Typography variant={"body1"}>Tamaño</Typography>
					</Stack>
					<Stack
						direction={"row"}
						width={"12%"}
						justifyContent={"space-between"}
					>
						<Typography variant={"body1"}>Ver</Typography>
						<Typography variant={"body1"}>Descargar</Typography>
					</Stack>
				</Stack>
			</Paper>
			{files.map((file) => {
				return (
					<Paper key={file.id} elevation={3}>
						<Stack
							direction={"row"}
							spacing={2}
							justifyContent={"space-between"}
							alignItems={"center"}
							sx={{
								padding: "0 10px",
							}}
						>
							<Stack
								direction={"row"}
								width={"88%"}
								alignItems={"center"}
							>
								{/* Si el nombre es muy largo debemos hacer wrap de la información */}
								<Typography
									variant={"body1"}
									sx={{
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										width: "100%",
									}}
								>
									{file.name}
								</Typography>
								<Typography variant={"body1"}>
									{file.size}
								</Typography>
							</Stack>
							<Stack
								direction={"row"}
								width={"12%"}
								justifyContent={"space-between"}
								paddingRight={"15px"}
							>
								<IconButton
									aria-label="preview"
									color="primary"
								>
									<PreviewIcon
										onClick={() => {
											previewFile(file.id, microsoftUser);
										}}
									/>
								</IconButton>
								<IconButton
									aria-label="download"
									color="primary"
								>
									<FileDownloadIcon
										onClick={() => {
											downloadFile(
												file.id,
												microsoftUser
											);
										}}
									/>
								</IconButton>
							</Stack>
						</Stack>
					</Paper>
				);
			})}
		</Stack>
	);
};

export default FilesElement;
