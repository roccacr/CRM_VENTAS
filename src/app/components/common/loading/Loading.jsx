import { Box, Stack, Typography } from "@mui/material";
import React from "react";
import CloudIcon from '@mui/icons-material/Cloud';

const LoadingComponent = ({ loadingMessage = "Sincronizando con OneDrive..." }) => {
	return (
		<Stack
			direction={"column"}
			spacing={3}
			justifyContent={"center"}
			alignItems={"center"}
			sx={{
				width: "100%",
				height: "100%",
				minHeight: "200px",
				position: "relative",
			}}
		>
			<Box
				sx={{
					position: "relative",
					animation: "float 3s ease-in-out infinite",
					"@keyframes float": {
						"0%, 100%": {
							transform: "translateY(0)",
						},
						"50%": {
							transform: "translateY(-10px)",
						},
					},
				}}
			>
				<CloudIcon
					sx={{
						fontSize: "80px",
						color: "#0078D4", // Color de OneDrive
						filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.2))",
					}}
				/>
				<Box
					sx={{
						position: "absolute",
						bottom: "-10px",
						left: "50%",
						transform: "translateX(-50%)",
						width: "80px",
						height: "4px",
						borderRadius: "50%",
						backgroundColor: "rgba(0,0,0,0.1)",
						animation: "shadow 3s ease-in-out infinite",
						"@keyframes shadow": {
							"0%, 100%": {
								transform: "translateX(-50%) scale(1)",
								opacity: 0.4,
							},
							"50%": {
								transform: "translateX(-50%) scale(0.8)",
								opacity: 0.2,
							},
						},
					}}
				/>
			</Box>

			<Box sx={{ position: "relative" }}>
				<Box
					sx={{
						width: "40px",
						height: "4px",
						borderRadius: "2px",
						backgroundColor: "#0078D4",
						position: "relative",
						overflow: "hidden",
						"&::after": {
							content: '""',
							position: "absolute",
							width: "50%",
							height: "100%",
							backgroundColor: "rgba(255,255,255,0.5)",
							animation: "loading 1.5s ease-in-out infinite",
						},
						"@keyframes loading": {
							"0%": {
								transform: "translateX(-100%)",
							},
							"100%": {
								transform: "translateX(200%)",
							},
						},
					}}
				/>
			</Box>

			<Typography
				variant="h6"
				sx={{
					color: "#666",
					fontWeight: 500,
					textAlign: "center",
					fontSize: "1rem",
					marginTop: 2,
				}}
			>
				{loadingMessage}
			</Typography>
		</Stack>
	);
};

export default LoadingComponent;
