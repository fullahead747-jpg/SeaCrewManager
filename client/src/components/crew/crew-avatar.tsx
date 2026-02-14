import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAuthHeaders } from '@/lib/auth';
import type { Document } from '@shared/schema';
import { cn } from '@/lib/utils';

interface CrewAvatarProps {
    memberId: string;
    documents?: Document[];
    firstName?: string | null;
    lastName?: string | null;
    className?: string;
    fallbackClassName?: string;
    showInitials?: boolean;
}

export const CrewAvatar: React.FC<CrewAvatarProps> = ({
    memberId,
    documents = [],
    firstName,
    lastName,
    className,
    fallbackClassName,
    showInitials = false
}) => {
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        // Find the specific photo document for THIS crew member
        const photoDoc = documents.find(d =>
            d.crewMemberId === memberId &&
            d.type.toLowerCase() === 'photo' &&
            d.filePath
        );

        if (photoDoc && photoDoc.id) {
            let isMounted = true;
            const fetchAvatar = async () => {
                try {
                    const response = await fetch(`/api/documents/${photoDoc.id}/view`, {
                        headers: getAuthHeaders()
                    });
                    if (response.ok && isMounted) {
                        const blob = await response.blob();
                        const url = URL.createObjectURL(blob);
                        setAvatarUrl(url);
                    }
                } catch (error) {
                    console.error(`Failed to fetch avatar for ${memberId}:`, error);
                }
            };
            fetchAvatar();

            return () => {
                isMounted = false;
                if (avatarUrl) {
                    URL.revokeObjectURL(avatarUrl);
                }
            };
        } else {
            setAvatarUrl(null);
        }
    }, [memberId, documents]);

    const getInitials = () => {
        if (!firstName && !lastName) return '?';
        return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
    };

    return (
        <Avatar className={cn("bg-slate-100", className)}>
            {avatarUrl ? (
                <AvatarImage
                    src={avatarUrl}
                    alt={firstName && lastName ? `${firstName} ${lastName}` : "Crew Member"}
                    className="object-cover"
                />
            ) : null}
            <AvatarFallback className={cn("bg-slate-100 text-slate-400", fallbackClassName)}>
                {showInitials ? getInitials() : null}
            </AvatarFallback>
        </Avatar>
    );
};
