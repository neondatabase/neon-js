"use client";

import { authClient } from "@/lib/auth/client";
import { toNeonAuthError } from "@/lib/auth/errors";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Member {
  id: string;
  userId: string;
  role: string;
  user: { name: string; email: string; image?: string };
  createdAt: Date;
}

export function AdminMembersTable() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ["org-members", activeOrg?.id],
    queryFn: async () => {
      const { data } = await authClient.organization.listMembers({
        query: { organizationId: activeOrg!.id },
      });
      return (data?.members ?? []) as Member[];
    },
    enabled: !!activeOrg,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const { error } = await authClient.organization.updateMemberRole({
        memberId,
        role: role as "admin" | "member" | "owner",
      });
      if (error) throw error;
      return { memberId, role };
    },
    onMutate: async ({ memberId, role }) => {
      await queryClient.cancelQueries({ queryKey: ["org-members", activeOrg?.id] });
      const previous = queryClient.getQueryData<Member[]>(["org-members", activeOrg?.id]);
      queryClient.setQueryData<Member[]>(
        ["org-members", activeOrg?.id],
        (prev = []) => prev.map((m) => (m.id === memberId ? { ...m, role } : m))
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success("Role updated");
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["org-members", activeOrg?.id], context.previous);
      }
      const authErr = toNeonAuthError(err);
      toast.error(authErr?.message || "Failed to update role");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
      });
      if (error) throw error;
      return memberId;
    },
    onMutate: async (memberId) => {
      await queryClient.cancelQueries({ queryKey: ["org-members", activeOrg?.id] });
      const previous = queryClient.getQueryData<Member[]>(["org-members", activeOrg?.id]);
      queryClient.setQueryData<Member[]>(
        ["org-members", activeOrg?.id],
        (prev = []) => prev.filter((m) => m.id !== memberId)
      );
      return { previous };
    },
    onSuccess: () => {
      toast.success("Member removed");
    },
    onError: (err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["org-members", activeOrg?.id], context.previous);
      }
      const authErr = toNeonAuthError(err);
      if (authErr?.code === "YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER") {
        toast.error("You cannot leave the organization as the only owner.");
      } else {
        toast.error(authErr?.message || "Failed to remove member");
      }
    },
  });

  function removeMember(memberId: string) {
    if (!confirm("Remove this member from the organization?")) return;
    removeMemberMutation.mutate(memberId);
  }

  if (!activeOrg || members.length === 0) {
    return (
      <div className="text-muted-foreground text-sm py-4 text-center">
        No members found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-medium">
              {member.user?.name || "\u2014"}
            </TableCell>
            <TableCell>{member.user?.email || "\u2014"}</TableCell>
            <TableCell>
              <Select
                value={member.role}
                onValueChange={(v) =>
                  updateRoleMutation.mutate({ memberId: member.id, role: v })
                }
              >
                <SelectTrigger className="w-[120px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    <Badge variant="default">Owner</Badge>
                  </SelectItem>
                  <SelectItem value="admin">
                    <Badge variant="secondary">Admin</Badge>
                  </SelectItem>
                  <SelectItem value="member">
                    <Badge variant="outline">Member</Badge>
                  </SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => removeMember(member.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
