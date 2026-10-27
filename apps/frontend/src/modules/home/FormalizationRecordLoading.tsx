import { LoadingOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";

const HIGHLIGHTS = [0, 1, 2, 3, 4];
const CHAPTERS = [4, 8, 4];
const ROWS = [0, 1, 2];

function Bar({ width, tall }: { readonly width: string; readonly tall?: boolean }) {
    return <span className={tall ? "record-skel record-skel--tall" : "record-skel"} style={{ width }} />;
}

/**
 * The order record while its data loads: the same frame as the finished page (key facts, section bar, framed sections, side panel),
 * so nothing jumps when the data arrives. The text is for screen readers and stays visible only as a quiet caption.
 */
export function FormalizationRecordLoading({ complete = false, actions }: { readonly complete?: boolean; readonly actions?: ReactNode }) {
    return (
        <div className="record-page record-loading" role="status" aria-busy="true" aria-label="Datos de la orden">
            <div className="record-loading__status">
                <p>
                    <LoadingOutlined aria-hidden="true" />
                    <strong>Cargando datos de la orden…</strong>
                    <span>Estamos consultando el sistema de origen; puede tardar unos segundos.</span>
                </p>
                <span className="record-loading__track" aria-hidden="true" />
            </div>
            {complete && (
                <>
                    <header className="global-home-page-header formalization-page-header record-loading__header">
                        <div className="record-loading__identity" aria-hidden="true">
                            <Bar width="70%" />
                            <Bar width="100%" tall />
                        </div>
                        {actions}
                    </header>
                    <section className="formalization-card record-loading__progress" aria-hidden="true">
                        <div className="record-loading__band">
                            <Bar width="220px" />
                        </div>
                        <div className="record-loading__stages">
                            {Array.from({ length: 7 }, (_, index) => (
                                <div key={index}>
                                    <span className="record-skel record-loading__circle" />
                                    <Bar width="75%" />
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            )}
            <div className="record-highlights" aria-hidden="true">
                {HIGHLIGHTS.map((key) => (
                    <div key={key}>
                        <Bar width="40%" />
                        <Bar width="70%" tall />
                    </div>
                ))}
            </div>
            <div className="record-bar" aria-hidden="true">
                <Bar width="260px" />
            </div>
            <div className="record-workspace" aria-hidden="true">
                <div className="record-main">
                    {CHAPTERS.map((cells, index) => (
                        <section className="record-chapter" key={index}>
                            <h2 className="record-loading__band">
                                <Bar width="160px" />
                            </h2>
                            <div className="record-loading__grid">
                                {Array.from({ length: cells }, (_, cell) => (
                                    <div key={cell}>
                                        <Bar width="50%" />
                                        <Bar width="80%" tall />
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
                <aside className="record-rail">
                    <section className="record-rail__money">
                        <Bar width="30%" tall />
                        {ROWS.map((row) => (
                            <div className="record-loading__line" key={row}>
                                <Bar width="40%" />
                                <Bar width="25%" />
                            </div>
                        ))}
                    </section>
                    <section className="record-rail__checks">
                        <Bar width="30%" tall />
                        {[...ROWS, 3, 4].map((row) => (
                            <div className="record-loading__line" key={row}>
                                <Bar width="55%" />
                                <Bar width="12%" />
                            </div>
                        ))}
                    </section>
                </aside>
            </div>
        </div>
    );
}
