import { SDK_VERSION } from "firebase/app";

import { createMessagingWorker } from "@/lib/firebase/worker-source";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(
    createMessagingWorker(
      {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      },
      SDK_VERSION,
    ),
    {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Service-Worker-Allowed": "/",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; script-src 'self' https://www.gstatic.com; connect-src https: http://localhost:* http://127.0.0.1:*",
      },
    },
  );
}
