import { useCallback, useEffect, useRef, useState } from "react";

function useCookieConsent() {
  const [cookieConsent, setCookieConsent] = useState(null);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const gaLoadedRef = useRef(false);
  const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

  const initGoogleAnalytics = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!GA_MEASUREMENT_ID || gaLoadedRef.current) return;

    const existing = document.querySelector("script[data-gtag]");
    if (existing) {
      gaLoadedRef.current = true;
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    script.dataset.gtag = "true";
    script.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      window.gtag = gtag;
      gtag("js", new Date());
      gtag("config", GA_MEASUREMENT_ID, { anonymize_ip: true });
      gaLoadedRef.current = true;
    };

    document.head.appendChild(script);
  }, [GA_MEASUREMENT_ID]);

  const handleCookieChoice = useCallback(
    (decision) => {
      const payload = { decision, timestamp: new Date().toISOString() };
      setCookieConsent(payload);
      setShowCookieBanner(false);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cookieConsent", JSON.stringify(payload));
      }
      if (decision === "all") {
        initGoogleAnalytics();
      }
    },
    [initGoogleAnalytics]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("cookieConsent");
      if (stored) {
        const parsed = JSON.parse(stored);
        setCookieConsent(parsed);
        return;
      }
    } catch {
      // Ignored: wenn Parsing fehlschlägt, Banner erneut zeigen.
    }
    setShowCookieBanner(true);
  }, []);

  useEffect(() => {
    if (cookieConsent) {
      setShowCookieBanner(false);
    }
  }, [cookieConsent]);

  useEffect(() => {
    if (cookieConsent?.decision === "all") {
      initGoogleAnalytics();
    }
  }, [cookieConsent, initGoogleAnalytics]);

  return { cookieConsent, showCookieBanner, handleCookieChoice, setShowCookieBanner };
}

export default useCookieConsent;
