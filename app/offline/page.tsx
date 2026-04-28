import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div className="max-w-md">
        <WifiOff className="mx-auto mb-4 size-10 text-primary" aria-hidden />
        <h1 className="text-2xl font-semibold">Bạn đang offline</h1>
        <p className="mt-3 text-muted-foreground">
          Một số tài nguyên tĩnh vẫn được cache. Hãy kết nối mạng lại để tham gia quiz realtime.
        </p>
      </div>
    </main>
  );
}
