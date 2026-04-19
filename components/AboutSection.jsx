const stats = [
  { value: "01", label: "Independent label identity" },
  { value: "05", label: "Current featured artists" },
  { value: "24/7", label: "Creative direction mindset" },
];

const AboutSection = () => {
  return (
    <section id="about" className="border-t border-white/10 bg-black py-24">
      <div className="mx-auto grid max-w-6xl gap-14 px-6 sm:px-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-orange-300">
            About EklautA
          </p>
          <h2 className="mt-4 font-['Space_Grotesk'] text-4xl font-bold uppercase tracking-[0.08em] text-white md:text-5xl">
            We back artists who sound like themselves
          </h2>
          <p className="mt-8 max-w-2xl text-base leading-8 text-stone-300">
            EklautA Records is being shaped as a modern independent label for
            artists with a clear identity, fearless storytelling, and a strong
            point of view. The mission is simple: help original voices cut
            through the noise without sanding off what makes them different.
          </p>
        </div>

        <div className="grid gap-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-8"
            >
              <p className="font-['Space_Grotesk'] text-4xl font-bold uppercase tracking-[0.08em] text-orange-300">
                {stat.value}
              </p>
              <p className="mt-3 text-sm uppercase tracking-[0.2em] text-stone-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
