# Planning

When asked to order or plan open issues, keep the plan in the tracker,
never in a ROADMAP.md file:

- Open a tracking issue (`Track …`, label `enhancement`, assigned to me,
  pinned). Its body lists the issues in order, grouped by milestone, with
  one line on why each sits where it does, and a "Done when" checklist.
- Add every listed issue as a sub-issue of the tracking issue, in the same
  order, so GitHub tracks progress on its own.
- Encode only real dependencies as "blocked by" links. Never add a link
  just to express priority; priority lives in the order.
- Before writing the plan, check whether an issue is already fixed
  (released artifacts, merged PRs), and draft a comment for any issue
  whose description is out of date.
- `gh api` calls take literal arguments only, with no `$(…)` or variables:
  look up the ids first, then call.
