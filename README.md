# Campus Quiz

Starter nền cho web cộng đồng làm quiz trong trường học.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- shadcn/ui style components, lucide-react, Framer Motion
- Next.js Route Handlers + Zod
- Supabase Auth, Postgres, Realtime, RLS
- PWA manifest, service worker, offline page, install button, push subscription endpoint
- Vercel-ready deployment

## Chạy local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở `http://localhost:3000`.

## Việc cần cấu hình trước production

- Điền Supabase URL, anon key, service role key trong `.env.local`.
- Chạy migration trong `supabase/migrations`.
- Bật CAPTCHA provider và điền Turnstile keys.
- Tạo PNG icon sizes nếu muốn tối ưu PWA store/install prompt hơn SVG starter.
- Đổi rate limiting in-memory sang Redis/Upstash khi deploy nhiều instance.
- Bật HTTPS qua Vercel domain.
