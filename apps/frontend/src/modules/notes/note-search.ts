const plain = (text: string): string =>
    text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

/** Reduce las notas ya cargadas por lo que se escribe: título, texto y autor, sin distinguir mayúsculas ni acentos. Una búsqueda vacía deja pasar todo. */
export function matchesNote(note: { readonly title: string | null; readonly content: { readonly text: string }; readonly author: { readonly displayName: string } }, query: string): boolean {
    const needle = plain(query.trim());
    if (!needle) return true;
    return plain(`${note.title ?? ""} ${note.content.text} ${note.author.displayName}`).includes(needle);
}
