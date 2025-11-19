export type Invitation = {
    id: string
    organizationId: string
    email: string
    role: string
    status: string
    inviterId: string
    expiresAt: Date
    teamId?: string | undefined
}
