// InfluxDB Web Analytics Script
(() => {
  const ANALYTICS_ENDPOINT = "/api/analytics";

  const getClientDetails = () => {
    const { userAgent } = navigator;
    const { width: _width, height: _height } = globalThis.screen;

    const browser = userAgent.match(
      /Edg\/\d+|Chrome\/\d+|Firefox\/\d+|Safari\/\d+|MSIE\s\d+|Trident\/\d+/,
    )?.[0] || "Unknown";

    const os = userAgent.match(/Win|Mac|Linux|Android|iOS/)?.[0] || "Unknown";

    return {
      browser,
      os,
    };
  };

  const getUtmParameters = () => {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const utm = {};
    const utmParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ];

    utmParams.forEach((param) => {
      if (urlParams.has(param)) {
        utm[param] = urlParams.get(param);
      }
    });

    return utm;
  };

  const sendAnalytics = async (eventData) => {
    // Disable analytics for localhost/dev mode
    if (globalThis.location.hostname === "localhost") {
      console.log("Analytics disabled for localhost.");
      return;
    }

    const clientDetails = getClientDetails();
    const utmParameters = getUtmParameters();
    const dataToSend = { ...eventData, ...clientDetails, ...utmParameters };

    try {
      const response = await fetch(ANALYTICS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
        credentials: "same-origin",
      });

      if (!response.ok) {
        console.error("Failed to send analytics:", response.statusText);
      }
    } catch (error) {
      console.error("Analytics error:", error);
    }
  };

  // Track page view
  const trackPageView = () => {
    const data = {
      action: "page.view",
      path: globalThis.location.pathname,
      referrer: document.referrer || "",
    };

    sendAnalytics(data);
  };

  // Track page exit (using beforeunload)
  const setupExitTracking = () => {
    const startTime = Date.now();

    globalThis.addEventListener("beforeunload", () => {
      const timeOnPage = Math.floor((Date.now() - startTime) / 1000); // in seconds

      const data = {
        action: "page.exit",
        path: globalThis.location.pathname,
        time_on_page: timeOnPage,
      };

      // Using sendBeacon for exit events as fetch might not complete
      if (globalThis.location.hostname !== "localhost") {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(data)], {
            type: "application/json",
          });
          navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
        } else {
          // Fallback to sync XHR for older browsers
          const xhr = new XMLHttpRequest();
          xhr.open("POST", ANALYTICS_ENDPOINT, false); // false = synchronous
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.send(JSON.stringify(data));
        }
      } else {
        console.log("Analytics exit tracking disabled for localhost.");
      }
    });
  };

  const init = () => {
    trackPageView();
    setupExitTracking();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
