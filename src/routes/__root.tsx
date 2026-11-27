import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { shareImage } from "@/lib/share-image";
import appCss from "../styles.css?url";

const APP_NAME = "موسوعة الكتاب المقدس";
const DESCRIPTION =
  "فهرس عربي لموسوعة الكتاب المقدس. ابحث في العناوين، وافتح القسم، واقرأ النص حين يكون مرفوعاً.";

export const Route = createRootRoute({
  head: () => {
    const image = shareImage();
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: APP_NAME },
        { name: "description", content: DESCRIPTION },
        { name: "theme-color", content: "#f3eee6" },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "ar_AR" },
        { property: "og:title", content: APP_NAME },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:image", content: image },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:type", content: "image/jpeg" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: APP_NAME },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:image", content: image },
      ],
      links: [
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "stylesheet", href: appCss },
        { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      ],
    };
  },
  component: () => (
    <html lang="ar" dir="rtl" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
});
