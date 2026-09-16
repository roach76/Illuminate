// gh_config.example.js — COPY this file to gh_config.js and fill in your
// own values. gh_config.js itself is listed in .gitignore and must NEVER
// be committed — it holds a real credential.
//
// dashboard.html loads gh_config.js (if present) to automatically fetch
// the latest scored report from your private GitHub repo on page load,
// with no manual file upload. If gh_config.js is missing or GH_CONFIG is
// left as null, the dashboard falls back to the manual "Choose File"
// picker — nothing breaks, you just lose the automation.
//
// HOW TO GET A TOKEN (do this once):
//   1. Go to https://github.com/settings/tokens?type=beta
//   2. Click "Generate new token" (fine-grained)
//   3. Token name: e.g. "job-dashboard-readonly"
//   4. Expiration: pick something reasonable (90 days is fine — you'll
//      need to generate a new one and update gh_config.js when it expires)
//   5. Repository access: "Only select repositories" -> choose your
//      job-search-tracker repo (or whatever you named it) — NOT all repos
//   6. Permissions -> Repository permissions -> "Contents" -> Read-only
//      (leave every other permission as "No access")
//   7. Generate token, copy it immediately (you won't see it again)
//   8. Paste it into GH_TOKEN below
//
// This token can ONLY read files from this one repository. It cannot
// write, cannot delete, cannot see your other repos, cannot see your
// account settings. If it's ever exposed, the damage is limited to
// someone being able to read your job-search data — regenerate and
// revoke it immediately at the URL above if that ever happens.

const GH_CONFIG = {
  owner: "YOUR_GITHUB_USERNAME",
  repo: "job-search-tracker",       // change if you named your repo differently
  token: "YOUR_FINE_GRAINED_TOKEN_HERE",
};
