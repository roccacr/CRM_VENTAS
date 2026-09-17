import { Background, Controls, MarkerType, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const baseNodeStyle = {
   border: "1px solid #dbe3ee",
   borderRadius: 8,
   color: "#0f172a",
   fontSize: 12,
   fontWeight: 800,
   lineHeight: 1.35,
   padding: 10,
   width: 205,
};

const flowEdge = (id, source, target, label = "") => ({
   id,
   label,
   markerEnd: { type: MarkerType.ArrowClosed },
   source,
   style: { stroke: "#334155", strokeWidth: 2 },
   target,
   type: "smoothstep",
});

const flowNode = (id, label, position, variant = "default") => {
   const variants = {
      default: { background: "#ffffff", borderColor: "#dbe3ee" },
      paused: { background: "#fff7ed", borderColor: "#fed7aa" },
      success: { background: "#f0fdf4", borderColor: "#86efac" },
      warning: { background: "#fffbeb", borderColor: "#fde68a" },
      error: { background: "#fef2f2", borderColor: "#fecaca" },
      info: { background: "#eff6ff", borderColor: "#bfdbfe" },
   };

   return {
      id,
      data: { label },
      draggable: false,
      position,
      style: {
         ...baseNodeStyle,
         ...variants[variant],
      },
   };
};

const buildProjectLabel = (projectConfigs, getProjectName) => {
   const activeProjects = projectConfigs.filter((config) => config.isActive);

   if (projectConfigs.length === 0) {
      return "Sin proyectos asignados\nNo hay leads elegibles";
   }

   if (activeProjects.length === 0) {
      return "Proyectos inactivos\nNo procesa leads hasta activar un flujo";
   }

   return activeProjects
      .slice(0, 4)
      .map((config) => getProjectName(config.idproyectoLead))
      .join("\n");
};

export const CronjobFlowDiagram = ({ cronjob, getProjectName }) => {
   const projectConfigs = cronjob?.projectConfigs || [];
   const hasActiveProjects = projectConfigs.some((config) => config.isActive);
   const isRunnable = Boolean(cronjob?.isActive && hasActiveProjects);

   const nodes = [
      flowNode(
         "runner",
         cronjob?.isActive ? "Cronjob activo\nRunner programado" : "Cronjob inactivo\nNo ejecuta",
         { x: 0, y: 150 },
         cronjob?.isActive ? "success" : "paused",
      ),
      flowNode(
         "projects",
         `Proyectos configurados\n${buildProjectLabel(projectConfigs, getProjectName)}`,
         { x: 255, y: 150 },
         hasActiveProjects ? "info" : "warning",
      ),
      flowNode(
         "lead-filter",
         "Busca leads pendientes\nwhatsapp_template_contact_sent = 2\n01-LEAD-INTERESADO\nestado_lead = 2",
         { x: 510, y: 150 },
         isRunnable ? "default" : "warning",
      ),
      flowNode("no-leads", "No hay coincidencias\nTermina sin cambios", { x: 765, y: 20 }, "info"),
      flowNode("admin", "Lead encontrado\nValida admin asignado", { x: 765, y: 150 }),
      flowNode("no-integration", "Sin integracion Kapso\nBitacora y no envia template", { x: 1020, y: 20 }, "warning"),
      flowNode("phone", "Integracion encontrada\nNormaliza y valida telefono", { x: 1020, y: 150 }),
      flowNode("bad-phone", "Telefono invalido\nBitacora + caida 68", { x: 1275, y: 20 }, "error"),
      flowNode("send", "Envia template saludo\nLead + asesor + proyecto", { x: 1275, y: 150 }, "info"),
      flowNode("failed", "Kapso falla\nBitacora + caida 68", { x: 1530, y: 20 }, "error"),
      flowNode("delivered", "Kapso entrega\nBitacora + caida 70", { x: 1530, y: 150 }, "success"),
      flowNode("reply", "Primera respuesta\nUna sola bitacora inicial", { x: 1785, y: 150 }, "success"),
      flowNode("accept", "Si / texto libre\nBitacora + caida 69", { x: 2040, y: 80 }, "success"),
      flowNode("reject", "No gracias\nBitacora + caida 67", { x: 2040, y: 220 }, "warning"),
      flowNode("close", "Cierra intento inicial\nLo demas ya no crea bitacora", { x: 2295, y: 150 }, "info"),
   ];

   const edges = [
      flowEdge("runner-projects", "runner", "projects"),
      flowEdge("projects-filter", "projects", "lead-filter"),
      flowEdge("filter-empty", "lead-filter", "no-leads", "No"),
      flowEdge("filter-admin", "lead-filter", "admin", "Si"),
      flowEdge("admin-missing", "admin", "no-integration", "No"),
      flowEdge("admin-phone", "admin", "phone", "Si"),
      flowEdge("phone-bad", "phone", "bad-phone", "No"),
      flowEdge("phone-send", "phone", "send", "Si"),
      flowEdge("send-failed", "send", "failed", "Falla"),
      flowEdge("send-delivered", "send", "delivered", "Entregado"),
      flowEdge("delivered-reply", "delivered", "reply"),
      flowEdge("reply-accept", "reply", "accept", "Si / otro texto"),
      flowEdge("reply-reject", "reply", "reject", "No"),
      flowEdge("accept-close", "accept", "close"),
      flowEdge("reject-close", "reject", "close"),
   ];

   return (
      <div className="kapso-flow-canvas" aria-label="Diagrama interactivo del cronjob">
         <ReactFlow
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            maxZoom={1.15}
            minZoom={0.12}
            nodes={nodes}
            nodesDraggable={false}
            preventScrolling={false}
         >
            <Background color="#cbd5e1" gap={18} />
            <Controls position="bottom-right" showInteractive={false} />
         </ReactFlow>
      </div>
   );
};
