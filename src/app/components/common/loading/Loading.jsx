import { Stack, Typography } from "@mui/material";
import React from "react";
import styles from "./loading.module.css";

const LoadingComponent = ({ loadingMessage = "Cargando información..." }) => {
	return (
		<Stack
			direction={"column"}
			rowGap={3}
			justifyContent={"center"}
			alignItems={"center"}
			sx={{
				marginTop: "20px",
			}}
		>
			<Stack direction={"column"} className={styles.loadingContainer}>
				<Stack direction={"row"} className={styles.loadingText}>
					<span>C</span>
					<span>A</span>
					<span>R</span>
					<span>G</span>
					<span>A</span>
					<span>N</span>
					<span>D</span>
					<span>O</span>
				</Stack>
			</Stack>

			<Typography variant="h6" align="center">
				{loadingMessage}
			</Typography>
		</Stack>
	);
};

export default LoadingComponent;
