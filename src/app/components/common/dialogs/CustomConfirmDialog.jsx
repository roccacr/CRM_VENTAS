import {
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Typography,
} from "@mui/material";
import React from "react";

const defaultDialogState = {
	open: false,
	title: "",
	message: "",
	confirmButtonText: "Aceptar",
	onConfirm: () => {},
	cancelButtonText: "Cancelar",
	onCancel: () => {},
};

const CustomConfirmDialogComponent = ({ dialogState = defaultDialogState, setDialogState }) => {
	if (!setDialogState) {
		console.warn('CustomConfirmDialogComponent: setDialogState prop is required');
		return null;
	}

	const handleClose = () => {
		setDialogState({
			...defaultDialogState,
			open: false,
		});
	};

	// Asegurarse de que dialogState tenga todas las propiedades necesarias
	const safeDialogState = {
		...defaultDialogState,
		...dialogState,
	};

	return (
		<Dialog
			open={safeDialogState.open}
			onClose={handleClose}
			aria-labelledby="alert-dialog-title"
			aria-describedby="alert-dialog-description"
			sx={{
				"& .MuiDialog-paper": {
					borderRadius: "10px",
					padding: "20px",
				},
			}}
		>
			<DialogTitle id="alert-dialog-title">
				<Typography
					variant="body1"
					sx={{
						fontSize: "20px",
					}}
				>
					{safeDialogState.title}
				</Typography>
			</DialogTitle>
			<DialogContent>
				<Typography variant="body1">{safeDialogState.message}</Typography>
			</DialogContent>
			<DialogActions>
				<Button
					variant="contained"
					onClick={() => {
						safeDialogState.onConfirm();
						handleClose();
					}}
				>
					{safeDialogState.confirmButtonText}
				</Button>
				<Button
					variant="outlined"
					onClick={() => {
						safeDialogState.onCancel();
						handleClose();
					}}
				>
					{safeDialogState.cancelButtonText}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default CustomConfirmDialogComponent;