# Ventas caídas · Gestión de finiquito

**Plan funcional aprobado e implementación local.** Este diagrama describe las reglas;
no certifica que el banner o todo el flujo ya estén implementados o desplegados.

Se conserva el nombre actual **Finiquito firmado**. En este plan significa
**finiquito enviado, pendiente de firma y devolución**. El posible cambio de
nombre a «Finiquito enviado · Pendiente de firma» queda sin aplicar.

```mermaid
flowchart TD
    O["Orden de venta"] --> E{"¿Venta caída = Sí<br/>y Reserva Aplicada = T?"}
    E -- "No" --> X["No entra al banner<br/>ni al flujo de finiquito"]
    E -- "Sí" --> D{"¿Saldo validado = Sí?"}

    subgraph FLUJO["Ventas caídas · Gestión de finiquito"]
        direction TB
        D -- "No" --> V["1. Validación de saldo<br/>Saldo validado = No<br/>Finiquito bloqueado"]
        V -- "Marcar Saldo validado<br/>y registrar en bitácora" --> L["Mostrar Venta caída<br/>y Contrato firmado<br/>Sin alterar checks de NetSuite"]
        D -- "Sí" --> L
        L --> C{"¿Venta caída = Sí<br/>y Contrato firmado = Sí?"}
        C -- "No" --> W["Saldo ya validado<br/>Esperar checks de NetSuite<br/>Envío bloqueado"]
        W -- "NetSuite confirma ambos checks" --> C
        C -- "Sí" --> P["2. Finiquito pendiente<br/>Saldo validado = Sí<br/>Preparar el envío"]
        P -- "Marcar Finiquito enviado<br/>y registrar en bitácora" --> S["3. Finiquito firmado<br/>Enviado: espera firma<br/>y devolución del cliente"]
        S -- "Marcar Finiquito recibido<br/>y registrar en bitácora" --> F["4. Formalizada<br/>Finiquito recibido = Sí"]
    end

    V -. "Todo el circuito" .-> B["Sin saltos ni retrocesos<br/>No cambia etapa comercial<br/>Ante error: rollback, sin avanzar"]
    P -. "Cada transición" .-> A["Bitácora en BD nueva<br/>Orden, usuario y fecha/hora<br/>Paso y valores anteriores/nuevos"]
    S -. "Mientras está en el circuito" .-> N["Excluida de otros banners<br/>y etapas comerciales<br/>También de Pendientes de adéndum"]

    classDef etapa fill:#fff1f0,stroke:#cf1322,color:#820014,stroke-width:2px;
    classDef decision fill:#fffbe6,stroke:#d48806,color:#613400;
    classDef bloqueo fill:#fafafa,stroke:#8c8c8c,color:#434343;
    classDef nota fill:#e6f4ff,stroke:#1677ff,color:#003a8c;
    classDef fin fill:#f6ffed,stroke:#389e0d,color:#135200,stroke-width:2px;
    class V,P,S etapa;
    class E,D,C decision;
    class X,W bloqueo;
    class L,A,B,N nota;
    class F fin;
```

## Reglas comunes

- Misma lógica para una orden en la BD nueva o en la BD vieja. La bitácora
  permanece en la BD nueva en ambos casos.
- Una venta caída sin `custbody209 = T`, o con reserva desconocida, no entra.
  En legacy se usa `reserva_ov`, confirmado por negocio como destino de `custbody209`; en nativa se usa `reservation_applied_sales_order`.
- Checks de entrada ERP: `custbody43` (Venta caída) y `custbody209`
  (Reserva Aplicada). Contrato firmado corresponde a `custbody90`.
- La exclusión incluye Pendientes de aprobación, Por enviar, Pendiente de firma,
  Gestión bancaria, Gestión bancaria en proceso, Pendiente de saldo, Traspaso
  pendiente, Traspaso firmado, Formalizaciones cerradas este año y Pendientes
  de adéndum.
- Antes de validar saldo no se muestran las etiquetas de este circuito
  «Venta caída» y «Contrato firmado»; sus valores ERP permanecen intactos.
- Validar saldo no marca automáticamente Contrato firmado. Si falta ese check,
  se conserva la validación y se bloquea el envío hasta que NetSuite lo confirme.
- Marcar «Finiquito enviado» registra un envío realizado; no afirma que Habita
  haya enviado un correo automáticamente.
- «Formalizada» cierra este circuito de finiquito; no convierte la venta caída
  en una venta activa ni la agrega al banner comercial de cierres.

## Referencias verificadas

- Nombres actuales del banner: `apps/frontend/src/modules/home/FormalizationHomePage.tsx`,
  componente `SettlementPreviewBanner` (conectado a conteos y colas reales).
- Estado local, mapeo `custbody209`, migración075 y pendientes operativos:
  [Reserva Aplicada](Reserva-Aplicada-075.md).
- Reglas funcionales: instrucciones y aclaraciones del propietario en este chat
  del 12 de noviembre de 2026; este archivo no reemplaza esas decisiones por
  el comportamiento verificado. Implementación y migración076: [Finiquito076](Finiquito-076.md).


