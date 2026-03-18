"use client";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function AdminOrgSettings() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const { data: activeMember } = authClient.useActiveMember();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeOrg) {
      setName(activeOrg.name);
      setSlug(activeOrg.slug || "");
    }
  }, [activeOrg?.id, activeOrg?.name, activeOrg?.slug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await authClient.organization.update({
      data: { name, slug },
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to update organization");
    } else {
      toast.success("Organization updated");
    }
  }

  async function handleDelete() {
    if (!activeOrg) return;
    if (
      !confirm(
        "Are you sure? This will delete the organization and all its data."
      )
    )
      return;

    const { error } = await authClient.organization.delete({
      organizationId: activeOrg.id,
    });
    if (error) {
      toast.error("Failed to delete organization");
    } else {
      toast.success("Organization deleted");
      window.location.href = "/dashboard";
    }
  }

  if (!activeOrg) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
        {activeMember?.role === "owner" && (
          <>
            <Separator />
            <div>
              <h3 className="text-sm font-medium text-destructive mb-2">
                Danger Zone
              </h3>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                Delete Organization
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
