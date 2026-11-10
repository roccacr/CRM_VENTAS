import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { HomeSummaryModule } from "../sales/sales-orders/home-summary.module.js";
import { NoteCollaborationController } from "./note-collaboration.controller.js";
import { NoteCollaborationRepository } from "./note-collaboration.repository.js";
import { NoteCollaborationService } from "./note-collaboration.service.js";
import { NoteNotificationsController } from "./note-notifications.controller.js";
import { NoteNotificationsRepository } from "./note-notifications.repository.js";
import { NoteNotificationsService } from "./note-notifications.service.js";
import { NoteNotificationsWorker } from "./note-notifications.worker.js";
import { NoteRelatedRecordsController } from "./note-related-records.controller.js";
import { NoteRelatedRecordsReader } from "./note-related-records.reader.js";
import { NoteRelatedRecordsRepository } from "./note-related-records.repository.js";
import { NoteRelatedRecordsResolver } from "./note-related-records.resolver.js";
import { NoteRelatedRecordsService } from "./note-related-records.service.js";
import { NoteWorkflowController } from "./note-workflow.controller.js";
import { NoteWorkflowRepository } from "./note-workflow.repository.js";
import { NoteWorkflowService } from "./note-workflow.service.js";
import { NoteWorkflowWorker } from "./note-workflow.worker.js";
import { NotesController } from "./notes.controller.js";
import { NotesRepository } from "./notes.repository.js";
import { NotesService } from "./notes.service.js";
import { NotesRealtimeAuth } from "./notes-realtime.auth.js";
import { NotesRealtimeGateway } from "./notes-realtime.gateway.js";
import { NotesRealtimeEventsRepository } from "./notes-realtime.repository.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";
import { NotesRealtimeWorker } from "./notes-realtime.worker.js";

/** Notas nativas y entrega interna de colaboración. La proyección legacy sigue inactiva. */
@Module({
    imports: [IdentityModule, AuditModule, HomeSummaryModule],
    controllers: [NoteRelatedRecordsController, NotesController, NoteCollaborationController, NoteNotificationsController, NoteWorkflowController],
    providers: [NoteRelatedRecordsService, NoteRelatedRecordsRepository, NoteRelatedRecordsResolver, NoteRelatedRecordsReader, NotesRepository, NotesService, NoteCollaborationRepository, NoteCollaborationService, NoteNotificationsRepository, NoteNotificationsService, NoteNotificationsWorker, NotesRealtimeAuth, NotesRealtimeGateway, NotesRealtimeEventsRepository, NotesRealtimeSignal, NotesRealtimeWorker, NoteWorkflowRepository, NoteWorkflowService, NoteWorkflowWorker],
})
export class NotesModule {}
