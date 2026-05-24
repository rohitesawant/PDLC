export type Society = {
  id: number;
  name: string;
  registration_number: string | null;
  address_line1: string;
  address_line2: string | null;
  area: string;
  city: string;
  pincode: string;
  total_flats: number | null;
  year_established: number | null;
  chairperson_name: string | null;
  secretary_name: string | null;
  treasurer_name: string | null;
  contact_email: string;
  contact_phone: string;
  status: string;
  created_at: string;
  member_count?: number;
  convenience_stores?: number;
  membership_end_date?: string | null;
  last_payment_date?: string | null;
  overdue_amount?: number;
};

export type SocietyDocument = {
  id: number;
  society_id: number;
  type: 'share_certificate' | 'receipt' | 'other' | string;
  name: string;
  file_path: string | null;
  issued_date: string | null;
  created_at: string;
};

export type SocietyProfile = {
  society: Society;
  documents: SocietyDocument[];
  vent_timeline: {
    issues: VentIssue[];
  };
};

export type Member = {
  id: number;
  full_name: string;
  society_id: number;
  society_name?: string;
  flat_number: string;
  wing: string | null;
  email: string;
  phone: string;
  date_of_birth: string | null;
  gender: string | null;
  role_in_society: string;
  is_primary_resident: number;
  created_at: string;
};

export type Stats = {
  society_count: number;
  member_count: number;
  areas: { area: string; c: number }[];
};

const TOKEN_KEY = 'auth.token';
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed (${res.status})`, body.issues, res.status, body);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  issues?: { path: (string | number)[]; message: string }[];
  status?: number;
  data?: Record<string, unknown>;
  constructor(
    message: string,
    issues?: ApiError['issues'],
    status?: number,
    data?: Record<string, unknown>,
  ) {
    super(message);
    this.issues = issues;
    this.status = status;
    this.data = data;
  }
}

export type IssueCategory = 'road' | 'water' | 'sewage' | 'streetlight' | 'electricity' | 'safety' | 'noise' | 'encroachment' | 'other';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'urgent';

export type VentComment = {
  id: number;
  vent_issue_id: number;
  author_name: string;
  body: string;
  created_at: string;
  society?: string | null;
};

export type VentFollowup = {
  id: number;
  vent_issue_id: number;
  body: string;
  created_at: string;
};

export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export type VentIssue = {
  id: number;
  society_id: number;
  society_name?: string;
  area?: string;
  reporter_name: string;
  category: IssueCategory;
  title: string;
  description: string;
  location: string | null;
  severity: IssueSeverity;
  photo_path: string | null;
  status: string;
  created_at: string;
  instagram_handle?: string | null;
  x_handle?: string | null;
  facebook_handle?: string | null;
  likes_count?: number;
  dislikes_count?: number;
  civic_tags?: string[];
  last_activity_at?: string | null;
  comments?: VentComment[];
  followups?: VentFollowup[];
};

export type VentStats = {
  issues_total: number;
  issues_open: number;
  issues_by_category: { category: IssueCategory; c: number }[];
};

async function requestFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method: 'POST', body: formData, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed (${res.status})`, body.issues, res.status, body);
  }
  return res.json() as Promise<T>;
}

export type AuthUser = {
  phone: string;
  member: (Member & { society_name?: string; society_area?: string }) | null;
  society: Society | null;
  is_admin: boolean;
  role: 'admin' | 'member';
};

export const authApi = {
  requestOtp: (phone: string) =>
    request<{ sent: true; expires_in: number; dev_otp?: string }>(
      '/api/auth/request-otp',
      { method: 'POST', body: JSON.stringify({ phone }) },
    ),
  verifyOtp: (phone: string, otp: string) =>
    request<{ token: string; user: AuthUser }>(
      '/api/auth/verify-otp',
      { method: 'POST', body: JSON.stringify({ phone, otp }) },
    ),
  me: () => request<{ user: AuthUser }>('/api/auth/me'),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
};

export type AdminSociety = Society & { member_count: number; pending_changes_count: number };

export type NoticeType = 'Information' | 'GR' | 'Policy';
export type Notice = {
  id: number;
  subject: string;
  content: string;
  notice_date: string;
  notice_type: NoticeType;
  applies_to_all: 0 | 1;
  attachment_path: string | null;
  created_by_phone: string | null;
  created_at: string;
  edited_at: string;
  society_ids: number[];
};

export type Invoice = {
  id: number;
  society_id: number;
  society_name?: string;
  society_area?: string;
  invoice_number: string;
  from_date: string;
  to_date: string;
  amount_inr: number;
  amount_in_words: string;
  status: 'pending' | 'paid';
  created_at: string;
  created_by_phone: string | null;
};

export type CommitteeMember = {
  id: number;
  society_id: number;
  position: number;
  salutation: 'Shri.' | 'Smt.';
  name: string;
  title: string;
  term_start: string | null;
  term_end: string | null;
  created_at: string;
};
export type ChangeRequest = {
  id: number;
  society_id: number;
  requested_by_phone: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  decided_at: string | null;
  decided_by_phone: string | null;
};

export const api = {
  stats: () => request<Stats>('/api/stats'),
  societies: () => request<Society[]>('/api/societies'),
  adminSocieties: () => request<AdminSociety[]>('/api/admin/societies'),
  updateSociety: (id: number, patch: Record<string, unknown>) =>
    request<Society>(`/api/admin/societies/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  societyChangeRequests: (id: number, status: 'pending' | 'accepted' | 'rejected' = 'pending') =>
    request<ChangeRequest[]>(`/api/admin/societies/${id}/change-requests?status=${status}`),
  acceptChangeRequest: (id: number) =>
    request<{ ok: true; society: Society }>(`/api/admin/change-requests/${id}/accept`, { method: 'POST' }),
  rejectChangeRequest: (id: number) =>
    request<{ ok: true }>(`/api/admin/change-requests/${id}/reject`, { method: 'POST' }),
  submitSocietyChangeRequest: (id: number, patch: Record<string, unknown>) =>
    request<ChangeRequest>(`/api/societies/${id}/change-requests`, {
      method: 'POST',
      body: JSON.stringify(patch),
    }),

  notices: (params?: { from?: string; to?: string; year?: number }) => {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.year) q.set('year', String(params.year));
    const qs = q.toString();
    return request<Notice[]>(`/api/admin/notices${qs ? `?${qs}` : ''}`);
  },
  createNotice: (formData: FormData) => requestFormData<Notice>('/api/admin/notices', formData),
  updateNotice: (id: number, formData: FormData) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`/api/admin/notices/${id}`, { method: 'PATCH', body: formData, headers })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new ApiError(body.error || `Request failed (${res.status})`, body.issues, res.status, body);
        }
        return res.json() as Promise<Notice>;
      });
  },

  invoices: () => request<Invoice[]>('/api/admin/invoices'),
  createInvoice: (data: Record<string, unknown>) =>
    request<Invoice>('/api/admin/invoices', { method: 'POST', body: JSON.stringify(data) }),

  federationCommittee: () =>
    request<CommitteeMember[]>(`/api/admin/federation/committee`),
  updateFederationCommitteeMember: (id: number, patch: Record<string, unknown>) =>
    request<CommitteeMember>(`/api/admin/federation/committee/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  society: (id: number | string) => request<Society & { members: Member[] }>(`/api/societies/${id}`),
  societyProfile: (id: number | string) => request<SocietyProfile>(`/api/societies/${id}/profile`),
  renewMembership: (id: number | string) =>
    request<{ ok: true; society: Society; paid: number }>(`/api/societies/${id}/renew`, { method: 'POST' }),
  createSociety: (data: Record<string, unknown>) =>
    request<Society>('/api/societies', { method: 'POST', body: JSON.stringify(data) }),
  members: (society_id?: number) =>
    request<Member[]>(society_id ? `/api/members?society_id=${society_id}` : '/api/members'),
  createMember: (data: Record<string, unknown>) =>
    request<Member>('/api/members', { method: 'POST', body: JSON.stringify(data) }),

  ventStats: (society_id?: number) =>
    request<VentStats>(society_id ? `/api/vent/stats?society_id=${society_id}` : '/api/vent/stats'),

  ventIssues: (params?: { society_id?: number; category?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.society_id) q.set('society_id', String(params.society_id));
    if (params?.category) q.set('category', params.category);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<VentIssue[]>(`/api/vent/issues${qs ? `?${qs}` : ''}`);
  },
  createIssue: (formData: FormData) => requestFormData<VentIssue>('/api/vent/issues', formData),
  likeIssue: (id: number) =>
    request<{ id: number; likes_count: number; dislikes_count: number }>(`/api/vent/issues/${id}/like`, { method: 'POST' }),
  unlikeIssue: (id: number) =>
    request<{ id: number; likes_count: number; dislikes_count: number }>(`/api/vent/issues/${id}/unlike`, { method: 'POST' }),
  dislikeIssue: (id: number) =>
    request<{ id: number; likes_count: number; dislikes_count: number }>(`/api/vent/issues/${id}/dislike`, { method: 'POST' }),
  undislikeIssue: (id: number) =>
    request<{ id: number; likes_count: number; dislikes_count: number }>(`/api/vent/issues/${id}/undislike`, { method: 'POST' }),
  commentOnIssue: (id: number, payload: { author_name: string; body: string; society?: string }) =>
    request<VentComment>(`/api/vent/issues/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  addFollowup: (id: number, body: string) =>
    request<VentFollowup>(`/api/vent/issues/${id}/followups`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  setIssueStatus: (id: number, status: IssueStatus) =>
    request<{ id: number; status: IssueStatus }>(`/api/vent/issues/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

};
