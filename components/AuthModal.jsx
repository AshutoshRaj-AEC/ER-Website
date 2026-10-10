import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SHOW_PREVIEW_LOGIN = import.meta.env.DEV;

// The Google script and initialize() call are shared across every open of
// the modal, so they live at module level and only ever run once.
let googleScriptPromise = null;
let googleInitialized = false;
let handleGoogleCredential = null;

const loadGoogleScript = () => {
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        googleScriptPromise = null;
        script.remove();
        reject(new Error("Failed to load Google sign-in."));
      };
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
};

const decodeJwtPayload = (token) => {
  const payload = token.split(".")[1];

  if (!payload) {
    throw new Error("Invalid Google credential payload.");
  }

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(normalized);
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  const text = new TextDecoder().decode(bytes);

  return JSON.parse(text);
};

const AuthModal = ({ open, onClose, onAuthenticated }) => {
  const googleButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onAuthenticatedRef = useRef(onAuthenticated);
  const onCloseRef = useRef(onClose);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState(false);

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !GOOGLE_CLIENT_ID) {
      return undefined;
    }

    let cancelled = false;

    handleGoogleCredential = (credential) => {
      try {
        const profile = decodeJwtPayload(credential);

        onAuthenticatedRef.current({
          provider: "google",
          name: profile.name,
          email: profile.email,
          avatar: profile.picture,
        });
      } catch {
        setGoogleError(true);
      }
    };

    loadGoogleScript()
      .then(() => {
        if (cancelled || !googleButtonRef.current) {
          return;
        }

        if (!googleInitialized) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: ({ credential }) => handleGoogleCredential?.(credential),
          });
          googleInitialized = true;
        }

        googleButtonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signup_with",
          width: Math.min(260, googleButtonRef.current.offsetWidth),
        });

        setGoogleReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleError(true);
        }
      });

    return () => {
      cancelled = true;
      handleGoogleCredential = null;
      setGoogleReady(false);
      setGoogleError(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) {
    return null;
  }

  const handlePreviewLogin = () => {
    onAuthenticated({
      provider: "preview",
      name: "Developer Preview",
      email: "preview@eklautarecords.local",
      avatar: "",
    });
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-stone-950 p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-orange-300">
              Sign in
            </p>
            <h2
              id="auth-modal-title"
              className="mt-3 font-['Space_Grotesk'] text-2xl font-bold uppercase tracking-[0.06em] text-white sm:text-3xl"
            >
              Access EklautA Records
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-300 transition hover:border-orange-300 hover:text-orange-200"
          >
            Close
          </button>
        </div>

        <p className="mt-6 leading-7 text-stone-300">
          Sign in with Google to see your name and photo on the site. Your
          details are only saved in this browser.
        </p>

        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-300">
            Google account
          </p>
          {GOOGLE_CLIENT_ID ? (
            <div className="mt-5 min-h-[44px]" ref={googleButtonRef} />
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/30 px-5 py-4 text-sm leading-7 text-stone-400">
              {SHOW_PREVIEW_LOGIN
                ? "Add `VITE_GOOGLE_CLIENT_ID` to your environment to enable live Google SSO. The developer preview login below still works for testing."
                : "Google sign-in is unavailable right now. Please try again later."}
            </div>
          )}
          {GOOGLE_CLIENT_ID && googleError ? (
            <p className="mt-4 text-sm text-red-300">
              Google sign-in couldn't load. Check your connection and try
              again.
            </p>
          ) : null}
          {GOOGLE_CLIENT_ID && !googleReady && !googleError ? (
            <p className="mt-4 text-sm text-stone-400">
              Loading Google sign-in…
            </p>
          ) : null}
        </div>

        {SHOW_PREVIEW_LOGIN ? (
          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-300">
              Developer preview
            </p>
            <p className="mt-3 text-sm leading-7 text-stone-400">
              Only shown during local development. Use it to test the
              signed-in experience without Google.
            </p>
            <button
              type="button"
              onClick={handlePreviewLogin}
              className="mt-5 inline-flex rounded-full bg-orange-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400"
            >
              Continue as preview user
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AuthModal;
