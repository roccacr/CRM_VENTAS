import React from "react";
import NotFoundActionComponent from "../../notFound/NotFoundAction";
import { Stack } from "@mui/system";
import { createFolderGraph } from "@/utils/microsoft";

const NoFolderElement = ({
	recordFolderId,
	recordId,
	microsoftUser,
	fetchData,
}) => {
	const handleCreateFolder = async () => {
		try {
			await createFolderGraph(recordFolderId, microsoftUser, recordId);
			await fetchData();
		} catch (error) {
			console.log("Error al crear carpeta: ", error);
		}
	};

	return (
		<Stack>
			<NotFoundActionComponent
				notFoundMessage={
					"No se ha encontrado la carpeta para este registro"
				}
				actionMessage={"Presione el botón para crear una carpeta"}
				action={() => {
					handleCreateFolder();
				}}
			/>
		</Stack>
	);
};

export default NoFolderElement;
