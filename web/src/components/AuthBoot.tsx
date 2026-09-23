"use client";

import { useEffect } from "react";
import { bootAuth } from "@/lib/auth";

// Starts following the Supabase session once per page load (header, progress sync and community all read from it).
export default function AuthBoot() {
  useEffect(bootAuth, []);
  return null;
}
