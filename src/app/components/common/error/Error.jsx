import { Stack, Typography } from "@mui/material";
import React from "react";

const ErrorComponent = ({
	errorMessage = "Se ha presentado un error inesperado",
	errorDetails = "Por favor, intente de nuevo más tarde",
}) => {
	return (
		<Stack
			direction={"column"}
			rowGap={1}
			justifyContent={"center"}
			alignItems={"center"}
		>
			<Typography variant="h6" align="center">
				{errorMessage}
			</Typography>
			<img src="/Error.png" alt="Error" style={{ width: "350px" }} />
			<Typography variant="body1" align="center">
				{errorDetails}
			</Typography>
		</Stack>
	);
};

export default ErrorComponent;
