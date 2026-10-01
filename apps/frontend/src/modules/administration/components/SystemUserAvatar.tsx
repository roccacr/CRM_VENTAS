import { useState } from "react";

import { buildSystemUserPhotoUrl, getAvatarTone, getInitials, type SystemUserListItem } from "../system-users.model";

/**
 * Avatar del directorio.
 *
 * Si la foto falla, se guardan publicId y URL juntos. Cambiar la foto vuelve
 * a intentar; un error viejo no esconde la imagen nueva.
 */
export function SystemUserAvatar({ user }: { readonly user: SystemUserListItem }) {
    const imageKey = `${user.publicId}:${user.profileImageUrl ?? ""}`;
    const [failedImageKey, setFailedImageKey] = useState<string | null>(null);
    const imageSrc = user.profileImageUrl && failedImageKey !== imageKey ? buildSystemUserPhotoUrl(user.profileImageUrl) : null;
    const avatarClassName = `administration-users-avatar administration-users-avatar--tone-${String(getAvatarTone(user))}`;

    return (
        <span className={avatarClassName} aria-hidden="true">
            {imageSrc ? (
                <img
                    src={imageSrc}
                    alt=""
                    onError={() => {
                        setFailedImageKey(imageKey);
                    }}
                />
            ) : (
                <span>{getInitials(user.name)}</span>
            )}
        </span>
    );
}
