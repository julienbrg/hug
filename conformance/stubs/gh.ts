// Stands in for gh in the scenario tests. `gh pr checks` answers with the
// JSON in HUG_STUB_CHECKS, "none" for a pull request without checks, or
// "error" for a failing gh.

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
process.stderr.write("gh stub: unexpected call\n");
process.exit(1);
