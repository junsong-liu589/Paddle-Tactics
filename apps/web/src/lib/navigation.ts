import { useCallback, useEffect, useState } from "react";

export function useNavigation() {
  const [location, setLocation] = useState({
    path: window.location.pathname,
    search: window.location.search,
  });

  useEffect(() => {
    const onPopState = () =>
      setLocation({
        path: window.location.pathname,
        search: window.location.search,
      });
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    const destination = new URL(nextPath, window.location.href);
    window.history.pushState({}, "", destination);
    setLocation({ path: destination.pathname, search: destination.search });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return { ...location, navigate };
}
