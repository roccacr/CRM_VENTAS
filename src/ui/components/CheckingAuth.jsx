import { CircularProgress, Grid } from "@mui/material";

export const CheckingAuth = () => {
    return (
        <Grid container spacing={0} direction="column" alignItems="center" justifyContent="center" sx={{ minHeight: "100vh", backgroundColor: "transparent", padding: 4 }}>
            <Grid container direction="row" justifyContent="center">
                <CircularProgress color="success" />
            </Grid>
        </Grid>
    );
};
