"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { toNeonAuthError } from "@/lib/auth/errors";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building, CheckSquare, Mail, Plus, Settings, User } from "lucide-react";
import { useInvitations } from "@/hooks/use-invitations";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [createError, setCreateError] = useState("");
  const router = useRouter();
  const { data: organizations } = authClient.useListOrganizations();
  const { invitations, accept } = useInvitations();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        router.push("/dashboard/admin");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  function go(path: string) {
    router.push(path);
    setOpen(false);
  }

  async function switchOrg(orgId: string) {
    await authClient.organization.setActive({ organizationId: orgId });
    setOpen(false);
  }

  async function acceptInvitation(inv: Parameters<typeof accept>[0]) {
    await accept(inv);
    setOpen(false);
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    try {
      const result = await authClient.organization.create({
        name: orgName,
        slug: orgSlug || orgName.toLowerCase().replace(/\s+/g, "-"),
      });
      if (result?.error) {
        const { code, message } = result.error;
        const msg = code === "YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS"
          ? "Organization limit reached. Increase the limit in the Neon console."
          : message || "Failed to create organization";
        setCreateError(msg);
        return;
      }
      toast.success("Organization created");
      setCreateOpen(false);
      setOrgName("");
      setOrgSlug("");
      setCreateError("");
    } catch (err: unknown) {
      const authErr = toNeonAuthError(err);
      const msg = authErr?.code === "YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS"
        ? "Organization limit reached. Increase the limit in the Neon console."
        : authErr?.message || "Failed to create organization";
      setCreateError(msg);
    }
  }

  return (
    <>
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {invitations.length > 0 && (
          <>
            <CommandGroup heading="Invitations">
              {invitations.map((inv) => (
                <CommandItem
                  key={inv.id}
                  onSelect={() => acceptInvitation(inv)}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Join {inv.organizationName}
                  <span className="ml-auto text-xs text-muted-foreground">
                    as {inv.role}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => go("/dashboard")}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Todos
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/admin")}>
            <Settings className="mr-2 h-4 w-4" />
            Admin
          </CommandItem>
          <CommandItem onSelect={() => go("/account/settings")}>
            <User className="mr-2 h-4 w-4" />
            Account Settings
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Organizations">
          {organizations?.map((org) => (
            <CommandItem
              key={org.id}
              onSelect={() => switchOrg(org.id)}
            >
              <Building className="mr-2 h-4 w-4" />
              {org.name}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => { setOpen(false); setCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            New Organization
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
    <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setCreateError(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
        </DialogHeader>
        <form onSubmit={createOrg} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cmd-org-name">Name</Label>
            <Input
              id="cmd-org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="My Organization"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmd-org-slug">Slug (optional)</Label>
            <Input
              id="cmd-org-slug"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              placeholder="my-org"
            />
          </div>
          {createError && (
            <p className="text-sm text-destructive">{createError}</p>
          )}
          <Button type="submit" className="w-full">
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
