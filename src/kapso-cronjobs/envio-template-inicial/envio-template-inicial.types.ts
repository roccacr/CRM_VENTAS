type EnvioTemplateInicialRunStatus = "completed" | "disabled" | "already_running";

export type EnvioTemplateInicialRunResult = {
    readonly failed: number;
    readonly processed: number;
    readonly sent: number;
    readonly skipped: number;
    readonly status: EnvioTemplateInicialRunStatus;
};

export type ProcessLeadResult = "failed" | "sent" | "skipped";
