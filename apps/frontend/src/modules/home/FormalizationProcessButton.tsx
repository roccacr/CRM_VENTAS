import ApartmentOutlined from "@ant-design/icons/ApartmentOutlined";
import Button from "antd/es/button";
import { lazy, Suspense, useState } from "react";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import type { AddendumPermission } from "./order-addendum-permissions";

const ProcessDialog = lazy(() => import("./FormalizationProcessDialog"));

/** El visor y sus dependencias se descargan únicamente cuando una persona solicita ver el proceso. */
export function FormalizationProcessButton({ item, permissions }: { readonly item?: FollowUpItem | undefined; readonly permissions?: readonly AddendumPermission[] | undefined }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button
                icon={<ApartmentOutlined aria-hidden="true" />}
                onClick={() => {
                    setOpen(true);
                }}
            >
                Ver proceso
            </Button>
            {open && (
                <Suspense fallback={<span role="status">Cargando visor de procesos…</span>}>
                    <ProcessDialog
                        item={item}
                        permissions={permissions}
                        onClose={() => {
                            setOpen(false);
                        }}
                    />
                </Suspense>
            )}
        </>
    );
}
