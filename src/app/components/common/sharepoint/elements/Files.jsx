import { IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { Box } from "@mui/system";
import React from "react";
import PreviewIcon from "@mui/icons-material/Preview";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import LoadingComponent from "../../loading/Loading";
import { downloadFile, previewFile } from "@/app/Utils/microsoft";
import { useSelector } from "react-redux";

const FilesElement = ({ files, loading }) => {
	const { microsoftUser } = useSelector((state) => state.auth); 
	
	if (loading) {
		return (
			<Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
				<LoadingComponent />
			</Box>
		);
	}

	return (
		<TableContainer>
			<Table sx={{ minWidth: 650 }} aria-label="files table">
				<TableHead>
					<TableRow>
						<TableCell 
							sx={{ 
								color: "#666",
								fontSize: "14px",
								fontWeight: 500,
								borderBottom: "1px solid #E5E5E5",
							}}
						>
							Nombre
						</TableCell>
						<TableCell 
							align="right"
							sx={{ 
								color: "#666",
								fontSize: "14px",
								fontWeight: 500,
								borderBottom: "1px solid #E5E5E5",
								width: "100px"
							}}
						>
							Tamaño
						</TableCell>
						<TableCell 
							align="right"
							sx={{ 
								color: "#666",
								fontSize: "14px",
								fontWeight: 500,
								borderBottom: "1px solid #E5E5E5",
								width: "120px"
							}}
						>
							Acciones
						</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{files.map((file) => (
						<TableRow
							key={file.id}
							sx={{
								'&:hover': {
									bgcolor: '#F5F5F5',
								},
							}}
						>
							<TableCell
								component="th"
								scope="row"
								sx={{
									borderBottom: "1px solid #E5E5E5",
								}}
							>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
									<InsertDriveFileIcon sx={{ color: '#91A3B0', fontSize: 20 }} />
									<Typography
										sx={{
											fontSize: "14px",
											color: "#333",
										}}
									>
										{file.name}
									</Typography>
								</Box>
							</TableCell>
							<TableCell
								align="right"
								sx={{
									borderBottom: "1px solid #E5E5E5",
									color: "#666",
									fontSize: "14px",
								}}
							>
								{file.size}
							</TableCell>
							<TableCell
								align="right"
								sx={{
									borderBottom: "1px solid #E5E5E5",
								}}
							>
								<Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
									<IconButton
										size="small"
										onClick={() => previewFile(file.id, microsoftUser)}
										sx={{
											color: '#666',
											'&:hover': {
												color: '#0078D4',
												bgcolor: '#F0F0F0',
											},
										}}
									>
										<PreviewIcon fontSize="small" />
									</IconButton>
									<IconButton
										size="small"
										onClick={() => downloadFile(file.id, microsoftUser)}
										sx={{
											color: '#666',
											'&:hover': {
												color: '#0078D4',
												bgcolor: '#F0F0F0',
											},
										}}
									>
										<FileDownloadIcon fontSize="small" />
									</IconButton>
								</Box>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
};

export default FilesElement;
