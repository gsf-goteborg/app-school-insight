// Roller och behörigheter (§7). I demon är detta en klientstyrd rollväljare som
// döljer/visar vyer och sektioner. I en skarp lösning skulle samma regler
// hanteras av databasens radnivåsäkerhet (RLS) – se kommentarer i migrationerna.

export type RoleKey = "skolledare" | "elevhalsa" | "forstelarare" | "larare";

export interface Role {
  key: RoleKey;
  label: string;
  /** Kort beskrivning av rollens fokus, visas i rollväljaren. */
  blurb: string;
}

export const ROLES: Role[] = [
  {
    key: "skolledare",
    label: "Skolledare",
    blurb: "Ser all demodata, ekonomi och personalplanering.",
  },
  {
    key: "elevhalsa",
    label: "Elevhälsa",
    blurb: "Närvaro, stödinsatser och elev-, klass- och årskursdata.",
  },
  {
    key: "forstelarare",
    label: "Förstelärare",
    blurb: "Ämnes-, klass- och årskursdata samt analysunderlag.",
  },
  {
    key: "larare",
    label: "Lärare",
    blurb: "Egna klasser, progression och närvaro.",
  },
];

export const DEFAULT_ROLE: RoleKey = "skolledare";

export type ViewKey =
  | "start"
  | "ledning"
  | "prioritera"
  | "tidig"
  | "behorighet"
  | "arskurs"
  | "klass"
  | "elev"
  | "analys"
  | "insatser"
  | "ekonomi"
  | "personal";

export interface NavItem {
  view: ViewKey;
  label: string;
  href: string;
  /** Roller som ser navigationsposten. */
  roles: RoleKey[];
}

const ALL: RoleKey[] = ["skolledare", "elevhalsa", "forstelarare", "larare"];

// Behörighetsmatris härledd ur §7.
export const NAV: NavItem[] = [
  { view: "start", label: "Skolans nuläge", href: "/", roles: ALL },
  { view: "ledning", label: "Ledningsöversikt", href: "/ledning", roles: ["skolledare"] },
  { view: "prioritera", label: "Prioriterade elever", href: "/prioritera", roles: ALL },
  { view: "tidig", label: "Tidig upptäckt", href: "/tidig-upptackt", roles: ALL },
  { view: "behorighet", label: "Behörighetsprognos", href: "/behorighet", roles: ALL },
  { view: "arskurs", label: "Årskurser", href: "/arskurs", roles: ALL },
  { view: "klass", label: "Klasser", href: "/klass", roles: ALL },
  { view: "elev", label: "Elever", href: "/elev", roles: ["skolledare", "elevhalsa", "forstelarare", "larare"] },
  { view: "analys", label: "Analys", href: "/analys", roles: ["skolledare", "elevhalsa", "forstelarare"] },
  { view: "insatser", label: "Insatser", href: "/insatser", roles: ALL },
  { view: "ekonomi", label: "Ekonomi & resurser", href: "/ekonomi", roles: ["skolledare"] },
  { view: "personal", label: "Personalplanering", href: "/personal", roles: ["skolledare"] },
];

export function canAccess(role: RoleKey, view: ViewKey): boolean {
  const item = NAV.find((n) => n.view === view);
  return item ? item.roles.includes(role) : false;
}

export function navFor(role: RoleKey): NavItem[] {
  return NAV.filter((n) => n.roles.includes(role));
}

// Finkorniga rättigheter (sektioner inom vyer).
export const CAN = {
  seeEconomy: (r: RoleKey) => r === "skolledare",
  seeStaffing: (r: RoleKey) => r === "skolledare",
  // Förstelärare har begränsad åtkomst till individkänslig elevhälsodata (§7).
  seeSensitiveHealth: (r: RoleKey) => r === "skolledare" || r === "elevhalsa",
  // Alla roller får dokumentera insatser och kommentarer i demon.
  writeInterventions: () => true,
  writeComments: () => true,
} as const;

export function roleLabel(role: RoleKey): string {
  return ROLES.find((r) => r.key === role)?.label ?? role;
}

/** Cookie som bär den valda demorollen (läsbar både på server och klient). */
export const ROLE_COOKIE = "demo-role";

export function parseRole(value?: string | null): RoleKey {
  return ROLES.some((r) => r.key === value) ? (value as RoleKey) : DEFAULT_ROLE;
}
