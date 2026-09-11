import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { createPrismaClient } from "./prisma-client.factory";

/**
 * Wrapper Nest del PrismaClient.
 *
 * Conecta en `onModuleInit` y desconecta en `onModuleDestroy` para un
 * shutdown limpio del pool. Expone solo los modelos que esta API usa hoy;
 * si crece el schema, se agregan propiedades explicitas (evita filtrar el
 * client completo a los feature modules).
 *
 * Scripts y Playwright NO usan esta clase: van a `createPrismaClient()`.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    private readonly client = createPrismaClient();

    /** Tabla de integraciones de numeros WhatsApp Kapso. */
    readonly kapsoIntegracionNumeroWhatsapp = this.client.kapsoIntegracionNumeroWhatsapp;

    /** Tabla puente: integraciones Kapso asignadas a administradores CRM. */
    readonly kapsoIntegracionAdminAsignacion = this.client.kapsoIntegracionAdminAsignacion;

    /** Tabla puente legacy: integraciones Kapso asignadas a proyectos CRM. */
    readonly kapsoIntegracionProyectoAsignacion = this.client.kapsoIntegracionProyectoAsignacion;

    /** Configuraciones generales de cronjobs Kapso. */
    readonly kapsoCronjobConfiguracion = this.client.kapsoCronjobConfiguracion;

    /** Proyectos CRM habilitados para cada cronjob Kapso. */
    readonly kapsoCronjobProyectoConfiguracion = this.client.kapsoCronjobProyectoConfiguracion;

    /** Intentos del cronjob `envio_template_inicial`; un solo intento por lead. */
    readonly kapsoEnvioTemplateInicialIntento = this.client.kapsoEnvioTemplateInicialIntento;

    /** Tabla legacy de administradores CRM; solo se consultan campos no sensibles. */
    readonly admin = this.client.admin;

    /** Tabla legacy de leads; fuente de proyectos CRM y candidatos del cronjob. */
    readonly lead = this.client.lead;

    /** Tabla legacy de bitacoras CRM; registra acciones funcionales por lead. */
    readonly bitacora = this.client.bitacora;

    /**
     * Transaccion Prisma. Los repos la usan para writes atomicos
     * (asignacion admin + status, intento de template + bitacora, etc.).
     */
    transaction<T>(fn: (prisma: Prisma.TransactionClient) => Promise<T>): Promise<T> {
        return this.client.$transaction(fn);
    }

    async onModuleInit(): Promise<void> {
        await this.client.$connect();
    }

    async onModuleDestroy(): Promise<void> {
        await this.client.$disconnect();
    }
}
