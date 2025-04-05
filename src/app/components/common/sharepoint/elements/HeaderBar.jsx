import { Paper, Typography } from "@mui/material";
import { Stack } from "@mui/system";
import React from "react";

const HeaderBarElement = ({ userName, folderName = "No encontrada" }) => {
   return (
      <Paper
         elevation={0}
         sx={{
            width: "100%",
            height: "auto",
            padding: "16px",
            margin: 0,
            bgcolor: "#FFFFFF",
            borderBottom: "1px solid #E5E5E5",
         }}
      >
         <Stack direction={"row"} justifyContent={"space-between"} alignItems={"center"} spacing={2} sx={{ width: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="center">
               <Typography
                  variant={"h6"}
                  sx={{
                     color: "#000000",
                     fontSize: "16px",
                     fontWeight: 400,
                  }}
               >
                  Integración NetSuite - OneDrive Carpeta:
               </Typography>
               <Typography
                  variant="h6"
                  sx={{
                     color: folderName === "No encontrada" ? "#FF0000" : "#000000",
                     fontSize: "16px",
                     fontWeight: folderName === "No encontrada" ? 600 : 400,
                     backgroundColor: folderName === "No encontrada" ? "#FFE5E5" : "transparent",
                     padding: folderName === "No encontrada" ? "2px 8px" : "0",
                     borderRadius: "4px",
                  }}
               >
                  {folderName === "No encontrada" ? "No se encontró la carpeta" : folderName}
               </Typography>
            </Stack>
            <Typography
               variant={"body1"}
               sx={{
                  color: "#000000",
                  fontSize: "14px",
               }}
            >
               {userName}
            </Typography>
         </Stack>
      </Paper>
   );
};

export default HeaderBarElement;
