/** Notes while they load: the cards they will have, in quiet bars, so the panel does not jump when they arrive. */
export function NotesLoading({ label }: { readonly label: string }) {
    return (
        <div className="notes-loading" role="status" aria-busy="true">
            <p>{label}</p>
            {[0, 1, 2].map((card) => (
                <div className="notes-loading__card" key={card} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </div>
            ))}
        </div>
    );
}
