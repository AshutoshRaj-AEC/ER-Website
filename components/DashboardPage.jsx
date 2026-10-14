import { Suspense, lazy, useEffect, useState } from "react";
import ArtistHome from "./ArtistHome";
import GrowthTracker from "./GrowthTracker";
import SongVault from "./SongVault";
import { LoadingText, PageShell, Panel, SignInPrompt, Tabs } from "./PageShell";
import PlanDetail from "./PlanDetail";
import PlanList from "./PlanList";
import { getUserProfile, supabase } from "../lib/supabase";
import { PLAN_LIST_SELECT } from "../lib/releasePlans";

// Insights is large and only needed on its tab, so it loads on demand.
const InsightsTab = lazy(() => import("./insights/InsightsTab"));

const getPlanIdFromUrl = () =>
  new URLSearchParams(window.location.search).get("plan");

const getTabFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (["plans", "growth", "vault", "insights"].includes(tab)) return tab;
  return params.get("plan") ? "plans" : "home";
};

const TABS = [
  { value: "home", label: "Home" },
  { value: "plans", label: "Release plans" },
  { value: "growth", label: "Growth" },
  { value: "vault", label: "Song vault" },
  { value: "insights", label: "Spotify Insights" },
];

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-stone-100 placeholder:text-stone-500 focus:border-orange-300 focus:outline-none";

const NewPlanForm = ({ defaultArtistName, onCreate, onCancel }) => {
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState(defaultArtistName);
  const [releaseDate, setReleaseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const createError = await onCreate({
      title: title.trim(),
      artist_name: artistName.trim(),
      release_date: releaseDate || null,
    });
    setSaving(false);
    if (createError) {
      setError("Couldn't create the plan. Please try again.");
    }
  };

  return (
    <Panel>
      <form onSubmit={handleSubmit}>
        <h2 className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.08em] text-white">
          New release plan
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-300">
              Release title
            </span>
            <input
              required
              maxLength={200}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-300">
              Artist name
            </span>
            <input
              required
              maxLength={200}
              value={artistName}
              onChange={(event) => setArtistName(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-300">
              Release date
            </span>
            <input
              type="date"
              value={releaseDate}
              onChange={(event) => setReleaseDate(event.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </label>
        </div>
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-orange-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400 disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create plan"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-300 transition hover:border-orange-300 hover:text-orange-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
};

const DashboardPage = ({ session, authReady, onOpenAuth }) => {
  const user = session?.user;
  const [tab, setTab] = useState(getTabFromUrl);
  const [selectedPlanId, setSelectedPlanId] = useState(getPlanIdFromUrl);
  const [plans, setPlans] = useState(null);
  const [unplannedSubmissions, setUnplannedSubmissions] = useState([]);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    document.title = "Artist Dashboard | EklautA Records";

    const handlePopState = () => {
      setTab(getTabFromUrl());
      setSelectedPlanId(getPlanIdFromUrl());
    };
    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!user?.id || selectedPlanId || tab !== "plans") {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      const [plansResult, submissionsResult] = await Promise.all([
        supabase
          .from("release_plans")
          .select(PLAN_LIST_SELECT)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("submissions")
          .select("id, track_title, artist_name, release_date, release_plans(id)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) {
        return;
      }

      if (plansResult.error || submissionsResult.error) {
        setLoadError("Couldn't load your plans. Refresh to try again.");
        setPlans([]);
        return;
      }

      setPlans(plansResult.data);
      setUnplannedSubmissions(
        submissionsResult.data.filter((submission) => submission.release_plans.length === 0)
      );
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user?.id, selectedPlanId, tab, reloadKey]);

  const selectTab = (nextTab) => {
    window.history.pushState({}, "", nextTab === "home" ? "/dashboard" : `/dashboard?tab=${nextTab}`);
    setTab(nextTab);
    setSelectedPlanId(null);
  };

  const openPlan = (planId) => {
    window.history.pushState({}, "", `/dashboard?plan=${planId}`);
    setSelectedPlanId(planId);
    window.scrollTo({ top: 0 });
  };

  const closePlan = () => {
    window.history.pushState({}, "", "/dashboard?tab=plans");
    setSelectedPlanId(null);
    setReloadKey((current) => current + 1);
    window.scrollTo({ top: 0 });
  };

  const createPlan = async (fields) => {
    const { data, error } = await supabase
      .from("release_plans")
      .insert(fields)
      .select("id")
      .single();

    if (error) {
      console.error(error);
      return error;
    }

    setShowNewPlan(false);
    openPlan(data.id);
    return null;
  };

  const planSubmission = async (submission) => {
    const error = await createPlan({
      title: submission.track_title,
      artist_name: submission.artist_name,
      release_date: submission.release_date,
      submission_id: submission.id,
    });

    if (error) {
      setLoadError("Couldn't create the plan. Please try again.");
    }
  };

  const shell = (children) => (
    <PageShell
      eyebrow="Artist dashboard"
      title="Run your release like a label"
      intro="Plan the budget for each release, see how many streams it takes to earn it back, and track how your audience grows, and keep every song idea safe in your vault."
    >
      {user ? <Tabs tabs={TABS} value={tab} onChange={selectTab} /> : null}
      {children}
    </PageShell>
  );

  if (!authReady) {
    return shell(<LoadingText />);
  }

  if (!user) {
    return shell(
      <SignInPrompt
        message="Sign in with Google to plan your releases and budgets."
        onOpenAuth={onOpenAuth}
      />
    );
  }

  if (tab === "home") {
    return shell(<ArtistHome userId={user.id} onSelectTab={selectTab} />);
  }

  if (tab === "insights") {
    return shell(
      <Suspense fallback={<LoadingText />}>
        <InsightsTab userId={user.id} />
      </Suspense>
    );
  }

  if (tab === "vault") {
    return shell(<SongVault userId={user.id} />);
  }

  if (tab === "growth") {
    return shell(
      <GrowthTracker userId={user.id} defaultArtistName={getUserProfile(user)?.name ?? ""} />
    );
  }

  if (selectedPlanId) {
    return shell(
      <PlanDetail planId={selectedPlanId} onBack={closePlan} onDeleted={closePlan} />
    );
  }

  return shell(
    <div className="space-y-10">
      {loadError ? <p className="text-red-300">{loadError}</p> : null}

      {unplannedSubmissions.length > 0 ? (
        <Panel>
          <h2 className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.08em] text-white">
            Submitted tracks without a plan
          </h2>
          <ul className="mt-6 space-y-3">
            {unplannedSubmissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 p-4"
              >
                <span className="min-w-0 text-stone-100">
                  {submission.track_title}
                  <span className="text-stone-500"> · {submission.artist_name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => planSubmission(submission)}
                  className="rounded-full bg-orange-500 px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-orange-400"
                >
                  Plan this release
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {showNewPlan ? (
        <NewPlanForm
          defaultArtistName={getUserProfile(user)?.name ?? ""}
          onCreate={createPlan}
          onCancel={() => setShowNewPlan(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNewPlan(true)}
          className="rounded-full bg-orange-500 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400"
        >
          + New release plan
        </button>
      )}

      {plans === null ? (
        <LoadingText />
      ) : plans.length === 0 ? (
        <p className="text-stone-400">
          No plans yet. Start one for your next release, even before it's
          finished.
        </p>
      ) : (
        <PlanList plans={plans} onOpen={openPlan} />
      )}
    </div>
  );
};

export default DashboardPage;
