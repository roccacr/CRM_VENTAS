/** Modelos de consulta versionados: describen el proceso; nunca autorizan ni ejecutan comandos. */
export interface ProcessStep {
    readonly id: string;
    readonly label: string;
    readonly kind: "startEvent" | "userTask" | "exclusiveGateway" | "endEvent";
    readonly lane: number;
    readonly x: number;
    readonly y: number;
    readonly labelPosition?: readonly [number, number];
    readonly size?: readonly [number, number];
    readonly description: string;
    readonly requirements: string;
    readonly next: string;
}

export interface ProcessFlow {
    readonly from: string;
    readonly to: string;
    readonly label?: string;
    readonly labelPosition?: readonly [number, number];
    readonly points?: readonly (readonly [number, number])[];
}

export interface ProcessDefinition {
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    readonly version: string;
    readonly lanes: readonly string[];
    readonly width: number;
    readonly laneHeight: number;
    readonly steps: readonly ProcessStep[];
    readonly flows: readonly ProcessFlow[];
}

function xml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("'", "&apos;");
}

function flowId(index: number): string {
    return `Flow_${String(index)}`;
}

function diagramLabel(x: number, y: number): string {
    return `<bpmndi:BPMNLabel><dc:Bounds x="${String(x - 90)}" y="${String(y)}" width="180" height="48"/></bpmndi:BPMNLabel>`;
}

function flowLabel(points: readonly (readonly [number, number])[], position?: readonly [number, number]): string {
    if (position) return diagramLabel(position[0], position[1]);
    const segments = points.slice(1).map((end, index) => ({ start: points[index] ?? end, end }));
    const longest = segments.sort((a, b) => Math.abs(b.end[0] - b.start[0]) - Math.abs(a.end[0] - a.start[0]))[0];
    return longest ? diagramLabel((longest.start[0] + longest.end[0]) / 2, (longest.start[1] + longest.end[1]) / 2 - 28) : "";
}

/** Tamaños compartidos por las conexiones y el plano BPMN para conservar los anclajes. */
export function processStepBounds(step: ProcessStep) {
    const size = step.size ?? ({ startEvent: [36, 36], endEvent: [36, 36], exclusiveGateway: [50, 50], userTask: [156, 76] } as const)[step.kind];
    return { x: step.x, y: step.y, width: size[0], height: size[1] };
}

function connectionPoints(from: ProcessStep, to: ProcessStep): readonly (readonly [number, number])[] {
    const a = processStepBounds(from);
    const b = processStepBounds(to);
    if (Math.abs(a.x - b.x) > Math.abs(a.y - b.y)) {
        const right = a.x < b.x;
        const start = [right ? a.x + a.width : a.x, a.y + a.height / 2] as const;
        const end = [right ? b.x : b.x + b.width, b.y + b.height / 2] as const;
        const middle = (start[0] + end[0]) / 2;
        return [start, [middle, start[1]], [middle, end[1]], end];
    }
    const down = a.y < b.y;
    const start = [a.x + a.width / 2, down ? a.y + a.height : a.y] as const;
    const end = [b.x + b.width / 2, down ? b.y : b.y + b.height] as const;
    const middle = (start[1] + end[1]) / 2;
    return [start, [start[0], middle], [end[0], middle], end];
}

/** Exporta BPMN 2.0 con carriles y DI, apto para un visor externo. Solo admite modelos internos, sin XML aportado por usuarios. */
export function processBpmnXml(definition: ProcessDefinition): string {
    const lanes = definition.lanes
        .map(
            (name, index) =>
                `<bpmn:lane id="Lane_${String(index)}" name="${xml(name)}">${definition.steps
                    .filter((step) => step.lane === index)
                    .map((step) => `<bpmn:flowNodeRef>${step.id}</bpmn:flowNodeRef>`)
                    .join("")}</bpmn:lane>`,
        )
        .join("");
    const nodes = definition.steps.map((step) => `<bpmn:${step.kind} id="${step.id}" name="${xml(step.label)}"><bpmn:documentation>${xml(`${step.description}\nRequisitos: ${step.requirements}\nSiguiente: ${step.next}`)}</bpmn:documentation>${definition.flows.map((flow, index) => `${flow.to === step.id ? `<bpmn:incoming>${flowId(index)}</bpmn:incoming>` : ""}${flow.from === step.id ? `<bpmn:outgoing>${flowId(index)}</bpmn:outgoing>` : ""}`).join("")}</bpmn:${step.kind}>`).join("");
    const flows = definition.flows.map((flow, index) => `<bpmn:sequenceFlow id="${flowId(index)}" sourceRef="${flow.from}" targetRef="${flow.to}"${flow.label ? ` name="${xml(flow.label)}"` : ""}/>`).join("");
    const laneShapes = definition.lanes.map((_, index) => `<bpmndi:BPMNShape id="LaneShape_${String(index)}" bpmnElement="Lane_${String(index)}" isHorizontal="true"><dc:Bounds x="0" y="${String(index * definition.laneHeight)}" width="${String(definition.width)}" height="${String(definition.laneHeight)}"/></bpmndi:BPMNShape>`).join("");
    const shapes = definition.steps
        .map((step) => {
            const bounds = processStepBounds(step);
            const position: readonly [number, number] = step.labelPosition ?? [bounds.x + bounds.width / 2, bounds.y + bounds.height + 8];
            const label = step.kind === "userTask" ? "" : diagramLabel(position[0], position[1]);
            return `<bpmndi:BPMNShape id="Shape_${step.id}" bpmnElement="${step.id}"><dc:Bounds x="${String(bounds.x)}" y="${String(bounds.y)}" width="${String(bounds.width)}" height="${String(bounds.height)}"/>${label}</bpmndi:BPMNShape>`;
        })
        .join("");
    const edges = definition.flows
        .map((flow, index) => {
            const from = definition.steps.find((step) => step.id === flow.from);
            const to = definition.steps.find((step) => step.id === flow.to);
            if (!from || !to) throw new Error("El proceso contiene una conexión sin actividad.");
            const points = flow.points ?? connectionPoints(from, to);
            const label = flow.label ? flowLabel(points, flow.labelPosition) : "";
            return `<bpmndi:BPMNEdge id="Edge_${String(index)}" bpmnElement="${flowId(index)}">${points.map(([x, y]) => `<di:waypoint x="${String(x)}" y="${String(y)}"/>`).join("")}${label}</bpmndi:BPMNEdge>`;
        })
        .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_${definition.id}" targetNamespace="https://habita.local/processes"><bpmn:process id="${definition.id}" name="${xml(definition.title)}" isExecutable="false"><bpmn:laneSet id="Lanes">${lanes}</bpmn:laneSet>${nodes}${flows}</bpmn:process><bpmndi:BPMNDiagram id="Diagram_${definition.id}"><bpmndi:BPMNPlane id="Plane_${definition.id}" bpmnElement="${definition.id}">${laneShapes}${shapes}${edges}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>`;
}
