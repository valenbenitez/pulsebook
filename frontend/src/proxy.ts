import { NextResponse } from "next/server";
import { auth } from "@/shared/auth";

export default auth((req) => {
    const { pathname } = req.nextUrl;
    const isLoggedIn = !!req.auth;
    const isDashboard = pathname.startsWith("/dashboard");

    if (isDashboard && !isLoggedIn) {
        const login = new URL("/login", req.nextUrl.origin);
        login.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(login);
    }

    if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
        return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/login",
        "/register"
    ]
};