export function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
}

export async function findUserByEmailOrPhone(usersCol, email, phone) {
  const normalizedEmail = email.trim().toLowerCase();
  const phoneDigits = normalizePhone(phone);

  const byEmail = await usersCol.findOne({ email: normalizedEmail });
  if (byEmail) return byEmail;

  if (!phoneDigits) return null;

  const byPhoneDigits = await usersCol.findOne({ phoneDigits });
  if (byPhoneDigits) return byPhoneDigits;

  const users = await usersCol.find({ phoneDigits: { $exists: false } }).toArray();
  return users.find((u) => normalizePhone(u.phone) === phoneDigits) ?? null;
}
