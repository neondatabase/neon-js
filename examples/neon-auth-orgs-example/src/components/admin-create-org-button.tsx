"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { ShieldPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function AdminCreateOrgButton() {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session?.user as any)?.role !== "admin") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/create-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create org");
      } else {
        toast.success("Organization created (admin)");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (authClient as any).$store.notify("$listOrg");
        setOpen(false);
        setName("");
        setSlug("");
        setError("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        title="Admin: create organization"
      >
        <ShieldPlus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization (Admin)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-org-name">Name</Label>
              <Input
                id="admin-org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Organization"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-org-slug">Slug (optional)</Label>
              <Input
                id="admin-org-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-org"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
