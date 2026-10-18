"use client";

import { useCallback, useState } from "react";

/**
 * Log out reliably.
 *
 * Logout used to be a native `<form action="/api/auth/logout" method="post">`
 * rendered *inside* a Radix dropdown item and inside the mobile drawer. Radix
 * unmounts its content as soon as an item is selected, which cancels the native
 * form submission before the browser dispatches it — so clicking "Log out"
 * closed the menu, sent no request, and left the session valid. It looked like
 * a broken button because it was one.
 *
 * Doing the work in a handler and navigating afterwards removes the race
 * entirely: the request is sent, and only then does the page change.
 */
export function useLogout() {
  const [pending, setPending] = useState(false);

  const logout = useCallback(async () => {
    if (pending) return;
    setPending(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        redirect: "manual",
        cache: "no-store",
        credentials: "same-origin",
      });
    } catch {
      // A failed request must not trap the user in a signed-in shell; the
      // navigation below still sends them to a public page.
    }

    /*
     * A full document navigation is deliberate, and the Next lint rule that
     * prefers router.push does not apply here: after signing out we must not
     * keep any client-side cache of the signed-in shell (Router Cache, service
     * worker shell) alive, which a client-side navigation would.
     */
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }, [pending]);

  return { logout, pending };
}
