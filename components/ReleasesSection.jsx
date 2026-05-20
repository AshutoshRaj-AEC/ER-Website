import { useRef } from "react";
import aigiriNandiniPoster from "../Posters/Aigiri Nandini X Aatma Rama.jpg";
import aisoDeenDayalPoster from "../Posters/Aiso Deen Dayal (Dhan Dhan Bholenath).png";
import anantShrutiPoster from "../Posters/Anant Shruti enhanced.jpg";
import bholaPoster from "../Posters/Bhola.jpg";
import chandrachoodaPoster from "../Posters/Chandrachooda Shiva Shankara Parvati.jpg";
import durgaShaktiPoster from "../Posters/Durga Shakti (Sarva Mangal Mangalye).jpg";
import heyMarutiPoster from "../Posters/Hey Maruti.jpg";
import kalyugVsMahadevPoster from "../Posters/Kalyug Vs Mahadev.png";

const ChevronLeft = ({ className = "", size = 28 }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ width: size, height: size }}
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRight = ({ className = "", size = 28 }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ width: size, height: size }}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const releases = [
  {
    title: "Aigiri Nandini X Aatma Rama",
    artist: "EklautA Records",
    type: "Music Video",
    year: "2024",
    image: aigiriNandiniPoster,
    href: "https://youtu.be/KAe4mdXyhXk?si=tSdJN6pEruaiBKR_%3Fsub_confirmation%3D1",
    cta: "Watch now",
  },
  {
    title: "Aiso Deen Dayal",
    artist: "EklautA Records",
    type: "Single",
    year: "2024",
    image: aisoDeenDayalPoster,
    href: "https://www.instagram.com/eklautarecords/",
    cta: "See update",
  },
  {
    title: "Anant Shruti",
    artist: "EklautA Records",
    type: "Release",
    year: "2026",
    image: anantShrutiPoster,
    href: "https://www.instagram.com/eklautarecords/",
    cta: "Explore art",
  },
  {
    title: "Bhola",
    artist: "EklautA Records",
    type: "Single",
    year: "2024",
    image: bholaPoster,
    href: "https://www.instagram.com/eklautarecords/",
    cta: "View poster",
  },
  {
    title: "Chandrachooda Shiva Shankara Parvati",
    artist: "EklautA Records",
    type: "Release",
    year: "2025",
    image: chandrachoodaPoster,
    href: "https://www.instagram.com/eklautarecords/",
    cta: "Stay tuned",
  },
  {
    title: "Durga Shakti",
    artist: "EklautA Records",
    type: "Music Video",
    year: "2025",
    image: durgaShaktiPoster,
    href: "https://www.instagram.com/eklautarecords/",
    cta: "Follow drop",
  },
  {
    title: "Hey Maruti",
    artist: "EklautA Records",
    type: "Single",
    year: "2024",
    image: heyMarutiPoster,
    href: "https://www.instagram.com/eklautarecords/",
    cta: "See teaser",
  },
  {
    title: "Kalyug Vs Mahadev",
    artist: "EklautA Records",
    type: "Release",
    year: "2023",
    image: kalyugVsMahadevPoster,
    href: "https://www.instagram.com/eklautarecords/",
    cta: "Open artwork",
  },
];

const ReleasesSection = () => {
  const scrollerRef = useRef(null);

  const scrollReleases = (direction) => {
    scrollerRef.current?.scrollBy({
      left: direction * 360,
      behavior: "smooth",
    });
  };

  return (
    <section
      id="releases"
      className="bg-gradient-to-b from-stone-900 via-black to-stone-950 py-24"
    >
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-orange-300">
          Release Section
        </p>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 className="font-mono text-4xl font-bold tracking-[0.02em] text-white md:text-6xl">
            Latest Releases
          </h2>
          <p className="max-w-xl text-sm leading-7 text-stone-400 sm:text-base">
            This catalog is still growing. For now, the section highlights the
            current YouTube release and the next wave of artist drops taking
            shape under EklautA Records.
          </p>
        </div>

        <div className="relative mt-14">
          <button
            type="button"
            aria-label="Previous releases"
            onClick={() => scrollReleases(-1)}
            className="group absolute bottom-0 left-0 top-0 z-10 flex w-12 cursor-pointer flex-col items-center justify-center gap-3 border-x border-white/10 bg-black/40 backdrop-blur-sm transition-colors hover:border-orange-300/40 hover:bg-orange-500/10 md:w-16"
          >
            <ChevronLeft
              size={28}
              className="text-orange-300 transition-colors group-hover:text-orange-200"
            />
            <span className="rotate-180 text-[10px] font-semibold uppercase tracking-[0.3em] text-stone-400 transition-colors [writing-mode:vertical-rl] group-hover:text-orange-200">
              MORE RELEASES
            </span>
          </button>

          <button
            type="button"
            aria-label="Next releases"
            onClick={() => scrollReleases(1)}
            className="group absolute bottom-0 right-0 top-0 z-10 flex w-12 cursor-pointer flex-col items-center justify-center gap-3 border-x border-white/10 bg-black/40 backdrop-blur-sm transition-colors hover:border-orange-300/40 hover:bg-orange-500/10 md:w-16"
          >
            <ChevronRight
              size={28}
              className="text-orange-300 transition-colors group-hover:text-orange-200"
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-stone-400 transition-colors [writing-mode:vertical-rl] group-hover:text-orange-200">
              MORE RELEASES
            </span>
          </button>

          <div className="px-16 md:px-20">
            <div
              ref={scrollerRef}
              className="flex gap-8 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {releases.map((release) => (
                <article
                  key={release.title}
                  className="group snap-start shrink-0 basis-[85%] sm:basis-[55%] md:basis-[calc((100%-4rem)/3)]"
                >
                  <div className="overflow-hidden bg-black">
                    <img
                      src={release.image}
                      alt={release.title}
                      width="900"
                      height="900"
                      loading="lazy"
                      className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>

                  <div className="space-y-3 px-0 pb-2 pt-5">
                    <div className="flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-mono text-2xl font-bold uppercase tracking-[0.04em] text-white">
                          {release.title}
                        </h3>
                        <p className="mt-1 text-sm uppercase tracking-[0.06em] text-stone-400">
                          {release.artist}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-300">
                        {release.type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
                      <span className="text-sm text-stone-500">{release.year}</span>
                      <a
                        href={release.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.28em] text-stone-300 transition hover:text-orange-200"
                      >
                        {release.cta}
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReleasesSection;
