import FileTextOutlined from "@ant-design/icons/FileTextOutlined";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import { useId, useState } from "react";

import type { FormalizationExample } from "./formalization-preview.model";
import { type FormalizationScenario, SCENARIO_ACTION_LABELS, type ScenarioAction, type ScenarioValues } from "./formalization-scenario.model";

interface Field {
    readonly name: string;
    readonly label: string;
    readonly type?: "email" | "textarea" | "select";
    readonly options?: readonly { readonly value: string; readonly label: string }[];
    readonly optional?: boolean;
}
const fieldSets: Partial<Record<ScenarioAction, readonly Field[]>> = {
    assign: [
        {
            name: "owner",
            label: "Responsable",
            type: "select",
            options: [
                { value: "Gestor de ejemplo 1", label: "Gestor de ejemplo 1" },
                { value: "Gestor de ejemplo 2", label: "Gestor de ejemplo 2" },
            ],
        },
    ],
    send: [
        { name: "recipient", label: "Destinatario", type: "email" },
        { name: "subject", label: "Asunto" },
        { name: "message", label: "Mensaje", type: "textarea" },
    ],
    mode: [
        {
            name: "mode",
            label: "Modalidad de compra",
            type: "select",
            options: [
                { value: "financed", label: "Financiamiento" },
                { value: "own", label: "Recursos propios" },
            ],
        },
    ],
    bank: [
        {
            name: "bank",
            label: "Banco",
            type: "select",
            options: [
                { value: "Banco de ejemplo A", label: "Banco de ejemplo A" },
                { value: "Banco de ejemplo B", label: "Banco de ejemplo B" },
            ],
        },
        {
            name: "advisor",
            label: "Asesor bancario",
            type: "select",
            options: [
                { value: "Asesor de ejemplo A", label: "Asesor de ejemplo A" },
                { value: "Asesor de ejemplo B", label: "Asesor de ejemplo B" },
            ],
        },
    ],
    advisor: [
        { name: "advisor", label: "Nombre del otro asesor" },
        { name: "email", label: "Correo del asesor", type: "email" },
        { name: "phone", label: "Teléfono del asesor", optional: true },
    ],
    finance: [
        {
            name: "result",
            label: "Condición financiera",
            type: "select",
            options: [
                { value: "unknown", label: "Sin información disponible" },
                { value: "pending", label: "Saldo pendiente" },
                { value: "paid", label: "100% cancelado" },
            ],
        },
    ],
    exception: [
        {
            name: "result",
            label: "Resultado de excepción",
            type: "select",
            options: [
                { value: "requested", label: "Solicitud pendiente de autorización" },
                { value: "authorized", label: "Traspaso pendiente autorizado · Ficticio" },
            ],
        },
        { name: "reason", label: "Motivo de la excepción", type: "textarea" },
        { name: "authorizer", label: "Responsable autorizante" },
    ],
    close: [
        {
            name: "result",
            label: "Resultado de cierre",
            type: "select",
            options: [
                { value: "closed", label: "Cerrado por Formalizaciones" },
                { value: "later", label: "Pendiente por fase posterior" },
            ],
        },
        { name: "reason", label: "Motivo y observaciones del cierre", type: "textarea" },
    ],
};

function ScenarioField({ field, value, onChange }: { readonly field: Field; readonly value: string; readonly onChange: (value: string) => void }) {
    const id = useId();
    const props = {
        id,
        name: field.name,
        value,
        required: !field.optional,
        onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            onChange(event.target.value);
        },
    };
    let input = <input {...props} type={field.type === "email" ? "email" : "text"} />;
    if (field.type === "textarea") input = <textarea {...props} rows={4} />;
    if (field.type === "select")
        input = (
            <select {...props}>
                <option value="">Seleccionar</option>
                {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        );
    return (
        <div className="formalization-form__field">
            <label htmlFor={id}>
                {field.label}
                {field.optional ? <span className="formalization-form__optional"> · Opcional</span> : " *"}
            </label>
            {input}
        </div>
    );
}

function DocumentPicker({ order, values, onChange, signed }: { readonly order: FormalizationExample; readonly values: ScenarioValues; readonly onChange: (values: ScenarioValues) => void; readonly signed: boolean }) {
    const [error, setError] = useState("");
    return (
        <section className="formalization-document-picker" aria-label="Selección de documento">
            <label className="formalization-form__field">
                Documento de respaldo
                <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (!/\.(pdf|docx?)$/i.test(file.name)) {
                            setError("Selecciona un documento PDF o Word para el ejemplo.");
                            return;
                        }
                        setError("");
                        onChange({ ...values, document: file.name, sample: "no", bytes: String(file.size) });
                    }}
                />
            </label>
            <Button
                icon={<FileTextOutlined />}
                aria-label="Usar documento de ejemplo"
                onClick={() => {
                    setError("");
                    onChange({ ...values, document: `${signed ? "firmado" : "contrato"}-${order.id}.pdf`, sample: "yes" });
                }}
            >
                Usar documento de ejemplo
            </Button>
            {error && (
                <p role="alert" className="formalization-form__error">
                    {error}
                </p>
            )}
            {values.document && (
                <div className="formalization-document-ref">
                    <FileTextOutlined aria-hidden="true" />
                    <div>
                        <strong>{values.document}</strong>
                        <span>{values.sample === "yes" ? "PDF" : "Archivo seleccionado"}</span>
                    </div>
                </div>
            )}
        </section>
    );
}

function DocumentSheet({ order, name, sample }: { readonly order: FormalizationExample; readonly name: string; readonly sample: boolean }) {
    return (
        <section className="formalization-document-sheet" aria-label="Presentación del documento">
            <p className="formalization-document-sheet__mark">SIN VALIDEZ LEGAL</p>
            <h3>{name}</h3>
            {sample ? (
                <>
                    <h4>Contrato de compraventa</h4>
                    <dl>
                        <dt>Orden</dt>
                        <dd>{order.id}</dd>
                        <dt>Cliente</dt>
                        <dd>{order.client}</dd>
                        <dt>Proyecto / Unidad</dt>
                        <dd>
                            {order.project} / {order.unit}
                        </dd>
                    </dl>
                    <div className="formalization-document-sheet__signature">Firma del comprador __________________</div>
                </>
            ) : (
                <p>Vista previa del contenido no disponible.</p>
            )}
        </section>
    );
}

const confirmations: Partial<Record<ScenarioAction, string>> = {
    sign: "Recepción del contrato firmado.",
    start: "Sin iniciar → En proceso.",
    complete: "En proceso → Formalizado.",
    transfer: "Se representará el traspaso realizado con fecha, hora y responsable. No equivale a entrega de llaves.",
    mode: "Con recursos propios la gestión de crédito no aplica.",
    bank: "Selecciona el banco y su asesor.",
    advisor: "El asesor se asocia al banco seleccionado; no crea un nuevo banco.",
    finance: "Condición financiera de la orden.",
};

function initialValues(order: FormalizationExample, scenario: FormalizationScenario, action: ScenarioAction): Record<string, string> {
    return {
        recipient: `${order.id.toLowerCase()}@example.invalid`,
        subject: `Contrato de compraventa · ${order.id}`,
        message: `Estimado cliente:\nAdjuntamos el contrato correspondiente a ${order.project}, unidad ${order.unit}, para su revisión y firma.\nSaludos.`,
        mode: scenario.mode,
        owner: scenario.owner === "Sin asignar" ? "" : scenario.owner,
        bank: scenario.bank,
        advisor: scenario.advisor,
        email: scenario.advisorEmail,
        document: ["attach", "sign", "transfer", "exception"].includes(action) ? "" : (scenario.document ?? ""),
        sample: scenario.sampleDocument ? "yes" : "no",
        result: "",
        reason: "",
        authorizer: "",
        phone: "",
    };
}

function StoredDocuments({ order, scenario, values, onChange }: { readonly order: FormalizationExample; readonly scenario: FormalizationScenario; readonly values: ScenarioValues; readonly onChange: (values: ScenarioValues) => void }) {
    const document = scenario.documents.find((doc) => doc.name === values.document) ?? scenario.documents[0];
    return (
        <>
            <label className="formalization-form__field">
                Documento de la orden
                <select
                    value={document?.name ?? ""}
                    onChange={(event) => {
                        onChange({ ...values, document: event.target.value });
                    }}
                >
                    {scenario.documents.map((doc, index) => (
                        <option key={`${doc.name}-${String(index)}`} value={doc.name}>
                            {doc.kind} · {doc.name}
                        </option>
                    ))}
                </select>
            </label>
            <DocumentSheet order={order} name={document?.name ?? "Sin documento"} sample={document?.sample ?? false} />
        </>
    );
}

function DocumentArea({ order, scenario, action, values, onChange }: { readonly order: FormalizationExample; readonly scenario: FormalizationScenario; readonly action: ScenarioAction; readonly values: ScenarioValues; readonly onChange: (values: ScenarioValues) => void }) {
    const pick = ["attach", "sign", "transfer", "exception"].includes(action);
    if (action === "document") return <StoredDocuments order={order} scenario={scenario} values={values} onChange={onChange} />;
    if (action === "send")
        return (
            <div className="formalization-document-ref">
                <FileTextOutlined />
                <strong>Adjunto: {scenario.document}</strong>
            </div>
        );
    if (!pick) return null;
    return (
        <>
            <DocumentPicker order={order} values={values} signed={action === "sign"} onChange={onChange} />
            {values.document && <DocumentSheet order={order} name={values.document} sample={values.sample === "yes"} />}
        </>
    );
}

function BankReview({ scenario, action }: { readonly scenario: FormalizationScenario; readonly action: ScenarioAction }) {
    if (!["start", "complete", "advisor"].includes(action)) return null;
    return (
        <dl className="formalization-form__review">
            <dt>Banco</dt>
            <dd>{scenario.bank || "Sin seleccionar"}</dd>
            <dt>Asesor</dt>
            <dd>{scenario.advisor || "Sin seleccionar"}</dd>
            <dt>Crédito</dt>
            <dd>{scenario.credit}</dd>
        </dl>
    );
}

/** Formularios locales para revisar escenarios. No lee archivos, no tiene fetch ni persistencia. */
export function FormalizationActionDialog({ order, scenario, action, onApply, onClose }: { readonly order: FormalizationExample; readonly scenario: FormalizationScenario; readonly action: ScenarioAction; readonly onApply: (action: ScenarioAction, values: ScenarioValues) => void; readonly onClose: () => void }) {
    const id = useId();
    const [values, setValues] = useState<Record<string, string>>(() => initialValues(order, scenario, action));
    const [error, setError] = useState("");
    const readOnly = action === "document";
    return (
        <Modal
            open
            centered
            className="formalization-modal"
            title={SCENARIO_ACTION_LABELS[action]}
            onCancel={onClose}
            width={820}
            footer={
                <>
                    <Button onClick={onClose}>{readOnly ? "Cerrar vista previa" : "Cancelar"}</Button>
                    {!readOnly && (
                        <Button type="primary" htmlType="submit" form={id}>
                            Simular resultado
                        </Button>
                    )}
                </>
            }
        >
            <p className="formalization-modal__context">
                <strong>{order.id}</strong> · {order.client} · {order.unit}
            </p>
            <form
                id={id}
                className="formalization-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    try {
                        onApply(action, values);
                        onClose();
                    } catch (caught) {
                        setError(caught instanceof Error ? caught.message : "Revisa los campos del ejemplo.");
                    }
                }}
            >
                <p>{confirmations[action]}</p>
                <div className="formalization-form__fields">
                    {(fieldSets[action] ?? []).map((field) => (
                        <ScenarioField
                            key={field.name}
                            field={action === "bank" && field.name === "advisor" ? { ...field, options: (field.options ?? []).filter((option) => option.value.endsWith(values.bank?.slice(-1) ?? "?")) } : field}
                            value={values[field.name] ?? ""}
                            onChange={(value) => {
                                setValues((current) => ({ ...current, [field.name]: value, ...(field.name === "bank" ? { advisor: "", email: "" } : {}) }));
                            }}
                        />
                    ))}
                </div>
                <DocumentArea
                    order={order}
                    scenario={scenario}
                    action={action}
                    values={values}
                    onChange={(next) => {
                        setValues({ ...next });
                    }}
                />
                <BankReview scenario={scenario} action={action} />
                {error && (
                    <p role="alert" className="formalization-form__error">
                        {error}
                    </p>
                )}
            </form>
        </Modal>
    );
}
