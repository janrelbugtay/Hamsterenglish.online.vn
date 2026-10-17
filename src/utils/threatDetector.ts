// Automated Email Threat Detection Engine for Hamster English
// Analyzes user emails for spoofing, impersonation, burner domains, phishing signatures, and bot patterns.

export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'safe';

export interface ThreatReport {
  level: ThreatLevel;
  score: number; // 0 (safest) to 100 (highest danger)
  primaryThreat: string;
  flags: string[];
  recommendation: string;
  isSuperAdmin: boolean;
  domain: string;
  localPart: string;
}

export const SUPER_ADMIN_EMAIL = 'janrelbugtay03@gmail.com';

// Known temporary and disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com', 'temp-mail.org', '10minutemail.com', 'guerrillamail.com', 'guerrillamail.net',
  'mailinator.com', 'sharklasers.com', 'yopmail.com', 'trashmail.com', 'dispostable.com',
  'burnermail.io', 'getnada.com', 'mohmal.im', 'throwawaymail.com', 'tempail.com',
  'fakeinbox.com', 'crazymailing.com', 'emailondeck.com', 'generator.email', 'inboxkitten.com',
  'mytemp.email', 'dropmail.me', 'armyspy.com', 'cuvox.de', 'dayrep.com', 'fleckens.hu',
  'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us', 'tinypulse.net',
  'maildrop.cc', 'nada.ltd', 'trashmail.net', 'burnermail.com', 'fakemailgenerator.com',
  'emailfake.com', 'mohmal.com', 'crazymailing.com', 'tempinbox.com', 'disposablemail.com',
  'mytempemail.com', 'spambog.com', 'tempemail.net', 'yopmail.fr', 'yopmail.net'
]);

// High-risk TLDs commonly used by disposable or abusive bots
const HIGH_RISK_TLDS = new Set([
  'top', 'xyz', 'click', 'buzz', 'rest', 'tk', 'ml', 'ga', 'cf', 'gq', 'work', 'link', 'loan', 'cam', 'quest'
]);

// Free public webmail domains
const PUBLIC_WEBMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com',
  'outlook.com', 'live.com', 'icloud.com', 'aol.com', 'mail.com', 'zoho.com', 'protonmail.com', 'proton.me'
]);

/**
 * Examines an email address and returns a comprehensive ThreatReport
 */
export function examineUserThreat(user: { email?: string; displayName?: string; isAnonymous?: boolean }): ThreatReport {
  const rawEmail = (user.email || '').trim().toLowerCase();
  const displayName = (user.displayName || '').trim().toLowerCase();

  // 1. Super Admin Immunity Check
  if (rawEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return {
      level: 'safe',
      score: 0,
      primaryThreat: 'Super Admin (Verified)',
      flags: ['Verified Super Administrator', 'Protected immune status'],
      recommendation: 'Immune to automated administrative actions.',
      isSuperAdmin: true,
      domain: 'gmail.com',
      localPart: 'janrelbugtay03'
    };
  }

  // 2. Anonymous / Guest account check
  if (user.isAnonymous || !rawEmail || rawEmail === 'user' || rawEmail === 'no email') {
    return {
      level: 'low',
      score: 10,
      primaryThreat: 'Guest Player',
      flags: ['Anonymous session or guest user', 'No verified email linked'],
      recommendation: 'Safe to keep or prune periodically during maintenance.',
      isSuperAdmin: false,
      domain: '',
      localPart: ''
    };
  }

  const parts = rawEmail.split('@');
  if (parts.length !== 2) {
    return {
      level: 'high',
      score: 85,
      primaryThreat: 'Malformed Email Syntax',
      flags: ['Invalid email formatting', 'Potential injection or broken user profile'],
      recommendation: 'Recommend deleting this invalid record.',
      isSuperAdmin: false,
      domain: '',
      localPart: rawEmail
    };
  }

  const localPart = parts[0];
  const domain = parts[1];
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];

  const flags: string[] = [];
  let score = 0;
  let primaryThreat = 'Clean';

  // --- THREAT CHECK 1: Institutional / School Domain Spoofing (e.g. khaisangschool.edu.vn@gmail.com) ---
  const isPublicWebmail = PUBLIC_WEBMAIL_DOMAINS.has(domain);
  const containsSchoolOrInstitution = /((\.edu|\.ac|\.sch|\.k12|\.uni|\.gov)(\.[a-z]{2,3})?|school|university|academy|college|institute|district|preschool|elementary|kindergarten)/i.test(localPart);

  if (isPublicWebmail && containsSchoolOrInstitution) {
    score += 85;
    primaryThreat = 'Institutional Domain Spoofing';
    flags.push(
      `School/Institution Impersonation: Local part "${localPart}" embeds an official educational domain inside public ${domain}`,
      'High social engineering & phishing risk toward students or staff'
    );
  }

  // --- THREAT CHECK 2: Admin / Platform Impersonation ---
  const adminKeywords = ['admin', 'superadmin', 'administrator', 'root', 'hamsterenglish', 'official', 'support-team', 'security-team', 'billing-hamster'];
  const hasAdminKeyword = adminKeywords.some(kw => localPart.includes(kw));

  if (hasAdminKeyword && rawEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    score += 75;
    if (primaryThreat === 'Clean') primaryThreat = 'Admin Impersonation';
    flags.push(`Attempted Impersonation: Email username contains privileged administrative term "${localPart}"`);
  }

  // --- THREAT CHECK 3: Disposable / Burner Email Service ---
  if (DISPOSABLE_DOMAINS.has(domain) || domain.includes('temp') || domain.includes('dispos') || domain.includes('fake') || domain.includes('burner')) {
    score += 80;
    if (primaryThreat === 'Clean') primaryThreat = 'Disposable / Burner Email';
    flags.push(`Known Disposable Domain: "${domain}" is a temporary/burner email service commonly used by malicious actors or throwaway bots.`);
  }

  // --- THREAT CHECK 4: Suspicious TLDs ---
  if (HIGH_RISK_TLDS.has(tld)) {
    score += 35;
    flags.push(`High-Risk TLD: Domain ends in ".${tld}" which has a high correlation with automated spam`);
  }

  // --- THREAT CHECK 5: Phishing / Exploit Signatures in username ---
  const maliciousKeywords = ['phish', 'exploit', 'hacker', 'pwn', 'trojan', 'malware', 'keylog', 'stealer', 'payload', 'ddos', 'botnet', 'rat-', 'c2-'];
  for (const kw of maliciousKeywords) {
    if (localPart.includes(kw)) {
      score += 70;
      if (primaryThreat === 'Clean') primaryThreat = 'Malicious Keyword Signature';
      flags.push(`Malicious Keyword Detected: Contains forbidden threat keyword "${kw}"`);
      break;
    }
  }

  // --- THREAT CHECK 6: Bot-like Random Hex or High-Entropy Username ---
  const isHighEntropy = /^[a-z0-9]{16,}$/i.test(localPart) || /^[0-9a-f]{10,}$/i.test(localPart) || /^[bcdfghjklmnpqrstvwxyz]{7,}$/i.test(localPart);
  if (isHighEntropy) {
    score += 30;
    flags.push('Suspicious Pattern: High entropy or randomized character string resembling automated bot generation');
  }

  // Determine threat level & recommendation
  score = Math.min(score, 100);

  let level: ThreatLevel = 'safe';
  let recommendation = 'Account appears legitimate. No administrative action required.';

  if (score >= 75) {
    level = 'critical';
    recommendation = '🚨 High threat detected. Recommend immediate deletion and monitoring.';
  } else if (score >= 50) {
    level = 'high';
    recommendation = '⚠️ Severe threat indicator. Review account details and consider deletion.';
  } else if (score >= 25) {
    level = 'medium';
    recommendation = '🔎 Suspicious pattern observed. Keep under observation or verify with user.';
  } else if (score > 0) {
    level = 'low';
    recommendation = 'Minor anomalies detected; likely harmless.';
  } else {
    primaryThreat = 'Legitimate Account';
  }

  return {
    level,
    score,
    primaryThreat,
    flags,
    recommendation,
    isSuperAdmin: false,
    domain,
    localPart
  };
}

/**
 * Filter users based on threat level category
 */
export function categorizeThreats(users: any[]) {
  const analyzed = users.map(user => ({
    user,
    threat: examineUserThreat(user)
  }));

  const critical = analyzed.filter(a => a.threat.level === 'critical' || a.threat.level === 'high');
  const medium = analyzed.filter(a => a.threat.level === 'medium');
  const safe = analyzed.filter(a => a.threat.level === 'safe' || a.threat.level === 'low');
  const superAdmin = analyzed.filter(a => a.threat.isSuperAdmin);

  return {
    analyzed,
    critical,
    medium,
    safe,
    superAdmin,
    totalThreats: critical.length + medium.length
  };
}
