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
    type: "Music Video",
    image: aigiriNandiniPoster,
    listenLinks: [
      { label: "Spotify", href: "https://open.spotify.com/" },
      { label: "YT Music", href: "https://music.youtube.com/" },
    ],
    watchLinks: [
      {
        label: "YouTube",
        href: "https://youtu.be/KAe4mdXyhXk?si=tSdJN6pEruaiBKR_%3Fsub_confirmation%3D1",
      },
      { label: "Instagram", href: "https://www.instagram.com/eklautarecords/" },
    ],
  },
  {
    title: "Aiso Deen Dayal",
    type: "Single",
    image: aisoDeenDayalPoster,
    listenLinks: [
      { label: "Spotify", href: "https://open.spotify.com/" },
      { label: "YT Music", href: "https://music.youtube.com/" },
    ],
    watchLinks: [
      { label: "YouTube", href: "https://www.youtube.com/" },
      { label: "Instagram", href: "https://www.instagram.com/eklautarecords/" },
    ],
  },
  {
    title: "Anant Shruti",
    type: "Album",
    image: anantShrutiPoster,
    listenLinks: [
      { label: "Spotify", href: "https://open.spotify.com/" },
      { label: "YT Music", href: "https://music.youtube.com/" },
    ],
    watchLinks: [
      { label: "YouTube", href: "https://www.youtube.com/" },
      { label: "Instagram", href: "https://www.instagram.com/eklautarecords/" },
    ],
  },
  {
    title: "Bhola",
    type: "Instagram Reel",
    image: bholaPoster,
    listenLinks: [
      { label: "Spotify", href: "https://open.spotify.com/" },
      { label: "YT Music", href: "https://music.youtube.com/" },
    ],
    watchLinks: [
      { label: "YouTube", href: "https://www.youtube.com/" },
      { label: "Instagram", href: "https://www.instagram.com/eklautarecords/" },
    ],
  },
  {
    title: "Chandrachooda Shiva Shankara Parvati",
    type: "Single",
    image: chandrachoodaPoster,
    listenLinks: [
      { label: "Spotify", href: "https://open.spotify.com/" },
      { label: "YT Music", href: "https://music.youtube.com/" },
    ],
    watchLinks: [
      { label: "YouTube", href: "https://www.youtube.com/" },
      { label: "Instagram", href: "https://www.instagram.com/eklautarecords/" },
    ],
  },
  {
    title: "Durga Shakti",
    type: "Music Video",
    image: durgaShaktiPoster,
    listenLinks: [
      { label: "Spotify", href: "https://open.spotify.com/" },
      { label: "YT Music", href: "https://music.youtube.com/" },
    ],
    watchLinks: [
      { label: "YouTube", href: "https://www.youtube.com/" },
      { label: "Instagram", href: "https://www.instagram.com/eklautarecords/" },
    ],
  },
  {
    title: "Hey Maruti",
    type: "Single",
    image: heyMarutiPoster,
    listenLinks: [
      { label: "Spotify", href: "https://open.spotify.com/" },
      { label: "YT Music", href: "https://music.youtube.com/" },
    ],
    watchLinks: [
      { label: "YouTube", href: "https://www.youtube.com/" },
      { label: "Instagram", href: "https://www.instagram.com/eklautarecords/" },
    ],
  },
  {
    title: "Kalyug Vs Mahadev",
    type: "Release",
    image: kalyugVsMahadevPoster,
    listenLinks: [
      { label: "Spotify", href: "https://open.spotify.com/" },
      { label: "YT Music", href: "https://music.youtube.com/" },
    ],
    watchLinks: [
      { label: "YouTube", href: "https://www.youtube.com/" },
      { label: "Instagram", href: "https://www.instagram.com/eklautarecords/" },
    ],
  },
];

const linkGroupClass =
  "inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-300 transition hover:text-orange-200";

const ReleasesSection = () => {
  const scrollerRef = useRef(null);

  const scrollReleases = (direction) => {
    const container = scrollerRef.current;

    if (!container) {
      return;
    }

    const scrollAmount = 360;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const nextScrollLeft = container.scrollLeft + direction * scrollAmount;
    const edgeThreshold = 24;

    if (direction > 0 && nextScrollLeft >= maxScrollLeft - edgeThreshold) {
      container.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }

    if (direction < 0 && container.scrollLeft <= edgeThreshold) {
      container.scrollTo({ left: maxScrollLeft, behavior: "smooth" });
      return;
    }

    container.scrollBy({
      left: direction * scrollAmount,
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
            A scrollable shelf of EklautA Records posters with direct paths to
            listen and watch across music and social platforms.
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

                  <div className="space-y-4 px-0 pb-2 pt-5">
                    <div className="space-y-3">
                      <h3 className="font-mono text-2xl font-bold uppercase tracking-[0.04em] text-white">
                        {release.title}
                      </h3>
                      <span className="inline-flex rounded-full border border-orange-400/35 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-300">
                        {release.type}
                      </span>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-stone-500">
                          Listen
                        </span>
                        {release.listenLinks.map((link) => (
                          <a
                            key={`${release.title}-${link.label}`}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className={linkGroupClass}
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-stone-500">
                          Watch
                        </span>
                        {release.watchLinks.map((link) => (
                          <a
                            key={`${release.title}-${link.label}`}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className={linkGroupClass}
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
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
