"use client";

import { useEffect } from "react";
import { Provider, useDispatch } from "react-redux";

import { store } from "@/redux/store";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { setUser } from "@/redux/features/auth/authSlice";
import { getStoredUser } from "@/lib/api/auth";
import { getAuthToken } from "@/lib/api/client";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = getAuthToken();
    const storedUser = getStoredUser();
    if (token && storedUser) {
      dispatch(
        setUser({
          user: { ...storedUser, role: storedUser.role || "user" },
          token,
        }),
      );
    }
  }, [dispatch]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthInitializer>
          <SidebarProvider>{children}</SidebarProvider>
        </AuthInitializer>
      </ThemeProvider>
    </Provider>
  );
}
