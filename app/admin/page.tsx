import { Flag, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <main className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Moderation</h1>
        <p className="mt-2 text-muted-foreground">
          Khu vực dành cho admin để xử lý báo cáo, khóa phòng và xem audit logs.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Flag className="size-5 text-destructive" aria-hidden />
              Báo cáo cần xem
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Kết nối bảng moderation_reports để hiển thị câu hỏi/phòng bị báo cáo.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldAlert className="size-5 text-primary" aria-hidden />
              Audit logs
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Theo dõi tạo phòng, nộp đáp án, khóa tài khoản và hành động admin.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
