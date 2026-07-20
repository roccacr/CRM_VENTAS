DROP PROCEDURE IF EXISTS `37_OBTENER_TODOS_LOS_BANNERS`;

CREATE PROCEDURE `37_OBTENER_TODOS_LOS_BANNERS`(IN `typeRol` INT, IN `idEmploye` INT)
BEGIN
    SELECT COUNT(*) AS total_new
    FROM leads AS l
    INNER JOIN caidas AS c ON c.id_caida = l.id_Caida
    INNER JOIN admins AS a ON a.idnetsuite_admin = l.id_empleado_lead
    WHERE l.accion_lead IN (0, 2)
      AND l.estado_lead = 1
      AND l.segimineto_lead = '01-LEAD-INTERESADO'
      AND (typeRol = 1 OR l.id_empleado_lead = idEmploye);

    SELECT COUNT(DISTINCT l.idinterno_lead) AS total_attention
    FROM leads AS l
    LEFT JOIN calendars c
      ON c.id_lead = l.idinterno_lead
     AND STR_TO_DATE(c.fechaIni_calendar, '%Y-%m-%dT%H:%i') >= COALESCE(
        STR_TO_DATE(l.actualizadaaccion_lead, '%Y-%m-%d %H:%i:%s'),
        STR_TO_DATE(l.actualizadaaccion_lead, '%Y-%m-%d')
     )
     AND c.estado_calendar = 1
     AND c.accion_calendar = 'Pendiente'
    WHERE l.accion_lead = 6
      AND l.estado_lead = 1
      AND l.seguimiento_calendar = 0
      AND COALESCE(
        STR_TO_DATE(l.actualizadaaccion_lead, '%Y-%m-%d %H:%i:%s'),
        STR_TO_DATE(l.actualizadaaccion_lead, '%Y-%m-%d')
      ) <= DATE_SUB(NOW(), INTERVAL 4 DAY)
      AND COALESCE(
        STR_TO_DATE(l.actualizadaaccion_lead, '%Y-%m-%d %H:%i:%s'),
        STR_TO_DATE(l.actualizadaaccion_lead, '%Y-%m-%d')
      ) > DATE_SUB(NOW(), INTERVAL 1 MONTH)
      AND l.segimineto_lead NOT IN (
        '02-LEAD-OPORTUNIDAD',
        '03-LEAD-PRE-RESERVA',
        '04-LEAD-RESERVA',
        '05-LEAD-CONTRATO',
        '06-LEAD-ENTREGADO'
      )
      AND (typeRol = 1 OR l.id_empleado_lead = idEmploye)
      AND c.id_calendar IS NULL;

    SELECT COUNT(*) AS total_events
    FROM calendars AS c
    WHERE c.estado_calendar = 1
      AND DATE(c.fechaIni_calendar) = CURDATE()
      AND c.accion_calendar = 'Pendiente'
      AND (typeRol = 1 OR c.id_admin = idEmploye);

    SELECT COUNT(*) AS total_oport
    FROM oportunidades AS o
    WHERE o.chek_oport = 1
      AND o.estatus_oport = 1
      AND (typeRol = 1 OR o.employee_oport = idEmploye);

    SELECT COUNT(*) AS total_orders
    FROM ordenventa AS ov
    WHERE ov.caida_ov = 0
      AND ov.comision_cancelada_ov = 0
      AND ov.status_ov = 1
      AND ov.contrado_frima_ov = 0
      AND ov.pagadas_ov = 0
      AND (typeRol = 1 OR ov.id_ov_admin = idEmploye);

    SELECT COUNT(*) AS total_orders_pending
    FROM ordenventa AS ov
    WHERE ov.caida_ov = 0
      AND ov.comision_cancelada_ov = 0
      AND ov.contrado_frima_ov = 1
      AND ov.cierre_firmado_ov = 1
      AND ov.aprobacion_forma_ov = 1
      AND ov.aprobacion__rdr_ov = 1
      AND ov.status_ov = 1
      AND ov.pagadas_ov = 0
      AND ov.chekJefeVenta = 1
      AND (typeRol = 1 OR ov.id_ov_admin = idEmploye);

    SELECT COUNT(*) AS total_oport_negative
    FROM oportunidades o
    WHERE o.chek_oport = 0
      AND o.estatus_oport = 1
      AND (typeRol = 1 OR o.employee_oport = idEmploye)
      AND NOT EXISTS (
        SELECT 1
        FROM estimaciones e
        WHERE e.idOportunidad_est = o.id_oportunidad_oport
          AND e.status = 1
          AND e.pre_reserva != 1
          AND e.pre_caida != 1
      )
      AND NOT EXISTS (
        SELECT 1
        FROM ordenventa ov
        WHERE ov.id_ov_opt = o.id_oportunidad_oport
          AND ov.status_ov = 1
          AND ov.caida_ov = 0
          AND ov.reserva_ov = 0
      );

    SELECT COUNT(*) AS total_orders_pre_reserva
    FROM estimaciones AS e
    WHERE e.pre_reserva = 1
      AND COALESCE(e.pre_caida, 0) = 0
      AND (typeRol = 1 OR e.idAdmin_est = idEmploye)
      AND NOT EXISTS (
        SELECT 1
        FROM ordenventa AS reserva
        WHERE reserva.id_ov_est = e.idEstimacion_est
          AND reserva.status_ov = 1
          AND reserva.caida_ov = 0
          AND reserva.reserva_ov = 1
      )
      AND (
        NOT EXISTS (
          SELECT 1
          FROM ordenventa AS ov_any
          WHERE ov_any.id_ov_est = e.idEstimacion_est
        )
        OR EXISTS (
          SELECT 1
          FROM ordenventa AS ov_pre
          WHERE ov_pre.id_ov_est = e.idEstimacion_est
            AND ov_pre.status_ov = 1
            AND ov_pre.caida_ov = 0
            AND COALESCE(ov_pre.reserva_ov, 0) = 0
        )
      );

    SELECT COUNT(*) AS total_orders_reserva
    FROM ordenventa AS ov
    WHERE ov.caida_ov = 0
      AND ov.comision_cancelada_ov = 0
      AND ov.status_ov = 1
      AND ov.contrado_frima_ov = 0
      AND ov.pagadas_ov = 0
      AND ov.reserva_ov = 1
      AND (typeRol = 1 OR ov.id_ov_admin = idEmploye);
END;
