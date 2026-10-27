import { useState } from "react";

const photoFiles = import.meta.glob<string>("/public/vendedores/*.{webp,png,jpg,jpeg,avif}", { eager: true, query: "?url", import: "default" });
const photoPaths = Object.keys(photoFiles);

/** Photos are looked up by the seller's public id (the file name), never by name; a name can repeat or change. */
const PUBLIC_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** URL of the local photo named after the public id, or undefined when the id is missing, malformed or has no file. */
function photoUrl(publicId: string | null): string | undefined {
    if (!publicId || !PUBLIC_ID.test(publicId)) return undefined;
    const path = photoPaths.find((file) => file.slice(file.lastIndexOf("/") + 1).split(".")[0] === publicId);
    return path ? photoFiles[path] : undefined;
}

/** Round-cornered thumbnail of a seller. Without a photo (or if it fails to load) it preserves the existing marketing illustration. */
export function SellerAvatar({ publicId, name, size = 36, decorative = false }: { readonly publicId: string | null; readonly name: string; readonly size?: number; readonly decorative?: boolean }) {
    const [failedId, setFailedId] = useState<string | null>(null);
    const photo = publicId === failedId ? undefined : photoUrl(publicId);
    if (photo)
        return (
            <img
                className="seller-avatar"
                src={photo}
                alt={decorative ? "" : `Foto de ${name}`}
                width={size}
                height={size}
                style={{ width: size, height: size }}
                decoding="async"
                onError={() => {
                    setFailedId(publicId);
                }}
            />
        );
    return <img className="seller-avatar" src={`${import.meta.env.BASE_URL}illustrations/rocca-marketing-generated.png`} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: "cover" }} decoding="async" />;
}

/** Thumbnail followed by the name: how a seller is shown everywhere in the report. */
export function SellerChip({ publicId, name, size, decorative }: { readonly publicId: string | null; readonly name: string; readonly size?: number; readonly decorative?: boolean }) {
    return (
        <span className="seller-chip">
            <SellerAvatar publicId={publicId} name={name} decorative={decorative ?? false} {...(size ? { size } : {})} />
            <span>{name}</span>
        </span>
    );
}
