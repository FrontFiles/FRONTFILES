import type { Metadata } from "next";
import { GlobalNav } from "@/components/GlobalNav";
import { UserProvider } from "@/lib/user-context";
import { TransactionProvider } from "@/lib/transaction/context";
import { DraftStoreProvider } from "@/lib/post/draft-store";
import { GlobalShareComposer } from "@/components/composer-share/GlobalShareComposer";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Frontfiles",
  description: "A provenance-first marketplace for editorial work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full overflow-hidden antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,300;1,6..72,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full flex flex-col overflow-hidden">
        <UserProvider>
          <TransactionProvider>
            <DraftStoreProvider>
              <GlobalNav />
              {children}
              <GlobalShareComposer />
            </DraftStoreProvider>
          </TransactionProvider>
        </UserProvider>
      </body>
    </html>
  );
}
