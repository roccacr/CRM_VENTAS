import { Prisma } from "@prisma/client";

export type SendSaludoTemplateInput = {
    readonly adminName: string;
    readonly leadId: number;
    readonly leadName: string;
    readonly phoneNumberId: string;
    readonly projectName: string;
    readonly to: string;
};

export type SendSaludoTemplateResult = {
    readonly messageIds: string[];
    readonly rawResponse: Prisma.InputJsonObject;
};
