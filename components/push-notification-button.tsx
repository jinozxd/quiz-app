"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PushNotificationButton() {
  return (
    <Button
      size="lg"
      variant="outline"
      onClick={async () => {
        if (!("Notification" in window)) {
          return;
        }
        await Notification.requestPermission();
      }}
    >
      <Bell className="mr-2 size-4" aria-hidden />
      Bật thông báo
    </Button>
  );
}
