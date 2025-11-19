import { useContext, useEffect } from "react"
import { useCurrentOrganization } from "../hooks/use-current-organization"
import { AuthUIContext } from "./auth-ui-provider"

export const OrganizationRefetcher = () => {
    const {
        hooks: { useListOrganizations, useSession },
        organization: organizationOptions,
        navigate,
        redirectTo
    } = useContext(AuthUIContext)

    const { slug, pathMode, personalPath } = organizationOptions || {}

    const { data: sessionData } = useSession()

    const {
        data: organization,
        isPending: organizationPending,
        isRefetching: organizationRefetching,
        refetch: refetchOrganization
    } = useCurrentOrganization()

    const { refetch: refetchListOrganizations } = useListOrganizations()

    const { data: organizations } = useListOrganizations()

    // biome-ignore lint/correctness/useExhaustiveDependencies: Refetch fix
    useEffect(() => {
        if (!sessionData?.user.id) return

        if (organization || organizations) {
            refetchOrganization?.()
            refetchListOrganizations?.()
        }
    }, [sessionData?.user.id])

    useEffect(() => {
        if (organizationRefetching || organizationPending) return

        if (slug && pathMode === "slug" && !organization) {
            navigate(personalPath || redirectTo)
        }
    }, [
        organization,
        organizationRefetching,
        organizationPending,
        slug,
        pathMode,
        personalPath,
        navigate,
        redirectTo
    ])

    return null
}
