const stats = [
  { value: "150+", label: "Releases" },
  { value: "08", label: "Live release posters" },
  { value: "24/7", label: "Creative energy" },
  { value: "20M+", label: "Streams" },
];

const AboutSection = () => {
  return (
    <section id="about" className="bg-black py-24 text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 sm:px-10 md:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.45em] text-orange-300">
            About Us
          </p>
          <h2 className="mb-6 font-['Space_Grotesk'] text-4xl font-bold leading-tight tracking-[0.04em] md:text-5xl">
            <span className="block text-white">Built for voices</span>
            <span className="block text-orange-400">that stay original.</span>
          </h2>
          <p className="mb-4 max-w-2xl leading-8 text-stone-300">
            EklautA Records is an independent platform shaped for artists with
            a real identity, fearless storytelling, and a sound that does not
            need to imitate anyone else to be heard.
          </p>
          <p className="max-w-2xl leading-8 text-stone-400">
            From spiritual rap and Hindi hip-hop to underground energy and
            remix culture, the label is being built around originality,
            long-term artist growth, and music that feels honest from the first
            listen.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center sm:p-10"
            >
              <p className="mb-3 font-['Space_Grotesk'] text-4xl font-bold uppercase tracking-[0.06em] text-orange-300 md:text-5xl">
                {stat.value}
              </p>
              <p className="text-[11px] uppercase tracking-[0.28em] text-stone-400">
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
