export const PageShell = ({ eyebrow, title, intro, children }) => {
  return (
    <section className="min-h-screen bg-stone-950 pb-24 pt-32">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-orange-300">
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl font-['Space_Grotesk'] text-4xl font-bold uppercase tracking-[0.08em] text-white md:text-5xl">
          {title}
        </h1>
        {intro ? (
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300">
            {intro}
          </p>
        ) : null}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
};

export const Panel = ({ children, className = "" }) => {
  return (
    <div
      className={`rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
};

export const SignInPrompt = ({ message, onOpenAuth }) => {
  return (
    <Panel className="max-w-xl">
      <p className="leading-7 text-stone-300">{message}</p>
      <button
        type="button"
        onClick={onOpenAuth}
        className="mt-6 rounded-full bg-orange-500 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400"
      >
        Sign in with Google
      </button>
    </Panel>
  );
};

export const Tabs = ({ tabs, value, onChange }) => {
  return (
    <div className="mb-10 flex flex-wrap gap-x-1 border-b border-white/10 sm:gap-x-2" role="tablist">
      {tabs.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`whitespace-nowrap border-b-2 px-2.5 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition sm:px-4 sm:text-xs sm:tracking-[0.25em] ${
            value === option.value
              ? "border-orange-400 text-white"
              : "border-transparent text-stone-400 hover:text-orange-200"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export const LoadingText = ({ children = "Loading…" }) => {
  return <p className="text-stone-400">{children}</p>;
};
