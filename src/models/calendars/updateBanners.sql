CREATE DEFINER=`master_chief`@`%` PROCEDURE `37_OBTENER_TODOS_LOS_BANNERS`(IN `typeRol` INT, IN `idEmploye` INT)
BEGIN
    -- -------------------------------------------------------------------
    -- Procedure: getAllBanners
    -- Purpose: Retrieves banner information related to leads, events, 
    -- opportunities, and sales orders based on user role and employee ID.
    -- The procedure calculates totals for:
    -- 1. New leads or in-process leads
    -- 2. Leads that require immediate attention
    -- 3. Pending events
    -- 4. Active opportunities
    -- 5. Pending sales orders (signed and completed)
    -- -------------------------------------------------------------------

    -- Step 1: Count new or in-process leads based on role and employee ID
    -- -------------------------------------------------------------------
    SELECT COUNT(*) AS total_new
    FROM leads AS l
    INNER JOIN caidas AS c ON c.id_caida = l.id_Caida
    INNER JOIN admins AS a ON a.idnetsuite_admin = l.id_empleado_lead
    WHERE l.accion_lead IN (0, 2) -- New (0) or in-process (2) leads
    AND l.estado_lead = 1 -- Active leads only
    AND l.segimineto_lead = '01-LEAD-INTERESADO' -- Leads in 'Interested' phase
    AND (
        typeRol = 1 -- If admin, show all leads
        OR l.id_empleado_lead = idEmploye -- If non-admin, show assigned leads
    );

    -- Step 2: Count leads that require immediate attention
    -- -------------------------------------------------------------------
    SELECT COUNT(*) AS total_attention
    FROM leads AS l
    WHERE l.accion_lead = 3 -- Leads that need attention
    AND l.estado_lead = 1 -- Active leads only
    AND l.seguimiento_calendar = 0 -- No calendar follow-up
    AND l.segimineto_lead NOT IN (
        '02-LEAD-OPORTUNIDAD', '03-LEAD-PRE-RESERVA', '04-LEAD-RESERVA', 
        '05-LEAD-CONTRATO', '06-LEAD-ENTREGADO' -- Exclude progressed leads
    )
    AND (
        typeRol = 1 -- If admin, show all leads
        OR l.id_empleado_lead = idEmploye -- If non-admin, show assigned leads
    );

    -- Step 3: Count pending events based on role and employee ID
    -- -------------------------------------------------------------------
    SELECT COUNT(*) AS total_events
    FROM calendars AS c
    WHERE c.estado_calendar = 1 -- Active events only
    AND DATE(c.fechaIni_calendar) = CURDATE() -- Today's events
    AND c.accion_calendar = 'Pendiente' -- Pending events
    AND (
        typeRol = 1 -- If admin, show all events
        OR c.id_admin = idEmploye -- If non-admin, show assigned events
    );

    -- Step 4: Count active opportunities based on role and employee ID
    -- -------------------------------------------------------------------
    SELECT COUNT(*) AS total_oport
    FROM oportunidades AS o
    WHERE o.chek_oport = 1 -- Active opportunities
    AND o.estatus_oport = 1 -- Opportunities marked as active
    AND (
        typeRol = 1 -- If admin, show all opportunities
        OR o.employee_oport = idEmploye -- If non-admin, show assigned opportunities
    );

    -- Step 5: Count active sales orders (not fallen or canceled) 
    -- -------------------------------------------------------------------
    SELECT COUNT(*) AS total_orders
    FROM ordenventa AS ov
    WHERE ov.caida_ov = 0 -- Exclude fallen orders
    AND ov.comision_cancelada_ov = 0 -- Exclude canceled commissions
    AND ov.status_ov = 1 -- Active orders only
    AND ov.contrado_frima_ov = 0 -- Exclude signed contracts
    AND ov.pagadas_ov=0
    AND (
        typeRol = 1 -- If admin, show all orders
        OR ov.id_ov_admin = idEmploye -- If non-admin, show assigned orders
    );

    -- Step 6: Count pending sales orders that are fully signed and completed
    -- -------------------------------------------------------------------
    SELECT COUNT(*) AS total_orders_pending
    FROM ordenventa AS ov
    WHERE ov.caida_ov = 0 -- Exclude fallen orders
    AND ov.comision_cancelada_ov = 0 -- Exclude canceled commissions
    AND ov.contrado_frima_ov = 1 -- Include orders with signed contract
    AND ov.cierre_firmado_ov = 1 -- Include orders with signed closure
    AND ov.aprobacion_forma_ov = 1 -- Include orders with approved form
    AND ov.aprobacion__rdr_ov = 1 -- Include orders with RDR approval
    --  AND ov.calculo_comision_asesor_ov = 1Include orders with commission calculated
    AND ov.status_ov = 1 -- Active orders only
    AND ov.pagadas_ov= 0
    AND ov.chekJefeVenta = 1
    AND (
        typeRol = 1 -- If admin, show all orders
        OR ov.id_ov_admin = idEmploye -- If non-admin, show assigned orders
    );

END