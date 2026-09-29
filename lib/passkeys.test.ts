import { describe, expect, it } from "vitest";
import { deviceLabel, isGenericName, passkeyErrorKind, passkeyErrorMessage, passkeysAvailable } from "./passkeys";

describe("passkeysAvailable", () => {
  it("is available when the host is the RP ID and the browser has WebAuthn", () => {
    expect(passkeysAvailable({ hostname: "keepup-murex.vercel.app", rpId: "keepup-murex.vercel.app", hasWebAuthn: true })).toBe(true);
    expect(passkeysAvailable({ hostname: "localhost", rpId: "localhost", hasWebAuthn: true })).toBe(true);
  });

  it("is hidden on a Vercel preview host", () => {
    expect(
      passkeysAvailable({ hostname: "keepup-git-feature-x-naum.vercel.app", rpId: "keepup-murex.vercel.app", hasWebAuthn: true }),
    ).toBe(false);
  });

  it("is hidden on 127.0.0.1 when the RP ID is localhost", () => {
    expect(passkeysAvailable({ hostname: "127.0.0.1", rpId: "localhost", hasWebAuthn: true })).toBe(false);
  });

  it("is hidden without PublicKeyCredential", () => {
    expect(passkeysAvailable({ hostname: "localhost", rpId: "localhost", hasWebAuthn: false })).toBe(false);
  });

  it("is hidden when no RP ID is configured", () => {
    expect(passkeysAvailable({ hostname: "localhost", rpId: undefined, hasWebAuthn: true })).toBe(false);
    expect(passkeysAvailable({ hostname: "localhost", rpId: "", hasWebAuthn: true })).toBe(false);
  });
});

describe("passkeyErrorKind", () => {
  const notAllowed = Object.assign(new Error("The operation either timed out or was not allowed."), { name: "NotAllowedError" });

  it("treats the user closing the Face ID sheet as cancelled", () => {
    expect(passkeyErrorKind({ code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", cause: notAllowed })).toBe("cancelled");
    expect(passkeyErrorKind({ code: "ERROR_CEREMONY_ABORTED" })).toBe("cancelled");
    expect(passkeyErrorKind(notAllowed)).toBe("cancelled");
  });

  it("recognises a project without passkeys switched on", () => {
    expect(passkeyErrorKind({ code: "passkey_disabled", message: "Passkeys are disabled" })).toBe("disabled");
  });

  it("recognises an authenticator that is already registered", () => {
    expect(passkeyErrorKind({ code: "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" })).toBe("exists");
    expect(passkeyErrorKind({ code: "webauthn_credential_exists" })).toBe("exists");
  });

  it("recognises a browser without WebAuthn", () => {
    expect(passkeyErrorKind(new Error("Browser does not support WebAuthn"))).toBe("unsupported");
  });

  it("falls back to other for anything else", () => {
    expect(passkeyErrorKind({ code: "webauthn_challenge_expired" })).toBe("other");
    expect(passkeyErrorKind(new TypeError("Failed to fetch"))).toBe("other");
    expect(passkeyErrorKind(undefined)).toBe("other");
  });
});

describe("passkeyErrorMessage", () => {
  it("says nothing when the user cancelled", () => {
    expect(passkeyErrorMessage({ code: "ERROR_CEREMONY_ABORTED" }, "signIn")).toBeNull();
    expect(passkeyErrorMessage({ code: "ERROR_CEREMONY_ABORTED" }, "setUp")).toBeNull();
  });

  it("points sign-in failures to the other ways in", () => {
    expect(passkeyErrorMessage({ code: "webauthn_challenge_expired" }, "signIn")).toBe(
      "Couldn't sign in with Face ID. Use Google or email instead.",
    );
  });

  it("explains set-up failures without blame", () => {
    expect(passkeyErrorMessage({ code: "webauthn_credential_exists" }, "setUp")).toBe("Face ID is already set up on this device.");
    expect(passkeyErrorMessage({ code: "passkey_disabled" }, "setUp")).toBe("Face ID sign-in isn't switched on yet.");
  });
});

describe("deviceLabel", () => {
  it("names common devices and browsers", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("iPhone Safari");
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("iPhone Chrome");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      ),
    ).toBe("Mac Chrome");
    expect(
      deviceLabel("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"),
    ).toBe("Android Chrome");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0")).toBe("Windows Firefox");
  });

  it("falls back to a neutral name", () => {
    expect(deviceLabel("")).toBe("This device");
  });
});

describe("isGenericName", () => {
  it("replaces only Supabase's bare default", () => {
    expect(isGenericName(undefined)).toBe(true);
    expect(isGenericName("")).toBe(true);
    expect(isGenericName("Passkey")).toBe(true);
    expect(isGenericName("iCloud Keychain")).toBe(false);
  });
});
