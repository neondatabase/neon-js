"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, Check, X } from "lucide-react";
import { useState } from "react";
import { useInvitations } from "@/hooks/use-invitations";

export function NotificationsMenu() {
  const { invitations, accept, reject } = useInvitations();
  const [accepting, setAccepting] = useState<string | null>(null);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {invitations.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {invitations.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Notifications</h4>
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No pending invitations.
            </p>
          ) : (
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {inv.organizationName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Invited as {inv.role}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="default"
                      size="icon"
                      className="h-7 w-7"
                      disabled={accepting === inv.id}
                      onClick={async () => {
                        setAccepting(inv.id);
                        await accept(inv);
                        setAccepting(null);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={accepting === inv.id}
                      onClick={() => reject(inv)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
