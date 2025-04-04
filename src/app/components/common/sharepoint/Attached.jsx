import { getFolderFromGraph, getMSALToken, getUserDetailsGraph } from "@/utils/microsoft";
import { Stack } from "@mui/system";
import React, { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { usePathname } from "react-router-dom";
import { getFolderIdFromPathname, getRecordIdFromPathname } from "@/utils/accessControl";
import ErrorComponent from "../error/Error";
import HeaderBarElement from "./elements/HeaderBar";
import LoadingComponent from "../loading/Loading";
import NoFolderElement from "./elements/NoFolder";
import FolderElement from "./elements/Folder";

const Attached = () => {
   const { microsoftUser } = useSelector((state) => state.auth);	
   const pathname = usePathname();
   const recordFolderId = getFolderIdFromPathname(pathname);
   const recordId = getRecordIdFromPathname(pathname);

   const [error, setError] = useState(null);
   const [loading, setLoading] = useState(true);
   const [graphFolder, setGraphFolder] = useState({});
   const [userDetails, setUserDetails] = useState({});

   const fetchData = useCallback(async () => {
      if (!microsoftUser) {
         setError({
            errorMessage: "Usuario no autenticado",
            errorDetails: "Por favor, cierre sesión e inicie sesión nuevamente.",
         });
         setLoading(false);
         return;
      }

      try {
         setLoading(true);
         const token = await getMSALToken(microsoftUser);
         const userDetails = await getUserDetailsGraph(token);
         const folder = await getFolderFromGraph(token, recordFolderId, recordId);

         setUserDetails(userDetails);
         setGraphFolder(folder || null);
      } catch (error) {
         setError({
            errorMessage: "Error al cargar datos",
            errorDetails: "Por favor, intente de nuevo más tarde.",
         });
      } finally {
         setLoading(false);
      }
   }, [microsoftUser, recordFolderId, recordId]);

   useEffect(() => {
      fetchData();
   }, [fetchData]);

   if (loading) {
      return (
         <Stack direction={"column"} spacing={2}>
            <LoadingComponent />
         </Stack>
      );
   }

   if (error) {
      return (
         <Stack direction={"column"} spacing={2}>
            <ErrorComponent
               errorMessage={error.errorMessage || "Error inesperado"}
               errorDetails={error.errorDetails || "Intente de nuevo más tarde"}
            />
         </Stack>
      );
   }

   return (
      <Stack
         direction={"column"}
         spacing={1}
         sx={{
            width: "100%",
            padding: "5px 10 px",
         }}
      >
         <HeaderBarElement userName={microsoftUser.username} folderName={graphFolder?.name || "No encontrada"} />
         {graphFolder ? (
            <FolderElement folder={graphFolder} microsoftUser={microsoftUser} />
         ) : (
            <NoFolderElement recordFolderId={recordFolderId} recordId={recordId} microsoftUser={microsoftUser} fetchData={fetchData} />
         )}
      </Stack>
   );
};

export default Attached;
