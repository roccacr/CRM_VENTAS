import Button from "antd/es/button";
import Modal from "antd/es/modal";
import Pagination from "antd/es/pagination";

import { FINIQUITO_SECTIONS, type FiniquitoOverviewRow, type FiniquitoSection } from "../../services/formalization/finiquito-service";
import { ADMINISTRATION_MODAL_Z_INDEX } from "../administration/administration-theme";
import type { useFiniquitoBanner } from "./useFiniquitoBanner";

function sectionLabel(section: FiniquitoSection): string {
    return FINIQUITO_SECTIONS.find((item) => item.code === section)?.label ?? "Saldo validado: faltan checks de NetSuite";
}
function FiniquitoOrderRow({ item, onNavigate, close }: { readonly item: FiniquitoOverviewRow; readonly onNavigate: ((path: string) => void) | undefined; readonly close: () => void }) {
    return (
        <tr data-finiquito="true">
            <td>
                <strong>{item.number}</strong>
            </td>
            <td>{sectionLabel(item.section)}</td>
            <td>
                <Button
                    onClick={() => {
                        close();
                        onNavigate?.(`/home/formalization?${new URLSearchParams({ orderSource: item.source, orderId: item.id })}`);
                    }}
                >
                    Gestionar orden
                </Button>
            </td>
        </tr>
    );
}
/** Usa la ficha existente para ejecutar marcas y su confirmación, sin duplicar permisos ni lógica de transición. */
export function FiniquitoOrdersModal({ model, onNavigate }: { readonly model: ReturnType<typeof useFiniquitoBanner>; readonly onNavigate: ((path: string) => void) | undefined }) {
    return (
        <Modal open={model.open} title="Ventas caídas · Gestión de finiquito" footer={null} onCancel={model.close} width={850} zIndex={ADMINISTRATION_MODAL_Z_INDEX} destroyOnHidden>
            {model.busy && <p role="status">Consultando órdenes…</p>}
            {model.failed && (
                <p role="alert">
                    No fue posible consultar el finiquito. <Button onClick={model.retry}>Reintentar</Button>
                </p>
            )}
            <div className="formalization-finiquito-table">
                <table>
                    <thead>
                        <tr>
                            <th>Orden</th>
                            <th>Gestión de finiquito</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {model.data?.items.map((item) => (
                            <FiniquitoOrderRow key={`${item.source}:${item.id}`} item={item} close={model.close} onNavigate={onNavigate} />
                        ))}
                    </tbody>
                </table>
            </div>
            {model.data?.total === 0 && <p>No hay órdenes en esta sección.</p>}
            <Pagination current={model.page} pageSize={25} total={model.data?.total ?? 0} showSizeChanger={false} onChange={model.setPage} />
        </Modal>
    );
}
