import { SignJWT, jwtVerify } from "jose";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import { authConfig, getApiBaseUrl, getAuthSecret } from "./config";

type NestUser = {
  id: string;
  email: string;
  name: string;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!email || !password) {
          return null;
        }

        const res = await fetch(`${getApiBaseUrl()}/api/auth/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          return null;
        }

        const user = (await res.json()) as NestUser;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, copy Nest user into the JWT claims Nest expects.
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = token.email ?? "";
        session.user.name = token.name ?? null;
      }
      
      return session;
    },
  },
  jwt: {
    // Override Auth.js encrypted JWE → plain HS256 JWT Nest can verify.
    async encode({ token, maxAge }) {
      const secret = new TextEncoder().encode(getAuthSecret());
      const expiresIn = maxAge ?? authConfig.session.maxAge;

      return new SignJWT({
        sub: token?.sub,
        email: token?.email,
        name: token?.name,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${expiresIn}s`)
        .sign(secret);
    },
    async decode({ token }) {
      if (!token) {
        return null;
      }

      try {
        const secret = new TextEncoder().encode(getAuthSecret());
        const { payload } = await jwtVerify(token, secret, {
          algorithms: ["HS256"],
        });

        return {
          sub: typeof payload.sub === "string" ? payload.sub : undefined,
          email: typeof payload.email === "string" ? payload.email : undefined,
          name: typeof payload.name === "string" ? payload.name : undefined,
        } satisfies JWT;
      } catch {
        return null;
      }
    },
  },
});
