"use client"

import { useContext } from "react"

import { AuthUIContext } from "../../lib/auth-ui-provider"
import { cn } from "../../lib/utils"
import type { AuthLocalization } from "../../localization/auth-localization"
import type { SettingsCardClassNames } from "../settings/shared/settings-card"
import { DeleteOrganizationCard } from "./delete-organization-card"
import { OrganizationLogoCard } from "./organization-logo-card"
import { OrganizationNameCard } from "./organization-name-card"
import { OrganizationSlugCard } from "./organization-slug-card"

export type OrganizationSettingsCardsProps = {
    className?: string
    classNames?: {
        card?: SettingsCardClassNames
        cards?: string
    }
    localization?: Partial<AuthLocalization>
    slug?: string
}

export function OrganizationSettingsCards({
    className,
    classNames,
    localization,
    slug
}: OrganizationSettingsCardsProps) {
    const { organization: organizationOptions } = useContext(AuthUIContext)

    return (
        <div
            className={cn(
                "flex w-full flex-col gap-4 md:gap-6",
                className,
                classNames?.cards
            )}
        >
            {organizationOptions?.logo && (
                <OrganizationLogoCard
                    classNames={classNames?.card}
                    localization={localization}
                    slug={slug}
                />
            )}

            <OrganizationNameCard
                classNames={classNames?.card}
                localization={localization}
                slug={slug}
            />

            <OrganizationSlugCard
                classNames={classNames?.card}
                localization={localization}
                slug={slug}
            />

            <DeleteOrganizationCard
                classNames={classNames?.card}
                localization={localization}
                slug={slug}
            />
        </div>
    )
}
