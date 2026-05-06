const footerLinks = [
  { label: "Artists", href: "#artists" },
  { label: "Releases", href: "#releases" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const socialLinks = [
  {
    label: "YouTube",
    href: "https://youtu.be/KAe4mdXyhXk?si=tSdJN6pEruaiBKR_%3Fsub_confirmation%3D1",
  },
  { label: "Instagram", href: "https://www.instagram.com/eklautarecords/" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/ashutosh-kumar-raj/",
  },
];

const BarcodeLogo = () => {
  return (
    <div className="relative w-full max-w-[24rem] overflow-hidden rounded-sm border border-white/10 bg-white px-5 py-5 shadow-[0_0_45px_rgba(255,255,255,0.06)]">
      <div
        className="absolute inset-x-5 top-4 h-16"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #000 0 3px, transparent 3px 7px, #000 7px 9px, transparent 9px 15px, #000 15px 27px, transparent 27px 35px)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-5 bottom-4 h-16"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #000 0 4px, transparent 4px 8px, #000 8px 18px, transparent 18px 24px, #000 24px 29px, transparent 29px 35px)",
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 my-14 bg-white text-center font-['Space_Grotesk'] text-[3.1rem] font-bold uppercase leading-none tracking-[0.22em] text-black sm:text-[3.8rem]">
        EKLAUTA
      </div>
    </div>
  );
};

const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-14 sm:px-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <BarcodeLogo />
          <div className="space-y-2 text-sm text-stone-400">
            <p className="font-['Space_Grotesk'] text-base uppercase tracking-[0.3em] text-stone-200">
              EklautA Records
            </p>
            <p>Be Unique In Play.</p>
          </div>
        </div>

        <div className="grid gap-10 text-sm text-stone-400 sm:grid-cols-2">
          <div>
            <p className="mb-4 font-['Space_Grotesk'] uppercase tracking-[0.25em] text-stone-200">
              Navigate
            </p>
            <div className="space-y-3">
              {footerLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block transition hover:text-orange-300"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-4 font-['Space_Grotesk'] uppercase tracking-[0.25em] text-stone-200">
              Connect
            </p>
            <div className="space-y-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block transition hover:text-orange-300"
                >
                  {link.label}
                </a>
              ))}
              <p>Independent label platform for original voices.</p>
              <p className="text-stone-500">
                © 2026 EklautA Records. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
