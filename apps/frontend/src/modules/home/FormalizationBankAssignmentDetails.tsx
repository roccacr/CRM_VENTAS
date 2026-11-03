import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Skeleton from "antd/es/skeleton";
import { useEffect, useState } from "react";

import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { getOrderBankAssignment, type OrderBankAssignment } from "../../services/formalization/order-bank-assignment-service";
import { FormalizationBankAssignmentActions } from "./FormalizationBankAssignmentActions";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; assignment: OrderBankAssignment };
function BankAssignmentContent({ item, onRetry, onChanged }: { readonly item: FollowUpItem; readonly onRetry: () => void; readonly onChanged?: (() => void) | undefined }) {
    const [state, setState] = useState<LoadState>({ status: "loading" });
    useEffect(() => {
        const abort = new AbortController();
        let active = true;
        void getOrderBankAssignment(item, abort.signal).then(
            (assignment) => {
                if (active) setState({ status: "ready", assignment });
            },
            () => {
                if (active) setState({ status: "error" });
            },
        );
        return () => {
            active = false;
            abort.abort();
        };
    }, [item]);
    if (state.status === "loading")
        return (
            <div aria-label="Cargando datos bancarios">
                <Skeleton active paragraph={{ rows: 4 }} />
            </div>
        );
    if (state.status === "error") return <Alert showIcon type="warning" title="No fue posible consultar el banco y el ejecutivo de esta orden." action={<Button onClick={onRetry}>Reintentar datos bancarios</Button>} />;
    const { bank, advisor } = state.assignment;
    if (!bank || !advisor) return <p className="record-empty">Esta orden aún no tiene banco ni ejecutivo asignados.</p>;
    const fields = [
        ["Banco", bank.name],
        ["Ejecutivo bancario", advisor.name],
        ["Correo", advisor.email],
        ["Teléfono", advisor.phone],
        ["Área", advisor.area],
    ] as const;
    return (
        <div className="record-group">
            <dl>
                {fields.map(([label, value]) => (
                    <div key={label} className="record-field" data-span="1">
                        <dt>{label}</dt>
                        <dd data-empty={!value.trim()}>{value.trim() || "Sin dato"}</dd>
                    </div>
                ))}
            </dl>
            <FormalizationBankAssignmentActions item={item} assignment={state.assignment} onChanged={onChanged} />
        </div>
    );
}

/** Cada orden, guardado o reintento inicia una lectura nueva, sin reutilizar datos de otra orden. */
export function FormalizationBankAssignmentDetails({ item, revision, onChanged }: { readonly item: FollowUpItem; readonly revision: number; readonly onChanged?: (() => void) | undefined }) {
    const [attempt, setAttempt] = useState(0);
    return (
        <BankAssignmentContent
            key={`${item.source}:${item.id}:${String(revision)}:${String(attempt)}`}
            item={item}
            onChanged={onChanged}
            onRetry={() => {
                setAttempt((value) => value + 1);
            }}
        />
    );
}
