/**
 * @file navigation.ts — the single source of truth for portal navigation.
 * Drives the sidebar AND the command palette so they never drift.
 */
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, BookOpen, Dumbbell, FileText, Bot, CalendarRange, TrendingUp,
  BarChart3, Bookmark, History, User, CreditCard, Receipt, Settings,
  Database, Library, Sigma, Target, Layers, ClipboardCheck, Sparkles,
  Users, Shield, KeyRound, ScrollText, SlidersHorizontal, Gauge, Tag, ArrowUpDown, RefreshCw,
} from 'lucide-react';

export interface NavItem { label: string; href: string; icon: LucideIcon; }
export interface NavSection { label: string; items: NavItem[]; }

export const studentNav: NavSection[] = [
  {
    label: 'Learn',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Continue Learning', href: '/learn', icon: BookOpen },
      { label: 'Practice', href: '/practice', icon: Dumbbell },
      { label: 'Mock Exams', href: '/exams', icon: FileText },
      { label: 'AI Tutor', href: '/tutor', icon: Bot },
      { label: 'Study Planner', href: '/planner', icon: CalendarRange },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Progress', href: '/progress', icon: TrendingUp },
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
      { label: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
      { label: 'Question History', href: '/history', icon: History },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Profile', href: '/profile', icon: User },
      { label: 'Subscription', href: '/subscription', icon: CreditCard },
      { label: 'Billing', href: '/billing', icon: Receipt },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export const adminNav: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard }],
  },
  {
    label: 'Question Bank',
    items: [
      { label: 'Questions', href: '/admin/questions', icon: FileText },
      { label: 'Subjects', href: '/admin/subjects', icon: BookOpen },
      { label: 'Categories', href: '/admin/topics', icon: Layers },
      { label: 'Subcategories', href: '/admin/subtopics', icon: Target },
      { label: 'Difficulty Levels', href: '/admin/difficulty-levels', icon: Gauge },
      { label: 'Tags', href: '/admin/tags', icon: Tag },
      { label: 'References', href: '/admin/references', icon: Library },
      { label: 'Import / Export', href: '/admin/import-export', icon: ArrowUpDown },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'CMS', href: '/admin/cms', icon: Database },
      { label: 'Knowledge Sync', href: '/admin/knowledge-sync', icon: RefreshCw },
      { label: 'Question Bank', href: '/admin/questions', icon: FileText },
      { label: 'Knowledge Base', href: '/admin/knowledge', icon: Library },
      { label: 'Formula Library', href: '/admin/formulas', icon: Sigma },
      { label: 'Learning Objectives', href: '/admin/learning-objectives', icon: Target },
      { label: 'Blueprints', href: '/admin/blueprints', icon: Layers },
      { label: 'Editorial Review', href: '/admin/editorial', icon: ClipboardCheck },
      { label: 'AI Content Gen', href: '/admin/ai-generation', icon: Sparkles },
    ],
  },
  {
    label: 'Assessments',
    items: [
      { label: 'Mock Exam Templates', href: '/admin/exam-templates', icon: CalendarRange },
    ],
  },
  {
    label: 'Access',
    items: [
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Roles', href: '/admin/roles', icon: Shield },
      { label: 'Permissions', href: '/admin/permissions', icon: KeyRound },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Billing', href: '/admin/billing', icon: CreditCard },
      { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
      { label: 'Audit Logs', href: '/admin/audit-logs', icon: ScrollText },
      { label: 'System Settings', href: '/admin/settings', icon: SlidersHorizontal },
    ],
  },
];
