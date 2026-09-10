import Link from "next/link";

const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/settings", label: "Settings" },
    { href: "/dashboard/services", label: "Services" },
    { href: "/dashboard/clients", label: "Clients" },
    { href: "/dashboard/availability", label: "Availability" },
    { href: "/dashboard/appointments", label: "Appointments" },
    { href: "/dashboard/invoices", label: "Invoices" },
] as const;

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-full flex-1 flex-col">
            <header className="border-b border-zinc-200 px-4 py-3">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
                    <Link href="/dashboard" className="font-semibold tracking-tight">
                        PulseBook
                    </Link>
                    <nav className="flex flex-wrap gap-3 text-sm text-zinc-600">
                        {nav.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="hover:text-zinc-900"
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </header>
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
                {children}
            </main>
        </div>
    );
}