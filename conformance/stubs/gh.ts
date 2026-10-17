// Stands in for gh in the scenario tests. `gh pr checks` answers with the
// JSON in HUG_STUB_CHECKS, "none" for a pull request without checks, or
// "error" for a failing gh. `gh api` on sub_issues answers with the issues
// in HUG_STUB_SUBISSUES, such as "3,4:closed,5", open unless marked closed.
// `gh pr list` answers with the JSON in HUG_STUB_PRS.

const [command, action] = process.argv.slice(2);
const checks = process.env.HUG_STUB_CHECKS ?? "error";

if (command === "pr" && action === "checks") {
  if (checks === "none") {
    process.stderr.write("no checks reported on the '1-branch' branch\n");
    process.exit(1);
  }
  if (checks !== "error") {
    process.stdout.write(checks);
    process.exit(0);
  }
}
if (command === "api" && process.argv.some((a) => a.includes("/sub_issues"))) {
  const issues = process.env.HUG_STUB_SUBISSUES;
  if (issues !== undefined) {
    const list = issues
      .split(",")
      .filter(Boolean)
      .map((issue) => {
        const [number, state = "open"] = issue.split(":");
        return { number: Number(number), state };
      });
    process.stdout.write(JSON.stringify(list));
    process.exit(0);
  }
}
if (command === "pr" && action === "list") {
  const prs = process.env.HUG_STUB_PRS;
  if (prs !== undefined) {
    process.stdout.write(prs);
    process.exit(0);
  }
}
process.stderr.write("gh stub: unexpected call\n");
process.exit(1);
