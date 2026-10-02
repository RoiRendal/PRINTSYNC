/**
 * Gives every branch a complete identity row.
 *
 * Run with:  npm run branding:sync   (from the backend workspace)
 * Options:   --branch CODE   limit to one branch (BAL, NAS, or a uuid)
 *            --dry-run       report what would change and write nothing
 *
 * ## Why this exists
 *
 * `20261002000200_branches.sql` created a `business_settings` row per branch by
 * copying Balayan's, so a second branch starts with its own *name* but may hold
 * no **logo**. The logo is uploaded once, to a fixed Storage path, by whichever
 * branch the demo seed ran for — every other branch is left with a null
 * `logo_url` and renders the initials placeholder instead of the shop's mark.
 *
 * That is a real defect, not a cosmetic one: the login screen and every printed
 * slip for the second branch carry no brand. It is invisible in testing because
 * the app degrades gracefully — an absent logo is a legitimate state (a shop
 * that has not uploaded one yet) — so nothing fails, the mark is simply missing.
 *
 * ## Why it shares one URL across branches
 *
 * The branches are two sites of **one business**, so the mark is the same mark.
 * Copying the URL rather than uploading a second object means there is one file
 * to replace when the owner redesigns the logo, and no chance of the two shops
 * drifting to different artwork by accident. A branch that wants its own mark
 * uploads one through Settings, which writes only that branch's row.
 *
 * ## What it will not do
 *
 * It never overwrites a logo a branch already has. A branch holding its own
 * uploaded mark is a decision someone made, and a maintenance script is not the
 * place to reverse it — so those rows are reported and skipped.
 *
 * ## The address
 *
 * It carries no address of its own, deliberately. An address is the one field
 * that is genuinely *per site* — Poblacion for Balayan, the Nasugbu town proper
 * for Nasugbu — and inventing one here would print a made-up street on a real
 * customer's receipt. The script reports a branch whose address is still blank
 * so it is a visible gap and not a silent one; the value is entered once, in
 * Settings, by someone who knows the shop's real address.
 */

import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface BranchRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface SettingsRow {
  id: number;
  branch_id: string;
  business_name: string;
  address: string | null;
  logo_url: string | null;
}

const BRANCH_CODE = /^[A-Z][A-Z0-9]{1,7}$/;
const BRANCH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function requestedBranch(): string | null {
  const inline = args.find((argument) => argument.startsWith('--branch='));
  if (inline) return inline.slice('--branch='.length).trim();
  const index = args.indexOf('--branch');
  if (index !== -1) {
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error('--branch needs a value: --branch NAS, --branch BAL, or --branch <uuid>.');
    }
    return value.trim();
  }
  return null;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. Run this from the backend workspace.`);
  return value;
}

/** A logo is only usable if it is a hosted URL — the same rule the provider applies. */
function isHostedLogo(value: string | null): boolean {
  return value !== null && /^https?:\/\//.test(value);
}

async function main(): Promise<void> {
  const supabase: SupabaseClient = createClient(
    requiredEnvironment('SUPABASE_URL'),
    requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: branchData, error: branchError } = await supabase
    .from('branches')
    .select('id, code, name, is_active')
    .order('code');
  if (branchError) throw new Error(`Could not read branches: ${branchError.message}`);
  const branches = (branchData ?? []) as BranchRow[];
  if (branches.length === 0) throw new Error('No branches are configured.');

  const { data: settingsData, error: settingsError } = await supabase
    .from('business_settings')
    .select('id, branch_id, business_name, address, logo_url');
  if (settingsError) throw new Error(`Could not read business settings: ${settingsError.message}`);
  const settings = (settingsData ?? []) as SettingsRow[];

  // The reference is the earliest row that actually has a usable logo. Using the
  // earliest rather than "the first row returned" keeps the choice stable across
  // runs — without an order the API may hand back either row first, and the
  // script would then flip which branch is treated as the source.
  const source = [...settings]
    .filter((row) => isHostedLogo(row.logo_url))
    .sort((a, b) => a.id - b.id)[0];

  if (!source) {
    throw new Error(
      'No branch has a logo, so there is nothing to share. Upload one through Settings, or run the demo seed with uploads enabled.',
    );
  }

  const sourceBranch = branches.find((branch) => branch.id === source.branch_id);
  console.log(`Logo source: ${sourceBranch?.code ?? '?'} (settings row ${source.id})`);
  console.log(`${source.logo_url as string}\n`);

  const requested = requestedBranch();
  let targets = branches;
  if (requested) {
    const byCode = BRANCH_CODE.test(requested);
    const byId = !byCode && BRANCH_UUID.test(requested);
    if (!byCode && !byId) {
      throw new Error(`--branch must be a branch code such as BAL or NAS, or a branch uuid. Received "${requested}".`);
    }
    const match = byCode
      ? branches.find((branch) => branch.code.toUpperCase() === requested.toUpperCase())
      : branches.find((branch) => branch.id === requested);
    if (!match) {
      const list = branches.map((branch) => `${branch.code} (${branch.name})`).join(', ');
      throw new Error(`No branch matches "${requested}". Configured branches: ${list}.`);
    }
    targets = [match];
  }

  let written = 0;
  let skipped = 0;

  for (const branch of targets) {
    const row = settings.find((candidate) => candidate.branch_id === branch.id);
    if (!row) {
      console.log(`  ${branch.code.padEnd(4)} no business_settings row — skipping (run the branch migrations)`);
      skipped += 1;
      continue;
    }
    if (isHostedLogo(row.logo_url)) {
      const same = row.logo_url === source.logo_url;
      console.log(`  ${branch.code.padEnd(4)} already has a logo${same ? ' (the shared one)' : ' of its own'} — left alone`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  ${branch.code.padEnd(4)} WOULD set logo_url to the shared mark`);
      written += 1;
      continue;
    }

    const { error } = await supabase
      .from('business_settings')
      .update({ logo_url: source.logo_url })
      .eq('branch_id', branch.id);
    if (error) throw new Error(`Could not set the logo for ${branch.code}: ${error.message}`);
    console.log(`  ${branch.code.padEnd(4)} logo_url set to the shared mark`);
    written += 1;
  }

  console.log(`\n${dryRun ? 'Would update' : 'Updated'} ${written}, skipped ${skipped}.`);
  if (dryRun) console.log('Dry run: nothing was written.');

  // A blank address is not fixed here — it is reported. See the header note: the
  // street is genuinely per site, and only the shop can supply it.
  const blankAddress = targets
    .map((branch) => ({ branch, row: settings.find((candidate) => candidate.branch_id === branch.id) }))
    .filter((entry) => entry.row && (entry.row.address ?? '').trim() === '');
  if (blankAddress.length > 0) {
    console.log('\nPrinted address missing for:');
    for (const { branch } of blankAddress) {
      console.log(`  ${branch.code} — ${branch.name}: receipts print no address line`);
    }
    console.log('Set it in Settings → Business profile. It is the one field that differs per site.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Branding sync failed.');
  process.exitCode = 1;
});
