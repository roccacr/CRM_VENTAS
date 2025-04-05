import { Stack, Typography } from "@mui/material";
import React from "react";
import { PrimaryButton } from "../buttons/PrimaryButton";

const NotFoundActionComponent = ({
	notFoundMessage = "No se han encontrado resultados",
	actionMessage = "Intente con otra búsqueda",
	actionTitle = "Crear carpeta",
	action = () => {},
}) => {
	return (
		<Stack
			direction={"row"}
			rowGap={1}
			justifyContent={"center"}
			alignItems={"center"}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src="/404NotFound.png"
				alt="Not Found"
				style={{ width: "350px" }}
			/>
			<Stack direction={"column"} spacing={2}>
				<Typography variant="h6" align="center">
					{notFoundMessage}
				</Typography>
				<Typography variant="body1" align="center">
					{actionMessage}
				</Typography>
				<PrimaryButton
					variant={"contained"}
					title={actionTitle}
					onClick={action}
				/>
			</Stack>
		</Stack>
	);
};

export default NotFoundActionComponent;