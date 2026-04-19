const releases = [
  {
    title: "Midnight Signal",
    artist: "Aariz",
    type: "Single",
    year: "2026",
    image:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Neon Prayer",
    artist: "Meher",
    type: "EP",
    year: "2026",
    image:
      "https://images.unsplash.com/photo-1496293455970-f8581aae0e3b?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Afterglow Run",
    artist: "Nox",
    type: "Album",
    year: "2025",
    image:
      "https://images.unsplash.com/photo-1461783436728-0a9217714694?auto=format&fit=crop&w=900&q=80",
  },
];

const ReleasesSection = () => {
  return (
    <section id="releases" className="bg-gradient-to-b from-stone-900 to-black py-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-orange-300">
          Latest Releases
        </p>
        <h2 className="mt-4 font-['Space_Grotesk'] text-4xl font-bold uppercase tracking-[0.08em] text-white md:text-5xl">
          Built for replay value
        </h2>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {releases.map((release) => (
            <article
              key={release.title}
              className="group rounded-[2rem] border border-white/10 bg-white/5 p-4"
            >
              <div className="overflow-hidden rounded-[1.5rem]">
                <img
                  src={release.image}
                  alt={release.title}
                  width="900"
                  height="900"
                  loading="lazy"
                  className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>

              <div className="space-y-3 px-2 pb-2 pt-6">
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full border border-orange-400/40 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">
                    {release.type}
                  </span>
                  <span className="text-sm text-stone-400">{release.year}</span>
                </div>

                <h3 className="font-['Space_Grotesk'] text-2xl font-semibold uppercase tracking-[0.08em] text-white">
                  {release.title}
                </h3>
                <p className="text-sm uppercase tracking-[0.2em] text-stone-400">
                  {release.artist}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ReleasesSection;
