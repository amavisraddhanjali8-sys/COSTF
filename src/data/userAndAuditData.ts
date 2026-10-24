import { AppUser, AccountRequest, CompanyDetails, AuditLogRecord } from '../types';

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'user-admin-01',
    employeeId: 'ADMIN-01',
    name: 'Administrator',
    email: 'admin@example.com',
    role: 'ADMIN',
    department: 'Management',
    status: 'Active',
    createdAt: '2026-01-01 09:00:00'
  }
];

export const INITIAL_COMPANY_DETAILS: CompanyDetails = {
  name: 'FXTT Enterprise Solutions Ltd',
  registrationNumber: 'PV-00294810',
  taxId: 'TIN-194028492-7000',
  email: 'info@fxtt-enterprise.com',
  phone: '+94 11 234 5678',
  address: 'Level 24, World Trade Center, Echelon Square',
  city: 'Colombo',
  country: 'Sri Lanka',
  website: 'https://www.fxtt-enterprise.com',
  currency: 'LKR',
  logoPosition: 'left',
  tagline: 'Cost, Procurement & Project Profitability Management'
};

export const INITIAL_AUDIT_LOGS: AuditLogRecord[] = [];

const CURRENT_USER_KEY = 'fxtt_current_user';
const TOKEN_KEY = 'fxtt_session_token';

let memUsers: AppUser[] = [...INITIAL_USERS];
let memRequests: AccountRequest[] = [];
let memCompanyDetails: CompanyDetails = { ...INITIAL_COMPANY_DETAILS };
let memAuditLogs: AuditLogRecord[] = [...INITIAL_AUDIT_LOGS];

export function getStoredUsers(): AppUser[] {
  return memUsers;
}

export function saveStoredUsers(users: AppUser[]): void {
  memUsers = Array.isArray(users) ? users : [];
}

export function getStoredRequests(): AccountRequest[] {
  return memRequests;
}

export function saveStoredRequests(requests: AccountRequest[]): void {
  memRequests = Array.isArray(requests) ? requests : [];
}

export function getStoredCompanyDetails(): CompanyDetails {
  return memCompanyDetails;
}

export function saveStoredCompanyDetails(details: CompanyDetails): void {
  if (details && typeof details === 'object') {
    memCompanyDetails = { ...memCompanyDetails, ...details };
  }
}

export function getStoredAuditLogs(): AuditLogRecord[] {
  return memAuditLogs;
}

export function saveStoredAuditLogs(logs: AuditLogRecord[]): void {
  memAuditLogs = Array.isArray(logs) ? logs : [];
}

export function getStoredCurrentUser(): AppUser | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export function saveStoredCurrentUser(user: AppUser | null): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    if (!user) {
      localStorage.removeItem(CURRENT_USER_KEY);
    } else {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }
  } catch {
    // ignore storage errors
  }
}
