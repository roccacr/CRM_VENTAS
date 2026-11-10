import { useState } from "react";

const photoFiles = import.meta.glob<string>("/public/vendedores/*.{webp,png,jpg,jpeg,avif}", { eager: true, query: "?url", import: "default" });
const photoPaths = Object.keys(photoFiles);

/** Las fotos se buscan por el id público del vendedor, que es el nombre del archivo. El nombre de la persona puede repetirse o cambiar. */
const PUBLIC_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** URL de la foto local nombrada con el id público. Indefinida si el id falta, está mal formado o no tiene archivo. */
function photoUrl(publicId: string | null): string | undefined {
    if (!publicId || !PUBLIC_ID.test(publicId)) return undefined;
    const path = photoPaths.find((file) => file.slice(file.lastIndexOf("/") + 1).split(".")[0] === publicId);
    return path ? photoFiles[path] : undefined;
}

/** Miniatura de un vendedor, con esquinas redondeadas. Si no hay foto, o si no carga, se conserva la ilustración de mercadeo que ya existe. */
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

/** Miniatura y después el nombre: así se muestra un vendedor en todo el reporte. */
export function SellerChip({ publicId, name, size, decorative }: { readonly publicId: string | null; readonly name: string; readonly size?: number; readonly decorative?: boolean }) {
    return (
        <span className="seller-chip">
            <SellerAvatar publicId={publicId} name={name} decorative={decorative ?? false} {...(size ? { size } : {})} />
            <span>{name}</span>
        </span>
    );
}
