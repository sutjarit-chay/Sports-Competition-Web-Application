export type SignupRole = "school" | "referee";
export type AccountStatus = {
  status: "approved" | "pending" | "rejected" | "unsubmitted";
  role?: string;
  note?: string | null;
};
export type SignupDetails = {
  role: SignupRole;
  fullName: string;
  schoolName: string;
  phone: string;
  schoolType: string;
};
export type AccountRequest = {
  id: string;
  kind: SignupRole;
  username: string;
  fullName: string;
  schoolName: string;
  phone: string;
  createdAt: string;
  reviewDecision?: "approved" | "rejected";
};
