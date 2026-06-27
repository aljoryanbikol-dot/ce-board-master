/**
 * @file rbac.types.ts
 * @module Rbac
 *
 * TypeScript type definitions for the RBAC module.
 */
import type { PermissionSlug, RoleSlug } from './rbac.constants';

// ── Role shapes ───────────────────────────────────────────────────────────────

export interface RoleDetail {
  id:          string;
  name:        string;
  slug:        RoleSlug | string;
  description: string | null;
  isSystem:    boolean;
  isActive:    boolean;
  sortOrder:   number;
  createdAt:   string;
  updatedAt:   string;
  permissions: PermissionSummary[];
}

export interface RoleSummary {
  id:       string;
  name:     string;
  slug:     string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  permissionCount: number;
}

// ── Permission shapes ─────────────────────────────────────────────────────────

export interface PermissionDetail {
  id:          string;
  name:        string;
  slug:        PermissionSlug | string;
  module:      string;
  description: string | null;
  isActive:    boolean;
  createdAt:   string;
}

export interface PermissionSummary {
  id:     string;
  slug:   string;
  name:   string;
  module: string;
}

// ── UserRole shapes ───────────────────────────────────────────────────────────

export interface UserRoleAssignment {
  userId:    string;
  roleId:    string;
  roleName:  string;
  roleSlug:  string;
  grantedAt: string;
  grantedBy: string | null;
  expiresAt: string | null;
  isActive:  boolean;
}

export interface EffectivePermissionsResult {
  userId:      string;
  roles:       string[];
  permissions: string[];
  isSuperAdmin: boolean;
  cachedAt:    string;
}

// ── Resource ownership ────────────────────────────────────────────────────────

export interface ResourceOwnerMeta {
  /** The field on the resource object that contains the owner's userId */
  ownerField: string;
  /**
   * Admin permission slug that bypasses ownership check.
   * If the user holds this permission, ownership is not required.
   */
  adminPermission?: PermissionSlug | string;
}
