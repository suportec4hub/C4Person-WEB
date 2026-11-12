import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";
import { CookieBanner } from "@/components/CookieBanner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const APP_URL = "https://c4person.com.br";
const APP_NAME = "C4Person";
const TITLE = "C4Person — Gestão de Tarefas, Hábitos, Finanças e IA em Um Só Lugar";
const DESCRIPTION =
  "C4Person é o app de produtividade all-in-one para brasileiros. Gerencie tarefas, metas, hábitos, finanças pessoais e notas com IA — tudo integrado por R$15,90/mês.";
const KEYWORDS = [
  "gestão de tarefas",
  "produtividade pessoal",
  "controle financeiro pessoal",
  "hábitos diários",
  "metas pessoais",
  "app de produtividade brasileiro",
  "notas com inteligência artificial",
  "agenda com IA",
  "organização pessoal",
  "planejador diário",
  "C4Person",
];

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: TITLE,
    template: `%s | ${APP_NAME}`,
  },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  authors: [{ name: "C4Person", url: APP_URL }],
  creator: "C4Person",
  publisher: "C4Person",
  category: "productivity",
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: APP_URL,
    languages: { "pt-BR": APP_URL },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: APP_URL,
    siteName: APP_NAME,
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: `${APP_URL}/og`,
        width: 1200,
        height: 630,
        alt: "C4Person — Gestão de Tarefas, Hábitos, Finanças e IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${APP_URL}/og`],
    creator: "@c4person",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

// ── Pixel IDs from env vars (set in Vercel → Settings → Environment Variables) ──
const GTM_ID       = process.env.NEXT_PUBLIC_GTM_ID;
const META_PIXEL   = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GA4_ID       = process.env.NEXT_PUBLIC_GA4_ID;
const CLARITY_ID   = process.env.NEXT_PUBLIC_CLARITY_ID;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* Theme flicker prevention */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.add('light')}else{document.documentElement.classList.remove('light')}}catch(e){}})();` }} />

        {/* ── Google Tag Manager ── */}
        {GTM_ID && (
          <script dangerouslySetInnerHTML={{ __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');` }} />
        )}

        {/* ── Google Analytics 4 (standalone, se não usar GTM) ── */}
        {GA4_ID && !GTM_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`} />
            <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_ID}');` }} />
          </>
        )}

        {/* ── Microsoft Clarity (heatmaps + session recordings) ── */}
        {CLARITY_ID && (
          <script dangerouslySetInnerHTML={{ __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");` }} />
        )}
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground`}>

        {/* GTM noscript fallback */}
        {GTM_ID && (
          <noscript>
            <iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
          </noscript>
        )}

        {/* ── Meta (Facebook/Instagram) Pixel ── */}
        {META_PIXEL && (
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${META_PIXEL}');
            fbq('track','PageView');
          `}</Script>
        )}

        <PWARegister />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
