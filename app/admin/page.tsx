import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";

export const metadata: Metadata = { title: "Laundry admin", robots: { index: false } };

export default function AdminPage() {
  return <AdminPanel />;
}
