import PropTypes from "prop-types";
import { Button, CircularProgress } from "@mui/material";

PrimaryButton.propTypes = {
	title: PropTypes.string,
	logo: PropTypes.string,
	buttonStyles: PropTypes.object,
	variant: PropTypes.string,
	onClick: PropTypes.func,
};

export function PrimaryButton({
	title,
	logo,
	buttonStyles,
	variant,
	onClick = () => {},
	disabled = false,
	loading = false,
	...rest
}) {
	return (
		<Button
			variant={variant}
			style={buttonStyles}
			startIcon={logo}
			onClick={onClick}
			disabled={disabled}
			{...rest}
		>
			{loading ? <CircularProgress size={20} /> : title}
		</Button>
	);
}