import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "./ProcessViewer.css";

import DownloadOutlined from "@ant-design/icons/DownloadOutlined";
import Button from "antd/es/button";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import { useCallback, useEffect, useRef, useState } from "react";

import { processBpmnXml, type ProcessDefinition, type ProcessStep, processStepBounds } from "./process-definition";

interface ProcessCanvas {
    zoom(value?: number | "fit-viewport"): number;
    addMarker(id: string, marker: string): void;
    removeMarker(id: string, marker: string): void;
    viewbox(box?: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number };
}

function focusProcessStep(surface: ProcessCanvas, step: ProcessStep): void {
    surface.zoom(Math.max(1.1, surface.zoom()));
    const viewport = surface.viewbox();
    const bounds = processStepBounds(step);
    surface.viewbox({ x: bounds.x + bounds.width / 2 - viewport.width / 2, y: bounds.y + bounds.height / 2 - viewport.height / 2, width: viewport.width, height: viewport.height });
}

function ProcessPosition({ definition, currentStep, contextLabel }: { readonly definition: ProcessDefinition; readonly currentStep: string | undefined; readonly contextLabel: string | undefined }) {
    const label = definition.steps.find((entry) => entry.id === currentStep)?.label;
    return (
        <div className="process-viewer__position" role="status">
            {contextLabel ?? "Vista general del proceso"}
            {label && <strong>Etapa actual: {label}</strong>}
        </div>
    );
}

/** Visor BPMN de consulta compartido. La lista de pasos ofrece la misma interacción con teclado y lectores de pantalla. */
export function ProcessViewer({ definition, currentStep, contextLabel }: { readonly definition: ProcessDefinition; readonly currentStep?: string | undefined; readonly contextLabel?: string | undefined }) {
    const container = useRef<HTMLDivElement>(null);
    const canvas = useRef<ProcessCanvas | null>(null);
    const markedStep = useRef<string | undefined>(undefined);
    const pendingFocus = useRef<ProcessStep | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [attempt, setAttempt] = useState(0);
    const [selected, setSelected] = useState(currentStep ?? definition.steps[0]?.id);
    const detail = definition.steps.find((entry) => entry.id === selected);
    const selectStep = useCallback(
        (id: string) => {
            const step = definition.steps.find((entry) => entry.id === id);
            if (!step) return;
            setSelected(id);
            if (canvas.current) focusProcessStep(canvas.current, step);
            else pendingFocus.current = step;
            const target: Partial<Pick<Element, "scrollIntoView">> | null = container.current?.parentElement ?? null;
            target?.scrollIntoView?.({ block: "start", behavior: "smooth" });
        },
        [definition],
    );
    useEffect(() => {
        if (!container.current) return;
        let active = true;
        const viewer = new NavigatedViewer({ container: container.current, textRenderer: { defaultStyle: { fontFamily: 'Aptos, "Segoe UI", sans-serif', fontSize: 20, fontWeight: "500" }, externalStyle: { fontSize: 18 } } });
        viewer.on("element.click", (event: { element: { id: string } }) => {
            selectStep(event.element.id.replace(/_label$/u, ""));
        });
        void viewer
            .importXML(processBpmnXml(definition))
            .then(() => {
                if (!active) return;
                const surface = viewer.get<ProcessCanvas>("canvas");
                canvas.current = surface;
                surface.zoom("fit-viewport");
                if (currentStep) surface.addMarker(currentStep, "process-current");
                if (pendingFocus.current) {
                    focusProcessStep(surface, pendingFocus.current);
                    pendingFocus.current = null;
                }
                setStatus("ready");
            })
            .catch(() => {
                if (active) setStatus("error");
            });
        return () => {
            active = false;
            canvas.current = null;
            markedStep.current = undefined;
            viewer.destroy();
        };
    }, [definition, currentStep, attempt, selectStep]);
    useEffect(() => {
        const surface = canvas.current;
        if (!surface || !selected || status !== "ready") return;
        if (markedStep.current) surface.removeMarker(markedStep.current, "process-selected");
        surface.addMarker(selected, "process-selected");
        markedStep.current = selected;
    }, [selected, status]);
    const download = () => {
        const url = URL.createObjectURL(new Blob([processBpmnXml(definition)], { type: "application/xml;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${definition.id}-${definition.version}.bpmn`;
        link.click();
        window.setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    };
    return (
        <section className="process-viewer" aria-label={`Mapa de ${definition.title}`}>
            <p className="process-viewer__summary">{definition.summary}</p>
            <div className="process-viewer__toolbar">
                <ProcessPosition definition={definition} currentStep={currentStep} contextLabel={contextLabel} />
                <div className="process-viewer__controls" role="group" aria-label="Controles del mapa">
                    <Button disabled={status !== "ready"} onClick={() => canvas.current?.zoom("fit-viewport")}>
                        Ajustar mapa
                    </Button>
                    <Button
                        disabled={status !== "ready"}
                        aria-label="Alejar mapa"
                        onClick={() => {
                            if (canvas.current) canvas.current.zoom(Math.max(0.25, canvas.current.zoom() / 1.25));
                        }}
                    >
                        −
                    </Button>
                    <Button
                        disabled={status !== "ready"}
                        aria-label="Acercar mapa"
                        onClick={() => {
                            if (canvas.current) canvas.current.zoom(Math.min(2.5, canvas.current.zoom() * 1.25));
                        }}
                    >
                        +
                    </Button>
                    <Button icon={<DownloadOutlined aria-hidden="true" />} onClick={download}>
                        Descargar BPMN
                    </Button>
                </div>
            </div>
            <div className="process-viewer__body">
                <div className="process-viewer__diagram">
                    <div className="process-viewer__legend" aria-label="Leyenda BPMN">
                        <span>○ Inicio</span>
                        <span>▢ Actividad</span>
                        <span>◇ Decisión</span>
                        <span>◎ Fin</span>
                        <span className="process-viewer__selected-key">Actividad seleccionada</span>
                        {currentStep && <span className="process-viewer__current-key">Etapa actual</span>}
                    </div>
                    <div ref={container} className="process-viewer__canvas" aria-label="Diagrama BPMN; también puedes consultar los pasos en la lista" />
                    {status === "loading" && <p role="status">Cargando mapa…</p>}
                    {status === "error" && (
                        <div role="alert">
                            No fue posible dibujar el mapa. Puedes consultar los pasos a continuación.{" "}
                            <Button
                                onClick={() => {
                                    setStatus("loading");
                                    setAttempt((value) => value + 1);
                                }}
                            >
                                Reintentar mapa
                            </Button>
                        </div>
                    )}
                    <p className="process-viewer__hint">Selecciona un paso en el mapa o en la lista: se marca en ámbar y se centra. Usa «Ajustar mapa» para volver a ver el recorrido completo.</p>
                </div>
                <aside className="process-viewer__detail" aria-label="Detalle de la actividad">
                    {detail && (
                        <>
                            <span className="process-viewer__selection-label">Actividad seleccionada</span>
                            <span className="process-viewer__eyebrow">{definition.lanes[detail.lane]}</span>
                            <h3>{detail.label}</h3>
                            <p>{detail.description}</p>
                            <h4>Qué se necesita</h4>
                            <p>{detail.requirements}</p>
                            <h4>Qué sigue</h4>
                            <p>{detail.next}</p>
                        </>
                    )}
                </aside>
            </div>
            <details className="process-viewer__steps" open>
                <summary>Consultar pasos del mapa</summary>
                <div role="group" aria-label="Pasos del proceso">
                    {definition.steps.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            aria-pressed={selected === entry.id}
                            aria-current={currentStep === entry.id ? "step" : undefined}
                            onClick={() => {
                                selectStep(entry.id);
                            }}
                        >
                            {entry.label}
                            {currentStep === entry.id && <span> · Etapa actual</span>}
                        </button>
                    ))}
                </div>
            </details>
            <p className="process-viewer__footer">Mapa de consulta · Revisión {definition.version}. Las acciones y permisos se verifican en la orden. La posición actual no acredita las etapas recorridas.</p>
        </section>
    );
}
