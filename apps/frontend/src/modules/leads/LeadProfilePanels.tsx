import type { LeadProfileResult } from "../../services/leads/lead-profile-service";
import { infoBlocks } from "./lead-profile-model";
import { InfoBlockCard, InfoHero } from "./LeadProfileFields";

/** La vista consolidada: introducción, luego el resumen base, el contexto complementario y la trazabilidad del registro. */
export function ConsolidatedPanel({ data }: { readonly data: LeadProfileResult }) {
    const blocks = infoBlocks(data.sections);
    return (
        <div className="profile-stack">
            <InfoHero />
            {blocks.map((block) => (
                <InfoBlockCard key={block.id} block={block} multiSource={data.sources.length > 1} />
            ))}
            {blocks.length === 0 && <p className="profile-card__empty">Sin información registrada para este cliente.</p>}
        </div>
    );
}
