import Modal from "antd/es/modal";
import Tabs from "antd/es/tabs";

import { ProcessViewer } from "../../components/processes/ProcessViewer";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";
import { ADDENDUM_PROCESS, FINIQUITO_PROCESS, FORMALIZATION_PROCESS, formalizationCurrentStep } from "./formalization-processes";
import { type AddendumPermission, canReadOrderAddendum } from "./order-addendum-permissions";

function orderContext(item: FollowUpItem | undefined): string | undefined {
    return item ? `Orden ${item.number} · Etapa según la última consulta` : undefined;
}

function MainProcess({ item }: { readonly item: FollowUpItem | undefined }) {
    const currentStep = formalizationCurrentStep(item);
    const context = item && !currentStep ? `Orden ${item.number} · Etapa sin identificar; no se infiere una posición.` : orderContext(item);
    return <ProcessViewer key={currentStep} definition={FORMALIZATION_PROCESS} currentStep={currentStep} contextLabel={context} />;
}

function AddendumProcess({ item, permissions }: { readonly item: FollowUpItem | undefined; readonly permissions: readonly AddendumPermission[] }) {
    const currentStep = canReadOrderAddendum(permissions) ? (item?.addendumStatus ?? undefined) : undefined;
    const context = currentStep ? orderContext(item) : "Mapa general de adéndum · Sin posición de una orden";
    return <ProcessViewer key={currentStep} definition={ADDENDUM_PROCESS} currentStep={currentStep} contextLabel={context} />;
}

/** La orden proviene de una lectura ya autorizada. Los mapas no consultan registros adicionales ni infieren permisos. */
export default function FormalizationProcessDialog({ item, permissions = [], onClose }: { readonly item?: FollowUpItem | undefined; readonly permissions?: readonly AddendumPermission[] | undefined; readonly onClose: () => void }) {
    return (
        <Modal open title="Cómo funciona Formalización" closable={{ "aria-label": "Cerrar proceso" }} onCancel={onClose} footer={null} width="min(1540px, 96vw)" zIndex={ADMINISTRATION_MODAL_Z_INDEX} styles={{ body: { maxHeight: "80vh", overflowY: "auto" } }} destroyOnHidden>
            <Tabs
                destroyOnHidden
                items={[
                    { key: "main", label: "Proceso principal", children: <MainProcess key={item?.id} item={item} /> },
                    { key: "addendum", label: "Adéndum · paralelo", children: <AddendumProcess key={item?.id} item={item} permissions={permissions} /> },
                    { key: "finiquito", label: "Venta caída y finiquito", children: <ProcessViewer definition={FINIQUITO_PROCESS} contextLabel="Mapa general de finiquito · Consulta el estado real en el panel de finiquito de la orden" /> },
                ]}
            />
        </Modal>
    );
}
