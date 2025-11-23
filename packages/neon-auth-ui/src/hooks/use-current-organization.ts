import type { Organization } from "better-auth/plugins/organization"
import { useContext, useMemo } from "react"
import { AuthUIContext } from "../lib/auth-ui-provider"

export function useCurrentOrganization({
    slug: slugProp
}: {
    slug?: string
} = {}) {
    const {
        organization: organizationOptions,
        hooks: { useActiveOrganization, useListOrganizations }
    } = useContext(AuthUIContext)

    const { pathMode, slug: contextSlug } = organizationOptions || {}

    let data: Organization | null | undefined
    let isPending: boolean | undefined
    let isRefetching: boolean | undefined

    let refetch: (() => void) | undefined

    const {
        data: organizations,
        isPending: organizationsPending,
        isRefetching: organizationsRefetching
    } = useListOrganizations()

    if (pathMode === "slug") {
        const slug = slugProp || contextSlug

        data = organizations?.find((organization) => organization.slug === slug)
        isPending = organizationsPending
        isRefetching = organizationsRefetching
    } else {
        const {
            data: activeOrganization,
            isPending: organizationPending,
            isRefetching: organizationRefetching,
            refetch: refetchOrganization
        } = useActiveOrganization()

        refetch = refetchOrganization

        data = activeOrganization
        isPending = organizationPending
        isRefetching = organizationRefetching
    }

    return useMemo(
        () => ({
            data,
            isPending,
            isRefetching,
            refetch
        }),
        [data, isPending, isRefetching, refetch]
    )
}
