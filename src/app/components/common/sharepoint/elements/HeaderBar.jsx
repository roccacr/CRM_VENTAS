import { Paper, Typography } from "@mui/material";
import { Stack } from "@mui/system";
import React from "react";

const HeaderBarElement = ({ userName, folderName = "No encontrada" }) => {
	return (
		<Paper
			sx={{
				width: "100%",
				height: "50px",
				padding: "0 20px",
				margin: 0,
				display: "flex",
				flexDirection: "row",
				justifyContent: "space-between",
				alignItems: "center",
			}}
		>
			<Stack
				direction={"row"}
				justifyContent={"space-between"}
				alignItems={"center"}
				sx={{
					width: "30%",
					height: "50px",
					bgcolor: "primary.main",
				}}
			>
				<Typography variant={"body1"}>
					Integración NetSuite - OneDrive
				</Typography>
				<Typography variant={"body1"}>Carpeta: {folderName}</Typography>
			</Stack>
			<Typography variant={"body1"}>{userName}</Typography>
		</Paper>
	);
};

export default HeaderBarElement;
