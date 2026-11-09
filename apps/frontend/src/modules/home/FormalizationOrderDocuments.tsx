import "./FormalizationOrderDocuments.css";

import CloudOutlined from "@ant-design/icons/CloudOutlined";
import CloudUploadOutlined from "@ant-design/icons/CloudUploadOutlined";
import DownloadOutlined from "@ant-design/icons/DownloadOutlined";
import EyeOutlined from "@ant-design/icons/EyeOutlined";
import FileExcelOutlined from "@ant-design/icons/FileExcelOutlined";
import FileImageOutlined from "@ant-design/icons/FileImageOutlined";
import FileOutlined from "@ant-design/icons/FileOutlined";
import FilePdfOutlined from "@ant-design/icons/FilePdfOutlined";
import FileWordOutlined from "@ant-design/icons/FileWordOutlined";
import FileZipOutlined from "@ant-design/icons/FileZipOutlined";
import FolderOpenFilled from "@ant-design/icons/FolderOpenFilled";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Empty from "antd/es/empty";
import Modal from "antd/es/modal";
import Progress from "antd/es/progress";
import Skeleton from "antd/es/skeleton";
import Space from "antd/es/space";
import Table from "antd/es/table";
import Tooltip from "antd/es/tooltip";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

import { ApiClientError } from "../../services/api/api-client";
import { getIdentityProfile, startMicrosoftLogin } from "../../services/auth/auth-service";
import { closePopupIfOpen, openMicrosoftPopup, waitForMicrosoftPopupSession } from "../../services/auth/microsoft-popup-login";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { createOrderFolder, type OrderDocument, orderDocumentLink, type OrderDocuments, readOrderDocuments, uploadOrderDocument } from "../../services/formalization/order-documents-service";
const allowed = (permissions: readonly { code: string; effect: string }[], code: string) => permissions.some((p) => p.code === code && p.effect === "allow") && !permissions.some((p) => p.code === code && p.effect === "deny");
type Conflict = "replace" | "rename" | null;
interface Duplicate {
    name: string;
    resolve: (value: Conflict) => void;
}
function errorText(error: unknown) {
    return error instanceof ApiClientError ? error.message : "No se completó la operación. Actualiza los archivos antes de reintentar una subida.";
}
/** Una lectura pertenece a una identidad y revisión; una respuesta vieja nunca pinta otra orden. */
function useDocumentsRead({ source, id }: FollowUpItem, canRead: boolean) {
    const [revision, setRevision] = useState(0);
    const [response, setResponse] = useState<{ key: string; data: OrderDocuments | null; error: string } | null>(null);
    const key = `${source}:${id}:${String(revision)}`;
    useEffect(() => {
        if (!canRead) return;
        const controller = new AbortController();
        void readOrderDocuments({ source, id }, controller.signal).then(
            (data) => {
                if (!controller.signal.aborted) setResponse({ key, data, error: "" });
            },
            (cause: unknown) => {
                if (!controller.signal.aborted) setResponse({ key, data: null, error: errorText(cause) });
            },
        );
        return () => {
            controller.abort();
        };
    }, [source, id, canRead, key]);
    return {
        data: response?.key === key ? response.data : null,
        loadError: response?.key === key ? response.error : "",
        loading: canRead && response?.key !== key,
        refresh: () => {
            setRevision((value) => value + 1);
        },
    };
}
interface ListingProps {
    data: OrderDocuments | null;
    busy: boolean;
    loading: boolean;
    canWrite: boolean;
    onCreate: () => Promise<void>;
    onOpen: (file: OrderDocument, action: "preview" | "download") => Promise<void>;
}
const FILE_ICONS: readonly (readonly [RegExp, ReactNode, string])[] = [
    [/\.pdf$/iu, <FilePdfOutlined key="pdf" />, "pdf"],
    [/\.(docx?|rtf|odt)$/iu, <FileWordOutlined key="doc" />, "doc"],
    [/\.(xlsx?|csv|ods)$/iu, <FileExcelOutlined key="xls" />, "xls"],
    [/\.(png|jpe?g|gif|webp|bmp|svg|heic)$/iu, <FileImageOutlined key="img" />, "img"],
    [/\.(zip|rar|7z)$/iu, <FileZipOutlined key="zip" />, "zip"],
];
/** File-type glyph with the tint OneDrive gives each kind of document. */
function FileGlyph({ name }: { readonly name: string }) {
    const match = FILE_ICONS.find(([pattern]) => pattern.test(name));
    return (
        <span className={`order-documents__glyph order-documents__glyph--${match?.[2] ?? "file"}`} aria-hidden="true">
            {match?.[1] ?? <FileOutlined />}
        </span>
    );
}
const formatSize = (bytes: number): string => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`);
const dateFormat = new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", year: "numeric" });
function formatModified(value: string | null): string {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : "—";
}
function FileActions({ file, busy, onOpen }: { readonly file: OrderDocument; readonly busy: boolean; readonly onOpen: ListingProps["onOpen"] }) {
    return (
        <Space size={4} className="order-documents__row-actions">
            <Tooltip title="Vista previa">
                <Button
                    type="text"
                    aria-label="Vista previa"
                    icon={<EyeOutlined />}
                    disabled={busy}
                    onClick={() => {
                        void onOpen(file, "preview");
                    }}
                />
            </Tooltip>
            <Tooltip title="Descargar">
                <Button
                    type="text"
                    aria-label="Descargar"
                    icon={<DownloadOutlined />}
                    disabled={busy}
                    onClick={() => {
                        void onOpen(file, "download");
                    }}
                />
            </Tooltip>
        </Space>
    );
}
function DocumentsListing({ data, busy, loading, canWrite, onCreate, onOpen }: ListingProps) {
    if (loading)
        return (
            <div role="status" aria-label="Cargando documentos de la orden">
                <Skeleton title={false} paragraph={{ rows: 4 }} />
            </div>
        );
    if (!data) return null;
    if (!data.folder)
        return (
            <Empty description="Esta orden aún no tiene carpeta documental">
                {canWrite && (
                    <Button
                        type="primary"
                        loading={busy}
                        onClick={() => {
                            void onCreate();
                        }}
                    >
                        Crear carpeta de la orden
                    </Button>
                )}
            </Empty>
        );
    return (
        <Table<OrderDocument>
            className="order-documents__table"
            rowKey="id"
            loading={loading}
            dataSource={[...data.files]}
            pagination={data.files.length > 10 ? { pageSize: 10, size: "small", showSizeChanger: false } : false}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Esta carpeta está vacía" /> }}
            scroll={{ x: 460 }}
            columns={[
                {
                    title: "Nombre",
                    dataIndex: "name",
                    render: (name: string) => (
                        <span className="order-documents__name">
                            <FileGlyph name={name} />
                            <span>{name}</span>
                        </span>
                    ),
                },
                { title: "Modificado", dataIndex: "modifiedAt", width: 130, render: (value: string | null) => formatModified(value) },
                { title: "Tamaño", dataIndex: "size", width: 100, render: (size: number) => formatSize(size) },
                { title: "", key: "actions", width: 96, render: (_, file) => <FileActions file={file} busy={busy} onOpen={onOpen} /> },
            ]}
        />
    );
}
interface UploadProps {
    busy: boolean;
    input: RefObject<HTMLInputElement | null>;
    onFiles: (files: readonly File[]) => Promise<void>;
}
function UploadSlot({ enabled, data, ...props }: UploadProps & { readonly enabled: boolean; readonly data: OrderDocuments | null }) {
    return enabled && data?.folder ? <UploadPanel {...props} /> : null;
}
/** Compact drop target for the side panel. */
function UploadPanel({ busy, input, onFiles }: UploadProps) {
    return (
        <div
            className="order-documents__upload"
            onDragOver={(event) => {
                event.preventDefault();
            }}
            onDrop={(event) => {
                event.preventDefault();
                void onFiles(Array.from(event.dataTransfer.files));
            }}
        >
            <CloudUploadOutlined aria-hidden="true" />
            <p>Arrastra tus archivos aquí o selecciónalos. Máximo 250 MB por archivo.</p>
            <input
                ref={input}
                type="file"
                multiple
                hidden
                disabled={busy}
                onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    void onFiles(files);
                }}
            />
            <Button
                type="primary"
                disabled={busy}
                onClick={() => {
                    input.current?.click();
                }}
            >
                Seleccionar archivos
            </Button>
        </div>
    );
}
function FolderTitle({ item, data }: { readonly item: FollowUpItem; readonly data: OrderDocuments | null }) {
    return (
        <div className="order-documents__folder">
            <span className="order-documents__folder-icon" aria-hidden="true">
                <FolderOpenFilled />
            </span>
            <div>
                <strong>{data?.folder?.name ?? `Orden ${item.number}`}</strong>
                <span>{data ? `Carpeta NetSuite ${data.reference}` : "Documentos de la orden"}</span>
            </div>
        </div>
    );
}
function FolderStats({ files }: { readonly files: readonly OrderDocument[] }) {
    const total = files.reduce((sum, file) => sum + file.size, 0);
    return (
        <dl className="order-documents__stats">
            <div>
                <dt>Archivos</dt>
                <dd>{files.length}</dd>
            </div>
            <div>
                <dt>Tamaño total</dt>
                <dd>{formatSize(total)}</dd>
            </div>
        </dl>
    );
}
/** Left column: the folder as OneDrive presents it, its totals, and the order-scoped actions. */
function FolderPanel({ item, data, busy, loading, onRefresh, onConnect, children }: { readonly item: FollowUpItem; readonly data: OrderDocuments | null; readonly busy: boolean; readonly loading: boolean; readonly onRefresh: () => void; readonly onConnect: () => void; readonly children?: ReactNode }) {
    return (
        <aside className="order-documents__side" aria-label="Carpeta de la orden">
            <FolderTitle item={item} data={data} />
            {data?.folder ? <FolderStats files={data.files} /> : null}
            <div className="order-documents__side-actions">
                <Button icon={<ReloadOutlined spin={loading} aria-hidden="true" />} onClick={onRefresh} disabled={busy} loading={loading}>
                    Actualizar archivos
                </Button>
                <Button icon={<CloudOutlined aria-hidden="true" />} onClick={onConnect} disabled={busy}>
                    Conectar Microsoft
                </Button>
            </div>
            {children}
        </aside>
    );
}
function DocumentsHeader({ number, reference }: { readonly number: string; readonly reference: string | null }) {
    return (
        <header className="order-documents__header">
            <h3>Archivos y soporte relacionados</h3>
            <p>
                Documentos de la orden {number}
                {reference ? ` · Carpeta NetSuite ${reference}` : ""}.
            </p>
        </header>
    );
}
function DocumentsMessages({ error, loadError, notice }: { error: string; loadError: string; notice: string }) {
    const failure = error || loadError;
    return (
        <>
            {failure && <Alert type="error" showIcon title={failure} />}
            {notice && <Alert type="warning" showIcon title={notice} />}
        </>
    );
}
/** Documentos de la orden: nunca comparte la raíz documental del cliente ni el expediente de la unidad. */
export function FormalizationOrderDocuments({ item, permissions }: { readonly item: FollowUpItem; readonly permissions: readonly { code: string; effect: string }[] }) {
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [uploadName, setUploadName] = useState("");
    const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const active = useRef(true);
    const uploadController = useRef<AbortController | null>(null);
    const duplicateRef = useRef<Duplicate | null>(null);
    const canRead = allowed(permissions, "formalizacion.orders.documents.read");
    const { data, loadError, loading, refresh } = useDocumentsRead(item, canRead);
    const canWrite = allowed(permissions, "formalizacion.orders.documents.write") && Boolean(data?.canWrite);
    const isActive = () => active.current;
    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
            uploadController.current?.abort();
            duplicateRef.current?.resolve(null);
        };
    }, []);
    const resolveDuplicate = (value: Conflict) => {
        duplicateRef.current?.resolve(value);
        duplicateRef.current = null;
        setDuplicate(null);
    };
    const ask = (name: string) =>
        new Promise<Conflict>((resolve) => {
            const pending = { name, resolve };
            duplicateRef.current = pending;
            setDuplicate(pending);
        });
    const uploadOne = async (file: File, names: Set<string>, signal: AbortSignal): Promise<boolean> => {
        signal.throwIfAborted();
        const cleanName = file.name.replace(/[\\/:*?"<>|#%]/gu, "").trim();
        const conflict = names.has(cleanName.toLowerCase()) ? await ask(cleanName) : "fail";
        if (conflict === null) return false;
        signal.throwIfAborted();
        setUploadName(file.name);
        setProgress(0);
        const uploaded = await uploadOrderDocument(item, file, {
            conflict,
            signal,
            onProgress: (value) => {
                if (isActive()) setProgress(value);
            },
        });
        if (!uploaded.auditRecorded && isActive()) setNotice("El archivo se subió, pero no se pudo completar su auditoría. No repitas la subida.");
        names.add(cleanName.toLowerCase());
        return true;
    };
    const upload = async (files: readonly File[]) => {
        if (busy || !canWrite) return;
        setBusy(true);
        setError("");
        const controller = new AbortController();
        uploadController.current = controller;
        const names = new Set(data?.files.map((file) => file.name.toLowerCase()));
        try {
            for (const file of files) {
                if (!(await uploadOne(file, names, controller.signal))) break;
            }
            refresh();
        } catch (cause) {
            setError(errorText(cause));
        } finally {
            if (isActive()) {
                setBusy(false);
                setProgress(null);
            }
        }
    };
    const create = async () => {
        setBusy(true);
        setError("");
        try {
            const created = await createOrderFolder(item);
            if (!created.auditRecorded) setNotice("La carpeta está disponible, pero no se pudo completar su auditoría.");
            refresh();
        } catch (cause) {
            setError(errorText(cause));
        } finally {
            setBusy(false);
        }
    };
    const open = async (file: OrderDocument, action: "preview" | "download") => {
        const popup = window.open("about:blank", "_blank");
        if (!popup) {
            setError("Permite ventanas emergentes para abrir el documento.");
            return;
        }
        popup.opener = null;
        try {
            const result = await orderDocumentLink(item, file.id, action);
            popup.location.replace(result.url);
        } catch (cause) {
            popup.close();
            setError(errorText(cause));
        }
    };
    const connect = async () => {
        const popup = openMicrosoftPopup();
        if (!popup) {
            setError("Permite ventanas emergentes para conectar Microsoft.");
            return;
        }
        setBusy(true);
        setError("");
        try {
            const before = await getIdentityProfile();
            popup.location.href = await startMicrosoftLogin();
            await waitForMicrosoftPopupSession(popup, before.session.publicId);
            const after = await getIdentityProfile();
            if (after.user.publicId !== before.user.publicId) {
                window.location.reload();
                return;
            }
            refresh();
        } catch {
            closePopupIfOpen(popup);
            setError("Conecta la misma cuenta de Habita. El acceso a archivos puede requerir aprobación del administrador Microsoft.");
        } finally {
            setBusy(false);
        }
    };
    if (!canRead) return <Alert type="info" showIcon title="No tienes permiso para consultar los documentos de la orden." />;
    return (
        <section aria-label="Documentación de la orden" className="order-documents">
            <FolderPanel item={item} data={data} busy={busy} loading={loading} onRefresh={refresh} onConnect={() => void connect()}>
                <UploadSlot enabled={canWrite} data={data} busy={busy} input={input} onFiles={upload} />
            </FolderPanel>
            <div className="order-documents__main">
                <DocumentsHeader number={item.number} reference={data ? data.reference : null} />
                <DocumentsMessages error={error} loadError={loadError} notice={notice} />
                <DocumentsListing data={data} busy={busy} loading={loading} canWrite={canWrite} onCreate={create} onOpen={open} />
                {progress !== null && (
                    <div role="status">
                        <p>Subiendo {uploadName}</p>
                        <Progress percent={progress} />
                    </div>
                )}
            </div>
            <Modal
                open={duplicate !== null}
                title="Ya existe un archivo con este nombre"
                onCancel={() => {
                    resolveDuplicate(null);
                }}
                footer={[
                    <Button
                        key="cancel"
                        onClick={() => {
                            resolveDuplicate(null);
                        }}
                    >
                        Cancelar
                    </Button>,
                    <Button
                        key="rename"
                        onClick={() => {
                            resolveDuplicate("rename");
                        }}
                    >
                        Renombrar copia
                    </Button>,
                    <Button
                        key="replace"
                        danger
                        onClick={() => {
                            resolveDuplicate("replace");
                        }}
                    >
                        Reemplazar existente
                    </Button>,
                ]}
            >
                <p>{duplicate?.name}</p>
                <p>Reemplazar modifica el archivo existente. Renombrar conserva ambos archivos.</p>
            </Modal>
        </section>
    );
}
