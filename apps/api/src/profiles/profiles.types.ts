/**
 * @file profiles.types.ts
 * @module Profiles
 */

/** Full profile returned by GET /profile and after mutations. */
export interface ProfileDetail {
  userId:             string;
  email:              string;
  username:           string | null;
  firstName:          string | null;
  lastName:           string | null;
  displayName:        string | null;
  avatarUrl:          string | null;
  bio:                string | null;
  phoneNumber:        string | null;
  gender:             string | null;
  dateOfBirth:        string | null;
  school:             string | null;
  graduationYear:     number | null;
  prcRegistrationNo:  string | null;
  examTargetDate:     string | null;
  preferredLanguage:  string;
  timezone:           string;
  theme:              string;
  studyGoalHours:     number | null;
  notificationsEmail: boolean;
  notificationsPush:  boolean;
  version:            number;
  createdAt:          string;
  updatedAt:          string;
}

/** Event payload for profile.updated. */
export interface ProfileChangedEvent {
  userId:    string;
  changes:   string[];
  timestamp: string;
}
