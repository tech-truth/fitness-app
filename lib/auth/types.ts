export type UserRole = "trainer" | "member";

export type ProfileFormState = {
  role: UserRole;
  fullName: string;
  avatarUrl?: string;
};

export type TrainerProfileFormState = {
  specialization: string;
  experienceYears: string;
  certifications: string;
};

export type MemberProfileFormState = {
  age: string;
  gender: string;
  heightCm: string;
  currentWeightKg: string;
  goal: string;
  injuries: string;
  dietaryPreference: string;
};
