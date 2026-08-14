"use client";

import { useEffect, useState } from "react";
import { isLocalBackend, LOCAL_USER } from "@/lib/data/backend";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { displayNameFromUser } from "@/lib/user";

export function useUser() {
  const local = isLocalBackend();
  const [state, setState] = useState({
    ready: local,
    local,
    name: local ? LOCAL_USER.name : "",
    email: local ? LOCAL_USER.email : "",
  });

  useEffect(() => {
    if (local || !hasSupabaseEnv()) {
      return;
    }
    let cancelled = false;
    void import("@/lib/supabase/client").then(({ createClient }) =>
      createClient()
        .auth.getUser()
        .then(({ data }) => {
          if (cancelled) {
            return;
          }
          setState({
            ready: true,
            local: false,
            name: displayNameFromUser(data.user),
            email: data.user?.email ?? "",
          });
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [local]);

  return state;
}
