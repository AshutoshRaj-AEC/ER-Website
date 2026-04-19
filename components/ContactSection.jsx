const ContactSection = () => {
  return (
    <section id="contact" className="bg-stone-950 py-24">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <div className="rounded-[2.5rem] border border-orange-400/20 bg-gradient-to-br from-orange-500/10 via-white/5 to-transparent px-8 py-12 sm:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.45em] text-orange-300">
            Contact
          </p>
          <h2 className="mt-4 max-w-3xl font-['Space_Grotesk'] text-4xl font-bold uppercase tracking-[0.08em] text-white md:text-5xl">
            Send the demo. Start the conversation.
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            If your sound feels undeniable and your artistic identity is already
            taking shape, EklautA Records is open to hearing what you are
            building.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="mailto:hello@eklautarecords.com"
              className="rounded-full bg-orange-500 px-8 py-4 text-center text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400"
            >
              hello@eklautarecords.com
            </a>
            <a
              href="#top"
              className="rounded-full border border-white/20 bg-white/5 px-8 py-4 text-center text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-orange-300 hover:text-orange-200"
            >
              Back To Top
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
