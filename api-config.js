(function () {
    const defaultApiBase = "https://fullproject-ekantin-production.up.railway.app";
    const params = new URLSearchParams(window.location.search || "");
    const storedBase = localStorage.getItem("ekantinApiBaseUrl");
    const requestedBase = params.get("apiBase");
    const cleanedStoredBase = storedBase && storedBase !== "https://ekantin-backend.onrender.com" ? storedBase : "";
    const resolvedBase = (requestedBase || cleanedStoredBase || defaultApiBase).replace(/\/+$/, "");

    localStorage.setItem("ekantinApiBaseUrl", resolvedBase);

    const originalFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!originalFetch) return;

    window.fetch = function fetchWithApiBase(input, init) {
        let nextInput = input;

        if (typeof nextInput === "string") {
            if (nextInput.startsWith("/")) {
                nextInput = `${resolvedBase}${nextInput}`;
            }
        } else if (nextInput instanceof Request) {
            const requestUrl = nextInput.url;
            if (requestUrl.startsWith(window.location.origin) && requestUrl.includes("/api/")) {
                const relativePath = requestUrl.substring(window.location.origin.length);
                nextInput = new Request(`${resolvedBase}${relativePath}`, {
                    method: nextInput.method,
                    headers: nextInput.headers,
                    body: nextInput.body,
                    mode: nextInput.mode,
                    credentials: nextInput.credentials,
                    cache: nextInput.cache,
                    redirect: nextInput.redirect,
                    referrer: nextInput.referrer,
                    referrerPolicy: nextInput.referrerPolicy,
                    integrity: nextInput.integrity,
                    keepalive: nextInput.keepalive,
                });
            }
        } else if (nextInput && typeof nextInput === "object" && typeof nextInput.url === "string") {
            const requestUrl = nextInput.url;
            if (requestUrl.startsWith("/")) {
                nextInput = {
                    ...nextInput,
                    url: `${resolvedBase}${requestUrl}`
                };
            }
        }

        return originalFetch(nextInput, init);
    };
})();
