// Validate an exact existing identity; never grant or change a role during provisioning.
export function existingRecruiter(rows, email) {
  const row = rows.length === 1 ? rows[0] : null;
  if (!row || String(row.email).trim().toLowerCase() !== email.trim().toLowerCase() ||
      Number(row.active) !== 1 || !['owner', 'admin', 'recruiter'].includes(String(row.role))) {
    throw Error(`Resolve the existing recruiter identity/role before provisioning ${email}. No recruiter rows are created or reassigned.`);
  }
  return row;
}
