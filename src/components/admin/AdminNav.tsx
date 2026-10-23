"use client";

import {
  BarChart3, Boxes, ClipboardList, FileText, Image as ImageIcon, LifeBuoy, Mail, MessageSquare, Package,
  ScrollText, Settings, Tag, Tags, Undo2, Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: BarChart3, admin: false },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, admin: false },
  { href: "/admin/returns", label: "Returns", icon: Undo2, admin: false },
  { href: "/admin/products", label: "Products", icon: Package, admin: true },
  { href: "/admin/categories", label: "Collections", icon: Tags, admin: true },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, admin: false },
  { href: "/admin/customers", label: "Customers", icon: Users, admin: false },
  { href: "/admin/coupons", label: "Coupons", icon: Tag, admin: true },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquare, admin: false },
  { href: "/admin/banners", label: "Homepage", icon: ImageIcon, admin: true },
  { href: "/admin/content", label: "Pages & policies", icon: FileText, admin: true },
  { href: "/admin/support", label: "Support", icon: LifeBuoy, admin: false },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail, admin: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, admin: true },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText, admin: true },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
        {ITEMS.filter((i) => isAdmin || !i.admin).map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap ${active ? "bg-saffron text-walnut font-semibold" : "text-ivory/80 hover:bg-white/10 hover:text-ivory"}`}
              >
                <Icon size={17} aria-hidden="true" /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
