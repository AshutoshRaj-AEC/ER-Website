import ashuBoyImage from "../AshuBOY-optimized.jpg";
import authorityImage from "../Authority.jpg";
import naamNamahImage from "../naam namah.jpeg";
import dhrooVoidImage from "../dhroovoid.jpeg";
import rapStreetTeacherImage from "../rap street teacher.jpeg";

const artists = [
  {
    name: "AshuBOY",
    role: "Versatile Rapper / Hindi Hip-Hop / Spiritual Rap / Storytelling / Remix Artist",
    image: ashuBoyImage,
  },
  {
    name: "Naam Namah",
    role: "Hindi Hip-Hop / Spiritual Rap / Storytelling",
    image: naamNamahImage,
  },
  {
    name: "DhrooVoid",
    role: "Remix Artist / Spiritual Rap",
    image: dhrooVoidImage,
  },
  {
    name: "Rap Street Teacher",
    role: "Hip-Hop Artist / Talent Promoter / Rap Battle Platform",
    image: rapStreetTeacherImage,
  },
  {
    name: "Autho₹ity",
    role: "Hindi Hip-Hop / Hardcore Underground / Storytelling",
    image: authorityImage,
  },
];

const ArtistsSection = () => {
  return (
    <section id="artists" className="border-t border-white/10 bg-stone-950 py-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-orange-300">
          Featured Roster
        </p>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="font-['Space_Grotesk'] text-4xl font-bold uppercase tracking-[0.08em] text-white md:text-5xl">
            Artists with distinct voices and purpose
          </h2>
          <p className="max-w-xl text-sm leading-7 text-stone-400 sm:text-base">
            From Hindi hip-hop and hardcore underground sounds to spiritual rap,
            remixes, and talent promotion, the roster reflects the many ways
            originality can hit hard.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {artists.map((artist) => (
            <article
              key={artist.name}
              className="group overflow-hidden rounded-[2rem] border border-white/10 bg-white/5"
            >
              <div className="relative overflow-hidden">
                <img
                  src={artist.image}
                  alt={artist.name}
                  width="900"
                  height="900"
                  loading="lazy"
                  className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute right-5 top-5 h-3 w-3 rounded-full bg-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.8)]" />
              </div>
              <div className="space-y-2 px-6 py-6">
                <h3 className="font-['Space_Grotesk'] text-2xl font-semibold uppercase tracking-[0.08em] text-white">
                  {artist.name}
                </h3>
                <p className="text-sm leading-7 text-stone-400">
                  {artist.role}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ArtistsSection;
