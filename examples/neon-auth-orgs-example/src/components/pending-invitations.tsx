"use client";

import { authClient } from "@/lib/auth/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
}

export function PendingInvitations() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const queryClient = useQueryClient();

  const { data: invitations = [] } = useQuery({
    queryKey: ["org-invitations", activeOrg?.id],
    queryFn: async () => {
      const { data } = await authClient.organization.listInvitations({
        query: { organizationId: activeOrg!.id },
      });
      if (!data) return [];
      const list = (Array.isArray(data) ? data : []) as Invitation[];
      return list.filter((i) => i.status === "pending");
    },
    enabled: !!activeOrg,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId: id,
      });
      if (error) throw new Error("Failed to cancel invitation");
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["org-invitations", activeOrg?.id] });
      const previous = queryClient.getQueryData<Invitation[]>(["org-invitations", activeOrg?.id]);
      queryClient.setQueryData<Invitation[]>(
        ["org-invitations", activeOrg?.id],
        (prev = []) => prev.filter((i) => i.id !== id)
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success("Invitation cancelled");
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["org-invitations", activeOrg?.id], context.previous);
      }
      toast.error("Failed to cancel invitation");
    },
  });

  if (invitations.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Pending Invitations</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell>{inv.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{inv.role}</Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => cancelMutation.mutate(inv.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
