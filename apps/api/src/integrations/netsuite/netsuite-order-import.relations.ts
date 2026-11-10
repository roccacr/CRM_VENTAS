import { ConflictException } from "@nestjs/common";
import { type RawBuilder, sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import type { CrmDatabase } from "../../database/database.types.js";
import { nativeRelationReferences, readOrderRelationValues } from "./netsuite-order-event.mapper.js";

type Tx = Transaction<CrmDatabase>;
type Domain = keyof typeof nativeRelationReferences;
export type ImportUnit = { code: string; projectId: string; projectName?: string | null | undefined };
type Customer = { fullName: string; email: string | null; phone: string | null; company: string | null; campaign: string | null; campaignName?: string | null | undefined };

async function one<T>(tx: Tx, query: RawBuilder<T>, label: string): Promise<T | undefined> {
    const { rows } = await query.execute(tx);
    if (rows.length > 1) throw new ConflictException(label + " tiene más de una coincidencia.");
    return rows[0];
}

async function reference(tx: Tx, domain: Domain, id: string) {
    const ref = nativeRelationReferences[domain];
    const active = ref.deleted ? sql`AND ${sql.ref(ref.deleted)} IS NULL` : sql``;
    return one(
        tx,
        sql<{ owner: number; status: string }>`SELECT ${sql.ref(ref.owner)} AS owner,${sql.ref(ref.status)} AS status FROM ${sql.table(ref.table)}
        JOIN int_external_system s ON s.id_external_system=${sql.ref(ref.system)} AND s.code_external_system='netsuite' AND s.status_external_system='active'
        WHERE ${sql.ref(ref.external)}=${id} ${active} LIMIT 2`,
        domain,
    );
}

async function legacyCustomer(tx: Tx, id: string) {
    return one(
        tx,
        sql<Customer & { source: string | null }>`SELECT nombre_lead AS fullName,email_lead AS email,telefono_lead AS phone,
        empresa_lead AS company,CAST(idcampana_lead AS CHAR) AS campaign,referencia_lead AS source
        FROM ${sql.table("crmdatabase-api.leads")} WHERE idinterno_lead=${id} OR idnetsuite_lead=${id} LIMIT 2`,
        "El cliente",
    );
}

/** Primero se busca en Habita. Solo lo que no tiene una coincidencia unica pide datos a NetSuite. Mas de una fila es conflicto. */
export async function missingImportRelation(tx: Tx, domain: "lead" | "subsidiary" | "user" | "unit_file", id: string): Promise<boolean> {
    if (await reference(tx, domain, id)) return false;
    if (domain === "unit_file") return !(await existingImportUnit(tx, id));
    if (domain === "lead") return !(await legacyCustomer(tx, id))?.campaign;
    if (domain === "subsidiary") return !(await legacySubsidiary(tx, id));
    return !(await legacyOwner(tx, id));
}

async function ensureAlias(tx: Tx, domain: Domain, identity: { id: string; system: number }, create: () => Promise<number>) {
    const { id, system } = identity;
    const linked = await reference(tx, domain, id);
    if (linked) {
        if (linked.status !== "active") throw new ConflictException("Hay una referencia NetSuite inactiva para " + domain + ".");
        return linked.owner;
    }
    const owner = await create();
    const ref = nativeRelationReferences[domain];
    await sql`INSERT INTO ${sql.table(ref.table)} (${sql.id(ref.owner)},${sql.id(ref.system)},${sql.id(ref.external)},${sql.id(ref.status)})
        VALUES (${owner},${system},${id},'active')`.execute(tx);
    return owner;
}

async function existingImportUnit(tx: Tx, id: string) {
    return one(
        tx,
        sql<{ id: number }>`SELECT u.id_unit_file AS id FROM crm_unit_file u
        JOIN ${sql.table("crmdatabase-api.expedientes")} e ON e.id_expediente=u.id_old_produccion_unit_file
        WHERE e.ID_interno_expediente=${id} LIMIT 2`,
        "El expediente nativo",
    );
}

async function importUnit(tx: Tx, id: string, fetched?: ImportUnit) {
    const native = await existingImportUnit(tx, id);
    if (native) return native.id;
    if (!fetched) throw new ConflictException("Falta la ficha NetSuite del expediente " + id + ".");
    const project = await importProject(tx, fetched);
    const legacy = await one(
        tx,
        sql<{ id: number }>`SELECT id_expediente AS id FROM ${sql.table("crmdatabase-api.expedientes")}
        WHERE ID_interno_expediente=${id} LIMIT 2`,
        "El expediente anterior",
    );
    const result = await sql`INSERT INTO crm_unit_file (public_id_unit_file,native_code_unit_file,id_old_produccion_unit_file,project_id_unit_file,source_project_reference_unit_file,code_unit_file)
        VALUES (${ulid()},${"NETSUITE-UNIT-" + id},${legacy?.id ?? null},${project},${fetched.projectId},${fetched.code})`.execute(tx);
    return Number(result.insertId);
}

/** El ID de NetSuite se resuelve antes del ID interno. El bloqueo del sistema externo serializa las altas. */
async function importProject(tx: Tx, unit: ImportUnit) {
    const project = await one(
        tx,
        sql<{ id: number; active: number }>`SELECT p.id_project AS id,
        (r.status_project_external_reference='active' AND r.deleted_at_project_external_reference IS NULL AND p.deleted_at_project IS NULL) AS active FROM crm_project p
        JOIN crm_project_external_reference r ON r.project_id_project_external_reference=p.id_project
        JOIN int_external_system s ON s.id_external_system=r.external_system_id_project_external_reference
        WHERE s.code_external_system='netsuite' AND s.status_external_system='active'
        AND r.external_id_project_external_reference=${unit.projectId} LIMIT 2`,
        "El proyecto del expediente",
    );
    if (project) {
        if (!project.active) throw new ConflictException("La referencia del proyecto NetSuite está inactiva.");
        return project.id;
    }
    const projectId = await reconcileProjectRecord(tx, unit);
    const system = await tx.selectFrom("int_external_system").select("id_external_system").where("code_external_system", "=", "netsuite").where("status_external_system", "=", "active").executeTakeFirstOrThrow();
    await sql`INSERT INTO crm_project_external_reference (project_id_project_external_reference,external_system_id_project_external_reference,external_id_project_external_reference)
        VALUES (${projectId},${system.id_external_system},${unit.projectId})`.execute(tx);
    return projectId;
}

async function reconcileProjectRecord(tx: Tx, unit: ImportUnit) {
    const legacy = await one(
        tx,
        sql<{ id: number; name: string }>`SELECT id_proyecto AS id,Nombre_proyecto AS name
        FROM ${sql.table("crmdatabase-api.proyectos")} WHERE id_ProNetsuite=${unit.projectId} LIMIT 2`,
        "El proyecto en la base anterior",
    );
    if (legacy) {
        const native = await tx.selectFrom("crm_project").select(["id_project", "deleted_at_project"]).where("id_old_produccion_project", "=", legacy.id).executeTakeFirst();
        if (native) {
            if (native.deleted_at_project) throw new ConflictException("El proyecto conciliado está archivado.");
            return native.id_project;
        }
    }
    return insertProject(tx, unit.projectId, unit.projectName || legacy?.name, legacy?.id);
}

async function insertProject(tx: Tx, externalId: string, name?: string | null, legacyId?: number) {
    if (!name || name.length > 180) throw new ConflictException("No se confirmó el nombre del proyecto NetSuite " + externalId + ".");
    const result = await sql`INSERT INTO crm_project (public_id_project,native_code_project,id_old_produccion_project,name_project)
        VALUES (${ulid()},${"NETSUITE-PROJECT-" + externalId},${legacyId ?? null},${name})`.execute(tx);
    return Number(result.insertId);
}

async function legacySubsidiary(tx: Tx, id: string) {
    return one(
        tx,
        sql<{ id: number; name: string }>`SELECT id_subsidaria AS id,Nombre_Subsidiaria AS name
        FROM ${sql.table("crmdatabase-api.subsidiarias")} WHERE id_NetsuiteSub=${id} LIMIT 2`,
        "La subsidiaria",
    );
}

async function importSubsidiary(tx: Tx, id: string, fetched?: string | null) {
    const row = await legacySubsidiary(tx, id);
    const legacyId = row?.id ?? null;
    const name = row?.name ?? fetched;
    if (!name) throw new ConflictException("No hay una subsidiaria conciliable para el ID NetSuite " + id + ".");
    const native = await one(
        tx,
        sql<{ id: number }>`SELECT id_subsidiary AS id FROM crm_subsidiary
        WHERE id_old_produccion_subsidiary=${legacyId} AND deleted_at_subsidiary IS NULL LIMIT 2`,
        "La subsidiaria nativa",
    );
    if (native) return native.id;
    const sameName = await one(
        tx,
        sql<{ id: number }>`SELECT id_subsidiary AS id FROM crm_subsidiary
        WHERE name_subsidiary=${name} AND deleted_at_subsidiary IS NULL LIMIT 2`,
        "El nombre de la subsidiaria",
    );
    if (sameName) throw new ConflictException("La subsidiaria ya existe por nombre y requiere conciliar su ID NetSuite.");
    const result = await sql`INSERT INTO crm_subsidiary (public_id_subsidiary,native_code_subsidiary,id_old_produccion_subsidiary,name_subsidiary,status_subsidiary)
        VALUES (${ulid()},${"NETSUITE-SUB-" + id},${legacyId},${name},'active')`.execute(tx);
    return Number(result.insertId);
}

async function assertNewContact(tx: Tx, email: string) {
    const existing = await one(
        tx,
        sql<{ id: number }>`SELECT id_contact AS id FROM crm_contact
        WHERE normalized_email_contact=${email} AND deleted_at_contact IS NULL LIMIT 2`,
        "El correo del cliente",
    );
    if (existing) throw new ConflictException("El cliente tiene un contacto existente sin referencia. Requiere conciliación.");
}

async function importCampaign(tx: Tx, system: number, customer: Customer) {
    const externalId = customer.campaign?.trim();
    // NetSuite usa IDs negativos para campañas de sistema, por ejemplo -3 (Llamada).
    if (!externalId || !/^-?[1-9]\d*$/.test(externalId)) {
        throw new ConflictException("El cliente no tiene un ID de campaña de NetSuite válido.");
    }
    const campaign = await one(
        tx,
        sql<{ id: number; active: number }>`SELECT c.id_campaign AS id,
        (r.status_campaign_external_reference='active' AND r.deleted_at_campaign_external_reference IS NULL AND c.deleted_at_campaign IS NULL) AS active FROM crm_campaign c
        JOIN crm_campaign_external_reference r ON r.campaign_id_campaign_external_reference=c.id_campaign
        WHERE r.external_system_id_campaign_external_reference=${system} AND r.external_id_campaign_external_reference=${externalId} LIMIT 2`,
        "La campaña del cliente",
    );
    if (campaign) {
        if (!campaign.active) throw new ConflictException("La referencia de campaña de NetSuite está inactiva.");
        return campaign.id;
    }
    const campaignId = await reconcileCampaignRecord(tx, externalId, customer.campaignName);
    await sql`INSERT INTO crm_campaign_external_reference (campaign_id_campaign_external_reference,external_system_id_campaign_external_reference,external_id_campaign_external_reference)
        VALUES (${campaignId},${system},${externalId})`.execute(tx);
    return campaignId;
}

async function reconcileCampaignRecord(tx: Tx, externalId: string, netsuiteName?: string | null) {
    const legacy = await one(
        tx,
        sql<{ id: number; name: string | null }>`SELECT id_Campana AS id,Nombre_Campana AS name
        FROM ${sql.table("crmdatabase-api.campanas")} WHERE id_NetsauiteCampana=${externalId} LIMIT 2`,
        "La campaña en el catálogo anterior",
    );
    if (legacy) {
        const native = await tx.selectFrom("crm_campaign").select(["id_campaign", "deleted_at_campaign"]).where("id_old_produccion_campaign", "=", legacy.id).executeTakeFirst();
        if (native) {
            if (native.deleted_at_campaign) throw new ConflictException("La campaña conciliada está archivada.");
            return native.id_campaign;
        }
    }
    return insertCampaign(tx, externalId, netsuiteName || legacy?.name, legacy?.id);
}

async function insertCampaign(tx: Tx, externalId: string, rawName?: string | null, legacyId?: number) {
    const name = rawName?.trim();
    if (!name || name.length > 180) throw new ConflictException("No se confirmó el nombre de la campaña NetSuite " + externalId + ".");
    const inserted = await sql`INSERT INTO crm_campaign (public_id_campaign,native_code_campaign,id_old_produccion_campaign,name_campaign)
        VALUES (${ulid()},${"NETSUITE-CAMPAIGN-" + externalId},${legacyId ?? null},${name})`.execute(tx);
    return Number(inserted.insertId);
}

async function importSource(tx: Tx, sourceName: string | null) {
    const source = await one(
        tx,
        sql<{ code: string }>`SELECT code_lead_source AS code FROM conf_lead_source
        WHERE status_lead_source='active' AND ${sourceName}=name_lead_source AND code_lead_source<>'netsuite' LIMIT 2`,
        "El origen comercial del cliente",
    );
    if (source) return source.code;
    // Sin un canal comercial confirmado, registrar la procedencia de la importación.
    await sql`INSERT INTO conf_lead_source (code_lead_source,name_lead_source) VALUES ('netsuite','Importado desde NetSuite')
        ON DUPLICATE KEY UPDATE code_lead_source=code_lead_source`.execute(tx);
    const fallback = await tx.selectFrom("conf_lead_source").select("status_lead_source").where("code_lead_source", "=", "netsuite").executeTakeFirst();
    if (fallback?.status_lead_source !== "active") throw new ConflictException("El origen comercial de importación NetSuite está inactivo.");
    return "netsuite";
}

async function customerDetails(tx: Tx, id: string, fetched?: Customer) {
    const legacy = await legacyCustomer(tx, id);
    const customer = fetched ?? legacy;
    if (!customer || !validCustomerName(customer.fullName)) throw new ConflictException("No se encontró la ficha del cliente en NetSuite o Habita.");
    const email = normalizeContactEmail(customer.email);
    if (email) await assertNewContact(tx, email);
    return { customer, email, sourceName: legacy?.source ?? null };
}

async function createCustomer(tx: Tx, identity: { id: string; system: number }, location: { unit: number | null; subsidiary: number | null }, fetched?: Customer) {
    const { unit, subsidiary } = location;
    const { customer, email, sourceName } = await customerDetails(tx, identity.id, fetched);
    const project = unit ? await tx.selectFrom("crm_unit_file").select("project_id_unit_file").where("id_unit_file", "=", unit).executeTakeFirst() : null;
    if (!project) throw new ConflictException("Falta conciliar el proyecto del cliente.");
    const campaignId = await importCampaign(tx, identity.system, customer);
    const source = await importSource(tx, sourceName);
    const contact = await sql`INSERT INTO crm_contact (public_id_contact,full_name_contact,email_contact,normalized_email_contact,phone_contact)
        VALUES (${ulid()},${customer.fullName},${customer.email},${email},${customer.phone})`.execute(tx);
    const lead = await sql`INSERT INTO crm_lead (public_id_lead,primary_contact_id_lead,project_id_lead,campaign_id_lead,subsidiary_id_lead,source_code_lead,company_name_lead)
        VALUES (${ulid()},${String(contact.insertId)},${project.project_id_unit_file},${campaignId},${subsidiary},${source},${customer.company})`.execute(tx);
    return Number(lead.insertId);
}

async function legacyOwner(tx: Tx, id: string) {
    return one(
        tx,
        sql<{ email: string | null }>`SELECT LOWER(TRIM(email_admin)) AS email
        FROM ${sql.table("crmdatabase-api.admins")} WHERE idnetsuite_admin=${id} LIMIT 2`,
        "El responsable",
    );
}

async function linkOwner(tx: Tx, id: string, system: number, fetched?: string | null) {
    const existing = await reference(tx, "user", id);
    if (existing) return existing.status === "active";
    const admin = await legacyOwner(tx, id);
    const email = (admin ? admin.email : fetched)?.trim().toLowerCase();
    if (!email) return false;
    const user = await one(
        tx,
        sql<{ id: number }>`SELECT id_user AS id FROM sec_user WHERE normalized_email_user=${email}
        AND deleted_at_user IS NULL AND status_user='active' LIMIT 2`,
        "La cuenta del responsable",
    );
    if (user) await ensureAlias(tx, "user", { id, system }, () => Promise.resolve(user.id));
    return Boolean(user);
}

/** La oportunidad y `createdfrom` se guardan como captura. No se crean entidades de oportunidad ni de estimacion. Un responsable sin cuenta deja la orden y avisa; no se inventa el usuario. */
export async function reconcileImportRelations(tx: Tx, input: { fields: Record<string, unknown>; orderId: string; netsuiteId: string; operationId: string; customer?: Customer | undefined; subsidiaryName?: string | null | undefined; ownerEmail?: string | null | undefined; unit?: ImportUnit | undefined }) {
    const { fields, orderId, netsuiteId, operationId, customer } = input;
    const { entity, custbody38, subsidiary, crm_owner_employee, opportunity } = readOrderRelationValues(fields);
    if (!entity) throw new ConflictException("La orden no contiene un cliente de NetSuite.");
    // El sistema externo se bloquea para que dos ordenes no creen el mismo alias a la vez.
    const system = await tx.selectFrom("int_external_system").select("id_external_system").where("code_external_system", "=", "netsuite").where("status_external_system", "=", "active").forUpdate().executeTakeFirstOrThrow();
    const id = system.id_external_system;
    const unit = custbody38 ? await ensureAlias(tx, "unit_file", { id: custbody38, system: id }, () => importUnit(tx, custbody38, input.unit)) : null;
    const subsidiaryId = subsidiary ? await ensureAlias(tx, "subsidiary", { id: subsidiary, system: id }, () => importSubsidiary(tx, subsidiary, input.subsidiaryName)) : null;
    const ownerLinked = crm_owner_employee ? await linkOwner(tx, crm_owner_employee, id, input.ownerEmail) : true;
    const customerIdentity = { id: entity, system: id };
    await ensureAlias(tx, "lead", customerIdentity, () => createCustomer(tx, customerIdentity, { unit, subsidiary: subsidiaryId }, customer));
    const createdFrom = sourceRecordReference(fields.createdfrom);
    if (opportunity || createdFrom) {
        await sql`INSERT INTO int_sales_order_source_snapshot (sales_order_id_sales_order_source_snapshot,external_system_id_sales_order_source_snapshot,
            source_record_id_sales_order_source_snapshot,payload_sales_order_source_snapshot,operation_id_sales_order_source_snapshot)
            VALUES (${orderId},${id},${netsuiteId},${JSON.stringify({ opportunity, createdFrom })},${operationId})`.execute(tx);
    }
    return ownerLinked;
}

function sourceRecordReference(value: unknown) {
    return typeof value === "string" || typeof value === "number" ? value : null;
}

function validCustomerName(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
}

function normalizeContactEmail(email: string | null): string | null {
    return email?.trim().toLowerCase() || null;
}
