import { Footer } from "@/components/store/Footer";
import { Header } from "@/components/store/Header";
import { SetupNotice } from "@/components/ui/SetupNotice";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <SetupNotice />
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
