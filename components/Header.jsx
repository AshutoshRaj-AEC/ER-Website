const navLinks = [
  { label: "Artists", href: "#artists" },
  { label: "Releases", href: "#releases" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const Header = () => {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/65 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
        <a href="#top" className="flex items-center gap-3">
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
      </div>
    </header>
  );
};

export default Header;
