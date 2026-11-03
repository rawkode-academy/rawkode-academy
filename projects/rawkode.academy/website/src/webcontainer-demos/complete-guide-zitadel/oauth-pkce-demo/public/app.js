class OAuthPKCE {
  constructor() {
    this.clientId = null;
    this.authorizationEndpoint = null;
    this.tokenEndpoint = null;
    this.redirectUri = window.location.origin;
    this.codeVerifier = null;
    this.codeChallenge = null;
  }

  async init(wellKnownUrl) {
    try {
      const response = await fetch(wellKnownUrl);
      const config = await response.json();
      this.authorizationEndpoint = config.authorization_endpoint;
      this.tokenEndpoint = config.token_endpoint;
      return true;
    } catch (error) {
      console.error("Failed to fetch OpenID configuration:", error);
      return false;
    }
  }

  setClientId(clientId) {
    this.clientId = clientId;
  }

  generateRandomString(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  base64URLEncode(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return this.base64URLEncode(digest);
  }

  async startAuthFlow() {
    this.codeVerifier = this.generateRandomString(128);
    this.codeChallenge = await this.generateCodeChallenge(this.codeVerifier);

    localStorage.setItem("pkce_code_verifier", this.codeVerifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: "openid profile email",
      code_challenge: this.codeChallenge,
      code_challenge_method: "S256",
      state: this.generateRandomString(32),
    });

    window.location.href = `${this.authorizationEndpoint}?${params}`;
  }

  async handleCallback(code) {
    const codeVerifier = localStorage.getItem("pkce_code_verifier");
    if (!codeVerifier) {
      throw new Error("No code verifier found");
    }

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: codeVerifier,
    });

    try {
      const response = await fetch(this.tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      if (!response.ok) {
        throw new Error("Token exchange failed");
      }

      const tokens = await response.json();
      localStorage.removeItem("pkce_code_verifier");
      return tokens;
    } catch (error) {
      console.error("Token exchange error:", error);
      throw error;
    }
  }

  decodeJWT(token) {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64).split("").map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(""),
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error("Failed to decode JWT:", error);
      return null;
    }
  }
}

const oauth = new OAuthPKCE();

document.addEventListener("DOMContentLoaded", async () => {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginSection = document.getElementById("login-section");
  const tokenSection = document.getElementById("token-section");

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (code) {
    try {
      let wellKnownUrl = sessionStorage.getItem("oauth_wellknown_url");
      let clientId = sessionStorage.getItem("oauth_client_id");

      if (!wellKnownUrl) {
        wellKnownUrl = prompt(
          "Please enter the OpenID well-known configuration URL:",
        );
        if (wellKnownUrl) {
          sessionStorage.setItem("oauth_wellknown_url", wellKnownUrl);
        }
      }

      if (!clientId) {
        clientId = prompt("Please enter your OAuth Client ID:");
        if (clientId) {
          sessionStorage.setItem("oauth_client_id", clientId);
        }
      }

      if (wellKnownUrl && clientId) {
        await oauth.init(wellKnownUrl);
        oauth.setClientId(clientId);

        const tokens = await oauth.handleCallback(code);
        displayTokens(tokens);

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      }
    } catch (error) {
      alert("Authentication failed: " + error.message);
      window.location.href = "/";
    }
  }

  const savedTokens = localStorage.getItem("oauth_tokens");
  if (savedTokens) {
    displayTokens(JSON.parse(savedTokens));
  }

  loginBtn.addEventListener("click", async () => {
    let wellKnownUrl = sessionStorage.getItem("oauth_wellknown_url");
    let clientId = sessionStorage.getItem("oauth_client_id");

    if (!wellKnownUrl) {
      wellKnownUrl = prompt(
        "Please enter the OpenID well-known configuration URL:",
      );
      if (wellKnownUrl) {
        sessionStorage.setItem("oauth_wellknown_url", wellKnownUrl);
      }
    }

    if (!clientId) {
      clientId = prompt("Please enter your OAuth Client ID:");
      if (clientId) {
        sessionStorage.setItem("oauth_client_id", clientId);
      }
    }

    if (wellKnownUrl && clientId) {
      const initialized = await oauth.init(wellKnownUrl);
      if (initialized) {
        oauth.setClientId(clientId);
        await oauth.startAuthFlow();
      } else {
        alert("Failed to initialize OAuth configuration");
      }
    }
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("oauth_tokens");
    loginSection.classList.remove("hidden");
    tokenSection.classList.add("hidden");
  });

  function displayTokens(tokens) {
    localStorage.setItem("oauth_tokens", JSON.stringify(tokens));

    loginSection.classList.add("hidden");
    tokenSection.classList.remove("hidden");

    document.getElementById("access-token").textContent = tokens.access_token ||
      "N/A";

    if (tokens.id_token) {
      document.getElementById("id-token").textContent = tokens.id_token;

      const claims = oauth.decodeJWT(tokens.id_token);
      if (claims) {
        document.getElementById("token-claims").textContent = JSON.stringify(
          claims,
          null,
          2,
        );

        // Extract roles from various possible locations
        let roles = [];

        // Standard claims
        if (claims.roles) {
          roles = claims.roles;
        } // Zitadel specific role structures
        else if (claims["urn:zitadel:iam:org:project:roles"]) {
          const projectRoles = claims["urn:zitadel:iam:org:project:roles"];
          // Extract role names from Zitadel's structure
          if (typeof projectRoles === "object") {
            roles = Object.keys(projectRoles);
          } else if (Array.isArray(projectRoles)) {
            roles = projectRoles;
          }
        } // Other common role claim names
        else if (claims["cognito:groups"]) {
          roles = claims["cognito:groups"];
        } else if (claims.groups) {
          roles = claims.groups;
        } else if (claims.realm_access?.roles) {
          roles = claims.realm_access.roles;
        } // Check for any claim containing 'role' in the key
        else {
          for (const [key, value] of Object.entries(claims)) {
            if (
              key.toLowerCase().includes("role") &&
              (Array.isArray(value) || typeof value === "object")
            ) {
              if (Array.isArray(value)) {
                roles = value;
              } else if (typeof value === "object") {
                roles = Object.keys(value);
              }
              break;
            }
          }
        }

        document.getElementById("user-roles").textContent =
          Array.isArray(roles) && roles.length > 0
            ? roles.join("\n")
            : roles && typeof roles === "object"
            ? JSON.stringify(roles, null, 2)
            : "No roles found";
      }
    } else {
      document.getElementById("id-token").textContent = "No ID token received";
      document.getElementById("token-claims").textContent =
        "Unable to decode claims";
      document.getElementById("user-roles").textContent = "No roles found";
    }
  }
});
