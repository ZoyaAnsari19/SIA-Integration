"use client";

import { usePathname } from "next/navigation";
import { ChatFab } from "./ChatFab";

/** Routes where the floating AI widget should not appear (public auth). */
const HIDE_CHAT_PREFIXES = ["/login"];

export function ConditionalChatFab() {
  const pathname = usePathname() || "";
  if (HIDE_CHAT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return <ChatFab />;
}
