import { useState } from "react";

const photoFiles = import.meta.glob<string>("/public/vendedores/*.{webp,png,jpg,jpeg,avif}", { eager: true, query: "?url", import: "default" });
const photoPaths = Object.keys(photoFiles);
/** Solo una identidad pública nativa elige la foto local. Una foto ausente o rota conserva la ilustración original. */
export function MarketingWelcomeArt({ publicId, name }: { readonly publicId: string | null; readonly name: string }) {
    const [failed, setFailed] = useState(false);
    const path = publicId && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(publicId) ? photoPaths.find((file) => file.slice(file.lastIndexOf("/") + 1).split(".")[0] === publicId) : undefined;
    const photo = path && !failed ? photoFiles[path] : undefined;
    if (photo)
        return (
            <img
                className="marketing-welcome__art marketing-welcome__photo"
                src={photo}
                alt={`Foto de ${name}`}
                width={459}
                height={507}
                decoding="async"
                onError={() => {
                    setFailed(true);
                }}
            />
        );
    return <img className="marketing-welcome__art" src={`${import.meta.env.BASE_URL}illustrations/rocca-marketing-generated.png`} alt="" width={1774} height={887} decoding="async" />;
}
