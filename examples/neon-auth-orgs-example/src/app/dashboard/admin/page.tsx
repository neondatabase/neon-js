"use client";

import { authClient } from "@/lib/auth/client";
import { AdminOrgSettings } from "@/components/admin-org-settings";
import { AdminMembersTable } from "@/components/admin-members-table";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { PendingInvitations } from "@/components/pending-invitations";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function AdminPage() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const router = useRouter();
  const inviteRef = useRef<{ open: () => void }>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;

      if (e.key === "Escape") {
        e.preventDefault();
        router.push("/dashboard");
      } else if (e.key === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inviteRef.current?.open();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  if (!activeOrg) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Select an organization first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="-ml-2 mb-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Todos
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
      <AdminOrgSettings />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Members</CardTitle>
          <InviteMemberDialog ref={inviteRef} />
        </CardHeader>
        <CardContent className="space-y-6">
          <AdminMembersTable />
          <PendingInvitations />
        </CardContent>
      </Card>
      </div>

      <div className="text-xs text-muted-foreground px-3 mt-6">
        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd>{" "}
        back{" "}
        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">i</kbd>{" "}
        invite{" "}
        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">⌘K</kbd>{" "}
        menu
      </div>
    </div>
  );
}
