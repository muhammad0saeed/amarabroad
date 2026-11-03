import { ClientMessages } from "@/components/layout/ClientMessages";
import { initPage } from "@/lib/server";

// UI text this section's client components use in the browser.
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await initPage(params);
  return <ClientMessages namespaces={["search", "program", "fit", "labels", "chat", "parent", "forms", "common"]}>{children}</ClientMessages>;
}
