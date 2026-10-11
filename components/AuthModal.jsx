import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// The Google script and initialize() call are shared across every open of
// the modal, so they live at module level and only ever run once.
let googleScriptPromise = null;
let googleInitialized = false;
let handleGoogleCredential = null;

// Google embeds the hashed nonce in its ID token and Supabase checks it
// against the raw one, so a captured token can't be replayed elsewhere.
const rawNonce = crypto.randomUUID();
const hashedNoncePromise = crypto.subtle
  .digest("SHA-256", new TextEncoder().encode(rawNonce))
  .then((buffer) =>
    Array.from(new Uint8Array(buffer), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")
  );

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

const AuthModal = ({ open, onClose, onSignedIn }) => {
  const googleButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const onSignedInRef = useRef(onSignedIn);
  const onCloseRef = useRef(onClose);
  const [googleReady, setGoogleReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onSignedInRef.current = onSignedIn;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !GOOGLE_CLIENT_ID) {
      return undefined;
    }

    let cancelled = false;

    handleGoogleCredential = async (credential) => {
      setSigningIn(true);
      setError("");

      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: credential,
        nonce: rawNonce,
      });

      setSigningIn(false);

      if (signInError) {
        console.error(signInError);
        setError("Sign-in failed. Please try again.");
        return;
      }

      onSignedInRef.current();
    };

    Promise.all([loadGoogleScript(), hashedNoncePromise])
      .then(([, hashedNonce]) => {
        if (cancelled || !googleButtonRef.current) {
          return;
        }

        if (!googleInitialized) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            nonce: hashedNonce,
            callback: ({ credential }) => handleGoogleCredential?.(credential),
          });
          googleInitialized = true;
        }

        googleButtonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: Math.min(260, googleButtonRef.current.offsetWidth),
        });

        setGoogleReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Google sign-in couldn't load. Check your connection and try again."
          );
        }
      });

    return () => {
      cancelled = true;
      handleGoogleCredential = null;
      setGoogleReady(false);
      setSigningIn(false);
      setError("");
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
          Sign in with Google to submit your music to EklautA Records and follow
          its review.
        </p>

        <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-orange-300">
            Google account
          </p>
          {GOOGLE_CLIENT_ID ? (
            <div className="mt-5 min-h-[44px]" ref={googleButtonRef} />
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-black/30 px-5 py-4 text-sm leading-7 text-stone-400">
              {import.meta.env.DEV
                ? "Add `VITE_GOOGLE_CLIENT_ID` to your environment to enable Google sign-in."
                : "Google sign-in is unavailable right now. Please try again later."}
            </div>
          )}
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          {signingIn ? (
            <p className="mt-4 text-sm text-stone-400">Signing you in…</p>
          ) : null}
          {GOOGLE_CLIENT_ID && !googleReady && !error ? (
            <p className="mt-4 text-sm text-stone-400">
              Loading Google sign-in…
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
