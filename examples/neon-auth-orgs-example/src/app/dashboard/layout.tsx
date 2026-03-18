import { OrgSwitcher } from "@/components/org-switcher";
import { NotificationsMenu } from "@/components/notifications-menu";
import { CommandMenu } from "@/components/command-menu";
import { AdminCreateOrgButton } from "@/components/admin-create-org-button";
import { OrgCount } from "@/components/org-count";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container max-w-2xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <OrgSwitcher />
        <div className="flex items-center gap-2">
          <OrgCount />
          <AdminCreateOrgButton />
          <NotificationsMenu />
          <Link href="/dashboard/admin">
            <Button variant="outline" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
      {children}
      <CommandMenu />
    </div>
  );
}
