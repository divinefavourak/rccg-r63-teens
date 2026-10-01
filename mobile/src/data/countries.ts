/**
 * Countries offered in the phone-number field.
 *
 * Nigeria first because that is where Region 63 is, then every African
 * country, then the places Nigerian families most often live abroad. It is a
 * practical list, not every country in the world: anyone missing can still
 * type their number with a leading `+` and country code, which is accepted
 * as written.
 */
export interface Country {
  /** ISO 3166-1 alpha-2, used for the flag. */
  iso: string;
  name: string;
  /** With the leading plus: "+234". */
  dial: string;
}

export const DEFAULT_COUNTRY: Country = { iso: 'NG', name: 'Nigeria', dial: '+234' };

export const COUNTRIES: Country[] = [
  DEFAULT_COUNTRY,

  // Africa
  { iso: 'DZ', name: 'Algeria', dial: '+213' },
  { iso: 'AO', name: 'Angola', dial: '+244' },
  { iso: 'BJ', name: 'Benin', dial: '+229' },
  { iso: 'BW', name: 'Botswana', dial: '+267' },
  { iso: 'BF', name: 'Burkina Faso', dial: '+226' },
  { iso: 'BI', name: 'Burundi', dial: '+257' },
  { iso: 'CV', name: 'Cabo Verde', dial: '+238' },
  { iso: 'CM', name: 'Cameroon', dial: '+237' },
  { iso: 'CF', name: 'Central African Republic', dial: '+236' },
  { iso: 'TD', name: 'Chad', dial: '+235' },
  { iso: 'KM', name: 'Comoros', dial: '+269' },
  { iso: 'CG', name: 'Congo', dial: '+242' },
  { iso: 'CD', name: 'Congo (DRC)', dial: '+243' },
  { iso: 'CI', name: 'Côte d’Ivoire', dial: '+225' },
  { iso: 'DJ', name: 'Djibouti', dial: '+253' },
  { iso: 'EG', name: 'Egypt', dial: '+20' },
  { iso: 'GQ', name: 'Equatorial Guinea', dial: '+240' },
  { iso: 'ER', name: 'Eritrea', dial: '+291' },
  { iso: 'SZ', name: 'Eswatini', dial: '+268' },
  { iso: 'ET', name: 'Ethiopia', dial: '+251' },
  { iso: 'GA', name: 'Gabon', dial: '+241' },
  { iso: 'GM', name: 'Gambia', dial: '+220' },
  { iso: 'GH', name: 'Ghana', dial: '+233' },
  { iso: 'GN', name: 'Guinea', dial: '+224' },
  { iso: 'GW', name: 'Guinea-Bissau', dial: '+245' },
  { iso: 'KE', name: 'Kenya', dial: '+254' },
  { iso: 'LS', name: 'Lesotho', dial: '+266' },
  { iso: 'LR', name: 'Liberia', dial: '+231' },
  { iso: 'LY', name: 'Libya', dial: '+218' },
  { iso: 'MG', name: 'Madagascar', dial: '+261' },
  { iso: 'MW', name: 'Malawi', dial: '+265' },
  { iso: 'ML', name: 'Mali', dial: '+223' },
  { iso: 'MR', name: 'Mauritania', dial: '+222' },
  { iso: 'MU', name: 'Mauritius', dial: '+230' },
  { iso: 'MA', name: 'Morocco', dial: '+212' },
  { iso: 'MZ', name: 'Mozambique', dial: '+258' },
  { iso: 'NA', name: 'Namibia', dial: '+264' },
  { iso: 'NE', name: 'Niger', dial: '+227' },
  { iso: 'RW', name: 'Rwanda', dial: '+250' },
  { iso: 'ST', name: 'São Tomé and Príncipe', dial: '+239' },
  { iso: 'SN', name: 'Senegal', dial: '+221' },
  { iso: 'SC', name: 'Seychelles', dial: '+248' },
  { iso: 'SL', name: 'Sierra Leone', dial: '+232' },
  { iso: 'SO', name: 'Somalia', dial: '+252' },
  { iso: 'ZA', name: 'South Africa', dial: '+27' },
  { iso: 'SS', name: 'South Sudan', dial: '+211' },
  { iso: 'SD', name: 'Sudan', dial: '+249' },
  { iso: 'TZ', name: 'Tanzania', dial: '+255' },
  { iso: 'TG', name: 'Togo', dial: '+228' },
  { iso: 'TN', name: 'Tunisia', dial: '+216' },
  { iso: 'UG', name: 'Uganda', dial: '+256' },
  { iso: 'ZM', name: 'Zambia', dial: '+260' },
  { iso: 'ZW', name: 'Zimbabwe', dial: '+263' },

  // Further afield
  { iso: 'AU', name: 'Australia', dial: '+61' },
  { iso: 'BE', name: 'Belgium', dial: '+32' },
  { iso: 'BR', name: 'Brazil', dial: '+55' },
  { iso: 'CA', name: 'Canada', dial: '+1' },
  { iso: 'CN', name: 'China', dial: '+86' },
  { iso: 'FR', name: 'France', dial: '+33' },
  { iso: 'DE', name: 'Germany', dial: '+49' },
  { iso: 'IN', name: 'India', dial: '+91' },
  { iso: 'IE', name: 'Ireland', dial: '+353' },
  { iso: 'IT', name: 'Italy', dial: '+39' },
  { iso: 'MY', name: 'Malaysia', dial: '+60' },
  { iso: 'NL', name: 'Netherlands', dial: '+31' },
  { iso: 'QA', name: 'Qatar', dial: '+974' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '+966' },
  { iso: 'ES', name: 'Spain', dial: '+34' },
  { iso: 'SE', name: 'Sweden', dial: '+46' },
  { iso: 'TR', name: 'Türkiye', dial: '+90' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { iso: 'GB', name: 'United Kingdom', dial: '+44' },
  { iso: 'US', name: 'United States', dial: '+1' },
];

/** "NG" → 🇳🇬. A flag emoji is the two letters as regional-indicator symbols. */
export function flag(iso: string): string {
  return String.fromCodePoint(
    ...Array.from(iso.toUpperCase(), (c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
