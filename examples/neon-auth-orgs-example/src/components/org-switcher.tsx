"use client";

import { authClient } from "@/lib/auth/client";
import { toNeonAuthError } from "@/lib/auth/errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function OrgSwitcher() {
  const { data: organizations } = authClient.useListOrganizations();
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [optimisticId, setOptimisticId] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [highlight, setHighlight] = useState({ left: 0, width: 0, ready: false });

  const orgs = organizations ?? [];
  const displayActiveId = optimisticId ?? activeOrg?.id;
  const activeIndex = orgs.findIndex((o) => o.id === displayActiveId);

  // Measure and animate the highlight
  useLayoutEffect(() => {
    if (!displayActiveId) return;
    const tab = tabRefs.current.get(displayActiveId);
    const container = tabsRef.current;
    if (!tab || !container) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();

    setHighlight({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
      ready: true,
    });
  }, [displayActiveId, orgs]);

  // Sync optimistic state when the hook catches up
  useEffect(() => {
    if (optimisticId && activeOrg?.id === optimisticId) {
      setOptimisticId(null);
    }
  }, [activeOrg?.id, optimisticId]);

  const switchTo = useCallback(
    (orgId: string) => {
      setOptimisticId(orgId);
      authClient.organization.setActive({ organizationId: orgId });
    },
    []
  );

  const switchByIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < orgs.length) {
        switchTo(orgs[index].id);
      }
    },
    [orgs, switchTo]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.altKey) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (activeIndex > 0) switchByIndex(activeIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (activeIndex < orgs.length - 1) switchByIndex(activeIndex + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, orgs.length, switchByIndex]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    try {
      const result = await authClient.organization.create({
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
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
      setOpen(false);
      setName("");
      setSlug("");
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
      <div
        ref={tabsRef}
        className="relative flex items-center gap-0.5 rounded-lg bg-muted p-1"
        role="tablist"
      >
        {highlight.ready && (
          <div
            className="absolute rounded-md bg-primary shadow-sm transition-all duration-200 ease-out"
            style={{
              left: highlight.left,
              width: highlight.width,
              top: 4,
              bottom: 4,
            }}
          />
        )}
        {orgs.map((org) => (
          <button
            key={org.id}
            ref={(el) => {
              if (el) tabRefs.current.set(org.id, el);
              else tabRefs.current.delete(org.id);
            }}
            role="tab"
            aria-selected={org.id === displayActiveId}
            className={cn(
              "relative z-10 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
              "hover:text-foreground",
              org.id === displayActiveId
                ? "text-primary-foreground"
                : "text-muted-foreground"
            )}
            onClick={() => switchTo(org.id)}
          >
            {org.name}
          </button>
        ))}
        <button
          className="relative z-10 px-2 py-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
          onClick={() => setOpen(true)}
          aria-label="Create organization"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCreateError(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
          </DialogHeader>
          <form onSubmit={createOrg} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Organization"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">Slug (optional)</Label>
              <Input
                id="org-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
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
