import { useRef } from "react";
import aigiriNandiniPosterSmall from "../Posters/web/aigiri-nandini-x-aatma-rama-480.webp";
import aigiriNandiniPosterLarge from "../Posters/web/aigiri-nandini-x-aatma-rama-960.webp";
import aisoDeenDayalPosterSmall from "../Posters/web/aiso-deen-dayal-dhan-dhan-bholenath-480.webp";
import aisoDeenDayalPosterLarge from "../Posters/web/aiso-deen-dayal-dhan-dhan-bholenath-960.webp";
import anantShrutiPosterSmall from "../Posters/web/anant-shruti-enhanced-480.webp";
import anantShrutiPosterLarge from "../Posters/web/anant-shruti-enhanced-960.webp";
import bholaPosterSmall from "../Posters/web/bhola-480.webp";
import bholaPosterLarge from "../Posters/web/bhola-960.webp";
import chandrachoodaPosterSmall from "../Posters/web/chandrachooda-shiva-shankara-parvati-480.webp";
import chandrachoodaPosterLarge from "../Posters/web/chandrachooda-shiva-shankara-parvati-960.webp";
import durgaShaktiPosterSmall from "../Posters/web/durga-shakti-sarva-mangal-mangalye-480.webp";
import durgaShaktiPosterLarge from "../Posters/web/durga-shakti-sarva-mangal-mangalye-960.webp";
import heyMarutiPosterSmall from "../Posters/web/hey-maruti-480.webp";
import heyMarutiPosterLarge from "../Posters/web/hey-maruti-960.webp";
import kalyugVsMahadevPosterSmall from "../Posters/web/kalyug-vs-mahadev-480.webp";
import kalyugVsMahadevPosterLarge from "../Posters/web/kalyug-vs-mahadev-960.webp";

// Posters are served as small WebP copies made by scripts/optimize-posters.py;
// the browser picks 480 or 960 px depending on the card size and screen.
const poster = (small, large) => ({ src: small, srcSet: `${small} 480w, ${large} 960w` });

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

const INSTAGRAM = "https://www.instagram.com/eklautarecords/";

// Real store links for each release. Leave a platform out when the release
// isn't on it, and the card won't show that button.
const storeLinks = ({ spotify, appleMusic, ytMusic, youtube }) => ({
  listenLinks: [
    spotify && { label: "Spotify", href: spotify },
    appleMusic && { label: "Apple Music", href: appleMusic },
    ytMusic && { label: "YT Music", href: ytMusic },
  ].filter(Boolean),
  watchLinks: [
    youtube && { label: "YouTube", href: youtube },
    { label: "Instagram", href: INSTAGRAM },
  ].filter(Boolean),
});

const releases = [
  {
    title: "Aigiri Nandini X Aatma Rama",
    type: "Music Video",
    image: poster(aigiriNandiniPosterSmall, aigiriNandiniPosterLarge),
    ...storeLinks({
      spotify: "https://open.spotify.com/album/2sguqrHeToWvUEKj74j1H3",
      ytMusic: "https://music.youtube.com/browse/MPREb_XWdGOLid4xC",
      youtube: "https://www.youtube.com/watch?v=Cj9nekOl7Nc",
    }),
  },
  {
    title: "Aiso Deen Dayal",
    type: "Single",
    image: poster(aisoDeenDayalPosterSmall, aisoDeenDayalPosterLarge),
    ...storeLinks({
      spotify: "https://open.spotify.com/album/2EjsWInd6xOiyTWwGezlSR",
      appleMusic: "https://music.apple.com/in/album/aiso-deen-dayal-dhan-dhan-bholenath/1777589376",
      ytMusic: "https://music.youtube.com/browse/MPREb_YXu6ZLfNFtK",
      youtube: "https://www.youtube.com/watch?v=rpLueWm6ON4",
    }),
  },
  {
    title: "Anant Shruti",
    type: "Album",
    image: poster(anantShrutiPosterSmall, anantShrutiPosterLarge),
    ...storeLinks({
      spotify: "https://open.spotify.com/album/1ZWSIqsSxvCrgoumeXJdAx",
      appleMusic: "https://music.apple.com/in/album/anant-shruti/6768676155",
      ytMusic: "https://music.youtube.com/playlist?list=OLAK5uy_nI-kH_ZGOJmQfs8X3CFJaEbnsrspgw18s",
      youtube: "https://www.youtube.com/playlist?list=OLAK5uy_nI-kH_ZGOJmQfs8X3CFJaEbnsrspgw18s",
    }),
  },
  {
    title: "Bhola",
    type: "Instagram Reel",
    image: poster(bholaPosterSmall, bholaPosterLarge),
    ...storeLinks({
      spotify: "https://open.spotify.com/album/49HbFSNrITGxfo7IWpD3Le",
      ytMusic: "https://music.youtube.com/browse/MPREb_WTVM6glEdFp",
      youtube: "https://www.youtube.com/watch?v=OC4Z1cA_2X4",
    }),
  },
  {
    title: "Chandrachooda Shiva Shankara Parvati",
    type: "Single",
    image: poster(chandrachoodaPosterSmall, chandrachoodaPosterLarge),
    ...storeLinks({
      spotify: "https://open.spotify.com/album/18wBlMBWx83h3bkKA2mPv5",
      appleMusic: "https://music.apple.com/in/album/chandrachooda-shiva-shankara-parvati/1836521105",
      ytMusic: "https://music.youtube.com/browse/MPREb_4tFJgZSiBgi",
      youtube: "https://www.youtube.com/watch?v=_55dDdCu_us",
    }),
  },
  {
    title: "Durga Shakti",
    type: "Music Video",
    image: poster(durgaShaktiPosterSmall, durgaShaktiPosterLarge),
    ...storeLinks({
      spotify: "https://open.spotify.com/album/1g9NLtndm7ZzWH7ZOIO4Xi",
      appleMusic: "https://music.apple.com/in/album/durga-shakti-sarva-mangal-mangalye/1841693574",
      ytMusic: "https://music.youtube.com/browse/MPREb_olr09B5W5U7",
      youtube: "https://www.youtube.com/watch?v=IG3Oxk7ohMg",
    }),
  },
  {
    title: "Hey Maruti",
    type: "Single",
    image: poster(heyMarutiPosterSmall, heyMarutiPosterLarge),
    ...storeLinks({
      spotify: "https://open.spotify.com/album/5GXqRVsL8rITYs5ddu3urk",
      appleMusic: "https://music.apple.com/in/album/hey-maruti/1773328373",
      ytMusic: "https://music.youtube.com/browse/MPREb_1nKOIQfYQHR",
      youtube: "https://www.youtube.com/watch?v=mQGBaq5Lb-Y",
    }),
  },
  {
    title: "Kalyug Vs Mahadev",
    type: "Release",
    image: poster(kalyugVsMahadevPosterSmall, kalyugVsMahadevPosterLarge),
    ...storeLinks({
      spotify: "https://open.spotify.com/album/2tIX5VdsYzkBSAqQKqjofN",
      appleMusic: "https://music.apple.com/in/album/kalyug-vs-mahadev/1734241529",
      ytMusic: "https://music.youtube.com/browse/MPREb_0PzJqQHqYQ2",
      youtube: "https://www.youtube.com/watch?v=Xeg-nLmJ9G8",
    }),
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
                      src={release.image.src}
                      srcSet={release.image.srcSet}
                      sizes="(min-width: 768px) 320px, (min-width: 640px) 55vw, 85vw"
                      alt={release.title}
                      width="480"
                      height="480"
                      loading="lazy"
                      decoding="async"
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
