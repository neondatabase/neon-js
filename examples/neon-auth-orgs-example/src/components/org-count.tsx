"use client";

import { authClient } from "@/lib/auth/client";

export function OrgCount() {
  const { data: orgs } = authClient.useListOrganizations();

  return (
    <span className="text-xs text-muted-foreground">
      Orgs: {orgs?.length ?? 0}
    </span>
  );
}
