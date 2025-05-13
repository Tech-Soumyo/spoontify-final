"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { RecoilRoot } from "recoil";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <RecoilRoot>
      <SessionProvider>{children}</SessionProvider>
    </RecoilRoot>
  );
};
