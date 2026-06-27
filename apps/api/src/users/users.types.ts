/**
 * @file users.types.ts
 * @module Users
 *
 * Type definitions for the Users module.
 */

/** Full user detail returned by GET /users/:id (admin) and internal use. */
export interface UserDetail {
  id:               string;
  email:            string;
  username:         string | null;
  role:             string;
  status:           string;
  isVerified:       boolean;
  isActive:         boolean;
  lastLoginAt:      string | null;
  lastLoginIp:      string | null;
  createdAt:        string;
  updatedAt:        string;
  version:          number;
  // Flattened profile summary
  firstName:        string | null;
  lastName:         string | null;
  displayName:      string | null;
  avatarUrl:        string | null;
}

/** Compact user representation for list views. */
export interface UserSummary {
  id:          string;
  email:       string;
  username:    string | null;
  role:        string;
  status:      string;
  isVerified:  boolean;
  isActive:    boolean;
  displayName: string | null;
  avatarUrl:   string | null;
  createdAt:   string;
  lastLoginAt: string | null;
}

/** Cursor-paginated user list result. */
export interface UserListResult {
  data: UserSummary[];
  pagination: {
    cursor:  string | null;
    hasMore: boolean;
    total:   number;
  };
}

/** Event payload for user.updated / user.deleted. */
export interface UserChangedEvent {
  userId:    string;
  actorId:   string;
  action:    'updated' | 'deleted';
  changes?:  string[];
  timestamp: string;
}
