import StatusBadge from "./StatusBadge";
import {
  CHECKLIST_TASKS,
  countDoneTasks,
  formatDate,
  formatMoney,
  parseDate,
  sumBudget,
} from "../lib/releasePlans";

const PlanList = ({ plans, onOpen }) => {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {plans.map((plan) => {
        const totals = sumBudget(plan.budget_items);
        const doneCount = countDoneTasks(plan.checklist_completions, plan.submission);

        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onOpen(plan.id)}
            className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-left transition hover:border-orange-300/60 sm:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.06em] text-white">
                  {plan.title}
                </p>
                <p className="mt-1 text-sm text-stone-400">
                  {plan.artist_name}
                  {plan.release_date
                    ? ` · releases ${formatDate(parseDate(plan.release_date))}`
                    : ""}
                </p>
              </div>
              {plan.submission ? <StatusBadge status={plan.submission.status} /> : null}
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Planned
                </dt>
                <dd className="mt-1 text-stone-100">
                  {formatMoney(totals.planned, plan.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Spent
                </dt>
                <dd className="mt-1 text-stone-100">
                  {formatMoney(totals.actual, plan.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Checklist
                </dt>
                <dd className="mt-1 text-stone-100">
                  {doneCount}/{CHECKLIST_TASKS.length}
                </dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>
  );
};

export default PlanList;
