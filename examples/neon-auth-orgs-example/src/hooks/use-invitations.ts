"use client";

import { authClient } from "@/lib/auth/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface UserInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  role: string;
  status: string;
}

export function useInvitations() {
  const { data: organizations } = authClient.useListOrganizations();
  const queryClient = useQueryClient();

  const { data: invitations = [] } = useQuery({
    queryKey: ["user-invitations", organizations?.map((o) => o.id)],
    queryFn: async () => {
      const { data } = await authClient.organization.listUserInvitations();
      if (!data) return [];
      const list = (Array.isArray(data) ? data : []) as UserInvitation[];
      return list.filter((i) => i.status === "pending");
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (inv: UserInvitation) => {
      await authClient.organization.acceptInvitation({
        invitationId: inv.id,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (authClient as any).$store.notify("$listOrg");
      await authClient.organization.setActive({
        organizationId: inv.organizationId,
      });
      return inv;
    },
    onSuccess: (inv) => {
      toast.success(`Joined ${inv.organizationName}`);
      queryClient.invalidateQueries({ queryKey: ["user-invitations"] });
    },
    onError: () => {
      toast.error("Failed to accept invitation");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (inv: UserInvitation) => {
      await authClient.organization.rejectInvitation({
        invitationId: inv.id,
      });
      return inv;
    },
    onMutate: async (inv) => {
      await queryClient.cancelQueries({ queryKey: ["user-invitations"] });
      const previous = queryClient.getQueryData<UserInvitation[]>(["user-invitations"]);
      queryClient.setQueriesData<UserInvitation[]>(
        { queryKey: ["user-invitations"] },
        (prev = []) => prev.filter((i) => i.id !== inv.id)
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success("Invitation declined");
    },
    onError: (_err, _inv, context) => {
      if (context?.previous) {
        queryClient.setQueriesData(
          { queryKey: ["user-invitations"] },
          context.previous
        );
      }
      toast.error("Failed to decline invitation");
    },
  });

  return {
    invitations,
    accept: acceptMutation.mutateAsync,
    reject: rejectMutation.mutate,
  };
}
