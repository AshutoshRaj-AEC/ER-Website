import { useEffect, useRef, useState } from "react";

const navLinks = [
  { label: "Artists", href: "/#artists" },
  { label: "Releases", href: "/#releases" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#contact" },
];

const GoogleIcon = () => {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12.24 10.285v3.87h5.386c-.232 1.245-.93 2.3-1.99 3.008l3.22 2.498c1.877-1.73 2.958-4.28 2.958-7.316 0-.698-.062-1.37-.177-2.06z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.964-.895 6.618-2.425l-3.22-2.498c-.895.6-2.04.955-3.398.955-2.61 0-4.823-1.762-5.614-4.13H3.06v2.592A9.997 9.997 0 0 0 12 22"
      />
      <path
        fill="#4A90E2"
        d="M6.386 13.902A5.997 5.997 0 0 1 6.07 12c0-.66.114-1.303.316-1.902V7.506H3.06A9.997 9.997 0 0 0 2 12c0 1.61.386 3.13 1.06 4.494z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.968c1.468 0 2.786.505 3.822 1.495l2.868-2.868C16.96 2.983 14.697 2 12 2A9.997 9.997 0 0 0 3.06 7.506l3.326 2.592C7.177 7.73 9.39 5.968 12 5.968"
      />
    </svg>
  );
};

const Avatar = ({ user }) => {
  return user.avatar ? (
    <img
      src={user.avatar}
      alt=""
      referrerPolicy="no-referrer"
      className="h-8 w-8 rounded-full object-cover"
    />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-xs font-bold uppercase text-white">
      {user.name?.slice(0, 1) ?? "E"}
    </span>
  );
};

const AccountMenu = ({ user, isAdmin, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const menuItemClass =
    "block w-full rounded-xl px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-stone-200 transition hover:bg-white/10 hover:text-orange-200";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Account menu"
        onClick={() => setMenuOpen((current) => !current)}
        className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 p-1 text-sm text-stone-200 transition hover:border-orange-300 sm:py-1 sm:pl-1 sm:pr-4"
      >
        <Avatar user={user} />
        <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-stone-950 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        >
          <p className="truncate px-4 pb-2 pt-3 text-xs text-stone-400">
            {user.email}
          </p>
          <a role="menuitem" href="/submit" className={menuItemClass}>
            Submit music
          </a>
          {isAdmin ? (
            <a role="menuitem" href="/admin" className={menuItemClass}>
              Review submissions
            </a>
          ) : null}
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onLogout();
            }}
            className={menuItemClass}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
};

const Header = ({ user, isAdmin, onOpenAuth, onLogout }) => {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/65 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
        <a href="/#top" className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.8)]" />
          <div>
            <p className="font-['Space_Grotesk'] text-lg font-bold uppercase tracking-[0.35em] text-white">
              EklautA
            </p>
            <p className="text-[10px] uppercase tracking-[0.45em] text-stone-400">
              Records
            </p>
          </div>
        </a>

        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-8 text-sm uppercase tracking-[0.25em] text-stone-300 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="transition hover:text-orange-300"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {user ? (
            <AccountMenu user={user} isAdmin={isAdmin} onLogout={onLogout} />
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-stone-900 transition hover:scale-[1.02] hover:bg-orange-50 sm:gap-3 sm:px-5 sm:py-3"
            >
              <GoogleIcon />
              Sign in<span className="hidden sm:inline"> with Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
