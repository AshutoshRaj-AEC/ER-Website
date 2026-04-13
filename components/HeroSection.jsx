const HeroSection = () => {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1600&q=80')",
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 bg-gradient-to-br from-black via-black/75 to-orange-900/45"
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at top, rgba(255,255,255,0.14), transparent 35%), radial-gradient(circle at bottom, rgba(249,115,22,0.22), transparent 30%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl animate-[fadeUp_900ms_ease-out_forwards] flex-col items-center px-6 text-center opacity-0 sm:px-10">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.45em] text-orange-300 sm:text-sm">
          Independent Music Label
        </p>

        <h1 className="max-w-4xl text-5xl font-black uppercase tracking-[0.08em] text-white sm:text-6xl md:text-7xl lg:text-8xl">
          EklautA Records
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-zinc-200 sm:text-xl md:text-2xl">
          Be Unique In Play.
        </p>

        <div className="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
          <a
            href="#listen"
            className="w-full rounded-full bg-orange-500 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition duration-300 hover:scale-105 hover:bg-orange-400 hover:shadow-[0_0_35px_rgba(249,115,22,0.45)] focus:outline-none focus:ring-2 focus:ring-orange-300 sm:w-auto"
          >
            Listen Now
          </a>
          <a
            href="#contact"
            className="w-full rounded-full border border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm transition duration-300 hover:scale-105 hover:border-orange-300 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-orange-300 sm:w-auto"
          >
            Contact Us
          </a>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(28px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
};

export default HeroSection;
