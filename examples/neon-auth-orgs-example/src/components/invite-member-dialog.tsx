"use client";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export interface InviteMemberDialogHandle {
  open: () => void;
}

export const InviteMemberDialog = forwardRef<InviteMemberDialogHandle>(
  function InviteMemberDialog(_, ref) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"member" | "admin">("member");
    const [submitting, setSubmitting] = useState(false);
    const queryClient = useQueryClient();

    useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

    async function handleInvite(e: React.FormEvent) {
      e.preventDefault();
      setSubmitting(true);
      try {
        const { error } = await authClient.organization.inviteMember({
          email,
          role,
        });
        setSubmitting(false);
        if (error) {
          toast.error("Failed to send invitation");
        } else {
          toast.success(`Invitation sent to ${email}`);
          queryClient.invalidateQueries({ queryKey: ["org-invitations"] });
          setOpen(false);
          setEmail("");
          setRole("member");
        }
      } catch (err: unknown) {
        setSubmitting(false);
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(msg || "Failed to send invitation");
      }
    }

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as "member" | "admin")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending..." : "Send Invitation"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);
