/**
 * @file seed.ts
 * @description Prisma seed script for CE Board Master.
 *
 * Idempotent — uses upsert throughout. Safe to run multiple times.
 *
 * Sprint 2.3 additions:
 * - 5 new roles: admin, content_author, reviewer (plus student = free_user alias)
 * - 24 permissions across 10 modules
 * - Role → Permission assignments for all 9 roles
 *
 * Existing seed data retained and unchanged:
 * - Original 4 roles (free_user, subscriber, content_admin, super_admin)
 * - Difficulty levels (Foundational, Intermediate, Advanced)
 * - Subjects (8 PRC CE board subjects)
 * - Engineering codes (7 codes)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Role definitions ──────────────────────────────────────────────────────────

const ROLES = [
  // Legacy roles (Sprint 1 — retained as-is)
  {
    slug: 'free_user',
    name: 'Free User',
    description: 'Default role for all new registrations. Access to free content only.',
    isSystem: true,
    sortOrder: 10,
  },
  {
    slug: 'subscriber',
    name: 'Subscriber',
    description: 'Active paid subscriber. Access to full question bank and analytics.',
    isSystem: true,
    sortOrder: 20,
  },
  {
    slug: 'content_admin',
    name: 'Content Administrator',
    description: 'Legacy content management role. Full content lifecycle access.',
    isSystem: true,
    sortOrder: 60,
  },
  {
    slug: 'super_admin',
    name: 'Super Administrator',
    description: 'Platform operator. Unrestricted access. Bypasses all guards.',
    isSystem: true,
    sortOrder: 100,
  },
  // Sprint 2.3 new roles
  {
    slug: 'admin',
    name: 'Administrator',
    description: 'Platform manager. Manages users, content, subscriptions, and reports.',
    isSystem: true,
    sortOrder: 80,
  },
  {
    slug: 'content_author',
    name: 'Content Author',
    description: 'Creates and manages questions, formulas, and blueprints.',
    isSystem: true,
    sortOrder: 50,
  },
  {
    slug: 'reviewer',
    name: 'Reviewer',
    description: 'Reviews and approves content submitted by Content Authors.',
    isSystem: true,
    sortOrder: 40,
  },
] as const;

// ─── Permission definitions ───────────────────────────────────────────────────

const PERMISSIONS = [
  // users module
  { slug: 'users.read',           name: 'Read Users',               module: 'users',         description: 'View user accounts and profiles' },
  { slug: 'users.write',          name: 'Write Users',              module: 'users',         description: 'Create and update user accounts' },
  { slug: 'users.delete',         name: 'Delete Users',             module: 'users',         description: 'Soft-delete user accounts' },
  { slug: 'users.manage',         name: 'Manage Users',             module: 'users',         description: 'Full user management including suspension and role assignment' },

  // roles module
  { slug: 'roles.manage',         name: 'Manage Roles',             module: 'roles',         description: 'Create, update, delete roles and assign permissions to roles' },

  // permissions module
  { slug: 'permissions.manage',   name: 'Manage Permissions',       module: 'permissions',   description: 'Create, update, deactivate system permissions' },

  // questions module
  { slug: 'questions.read',       name: 'Read Questions',           module: 'questions',     description: 'View published question bank' },
  { slug: 'questions.create',     name: 'Create Questions',         module: 'questions',     description: 'Author new questions and submit for review' },
  { slug: 'questions.update',     name: 'Update Questions',         module: 'questions',     description: 'Edit question content and metadata' },
  { slug: 'questions.delete',     name: 'Delete Questions',         module: 'questions',     description: 'Archive or soft-delete questions' },
  { slug: 'questions.publish',    name: 'Publish Questions',        module: 'questions',     description: 'Move approved questions to published status' },
  { slug: 'questions.review',     name: 'Review Questions',         module: 'questions',     description: 'Approve or reject questions in review workflow' },
  { slug: 'questions.manage',     name: 'Manage Questions',         module: 'questions',     description: 'Full question lifecycle management' },

  // cms module
  { slug: 'cms.access',           name: 'Access Admin CMS',         module: 'cms',           description: 'Access the Admin CMS dashboard, queues, locking, assignment, and review tools' },

  // blueprints module
  { slug: 'blueprints.manage',    name: 'Manage Blueprints',        module: 'blueprints',    description: 'Manage exam blueprints, subjects, topics, and subtopics' },

  // formulas module
  { slug: 'formulas.manage',      name: 'Manage Formulas',          module: 'formulas',      description: 'Create and manage the formula library' },

  // knowledge module
  { slug: 'knowledge.manage',     name: 'Manage Knowledge',         module: 'knowledge',     description: 'Manage reference books, engineering codes, and tags' },
  { slug: 'knowledge.read',       name: 'Read Knowledge Base',      module: 'knowledge',     description: 'Read the Content Knowledge Base: learning objectives, formulas, blueprints, misconceptions' },
  { slug: 'knowledge.ingest',     name: 'Ingest Knowledge Docs',    module: 'knowledge',     description: 'Ingest and version official enterprise documents (Books 1-15)' },
  { slug: 'knowledge.publish',    name: 'Publish Knowledge',        module: 'knowledge',     description: 'Approve and publish knowledge-base entities as authoritative' },

  // analytics module
  { slug: 'analytics.view',       name: 'View Analytics',           module: 'analytics',     description: 'Access personal and platform-level analytics dashboards' },
  { slug: 'analytics.manage',     name: 'Manage Analytics',         module: 'analytics',     description: 'Access all platform analytics including revenue and retention' },

  // subscriptions module
  { slug: 'subscriptions.read',   name: 'Read Subscriptions',       module: 'subscriptions', description: 'View subscription status (own or all users)' },
  { slug: 'subscriptions.manage', name: 'Manage Subscriptions',     module: 'subscriptions', description: 'Create, modify, and cancel subscriptions' },

  // ai module
  { slug: 'ai.use',               name: 'Use AI Tutor',             module: 'ai',            description: 'Access the AI tutor for study assistance' },
  { slug: 'ai.generate',       name: 'Generate AI Content',      module: 'ai',            description: 'Run the AI Content Generation Engine to produce questions, variants, explanations, and distractors' },
  { slug: 'ai.review',         name: 'Review AI Content',        module: 'ai',            description: 'Review and promote AI-generated drafts into the Question Bank' },
  { slug: 'student.learn',     name: 'Access Learning Platform', module: 'student',       description: 'Access the student learning platform (dashboard, study planner)' },
  { slug: 'student.practice',  name: 'Practice Questions',       module: 'student',       description: 'Practice questions and run practice sessions' },
  { slug: 'student.progress',  name: 'View Own Progress',        module: 'student',       description: 'View personal progress, mastery, achievements, and analytics' },
  { slug: 'exam.take',         name: 'Take Mock Exams',          module: 'exam',          description: 'Create, take, and submit mock examinations' },
  { slug: 'exam.review',       name: 'Review Exam Answers',      module: 'exam',          description: 'Review incorrect answers and bookmarked questions after an exam' },
  { slug: 'exam.results',      name: 'View Exam Results',        module: 'exam',          description: 'View exam results, score breakdowns, and exam history' },
  { slug: 'exam.manage',       name: 'Manage Exam Templates',    module: 'exam',          description: 'Create and manage reusable exam templates' },
  { slug: 'tutor.use',         name: 'Use the AI Tutor',         module: 'tutor',         description: 'Chat with the AI tutor, ask questions, get explanations/hints/solutions' },
  { slug: 'tutor.history',     name: 'View Tutor History',       module: 'tutor',         description: 'View personal AI tutor conversation history' },
  { slug: 'tutor.coaching',    name: 'AI Learning Coaching',     module: 'tutor',         description: 'Receive personalized AI learning-coach guidance' },
  { slug: 'ai.manage',            name: 'Manage AI Content',        module: 'ai',            description: 'Manage AI-generated content, review AI outputs, configure prompts' },

  // system module
  { slug: 'system.manage',        name: 'Manage System',            module: 'system',        description: 'Access system configuration, audit logs, and infrastructure settings' },

  // audit module
  { slug: 'audit.read',           name: 'Read Audit Log',           module: 'audit',         description: 'View immutable system audit logs' },
] as const;

// ─── Role → Permission matrix ─────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  // super_admin: bypass — no DB permissions needed (guard bypasses before DB lookup)
  // Listed here for documentation and admin UI completeness only
  super_admin: [
    'users.read', 'users.write', 'users.delete', 'users.manage',
    'roles.manage', 'permissions.manage',
    'questions.read', 'questions.create', 'questions.update', 'questions.delete',
    'questions.publish', 'questions.review', 'questions.manage',
    'blueprints.manage', 'formulas.manage', 'knowledge.manage',
    'knowledge.read', 'knowledge.ingest', 'knowledge.publish',
    'analytics.view', 'analytics.manage',
    'subscriptions.read', 'subscriptions.manage',
    'ai.use', 'ai.manage', 'ai.generate', 'ai.review',
    'system.manage', 'audit.read',
    'cms.access',
  ],
  admin: [
    'users.read', 'users.write', 'users.delete', 'users.manage',
    'roles.manage',
    'questions.read', 'questions.delete', 'questions.manage',
    'blueprints.manage', 'formulas.manage', 'knowledge.manage',
    'knowledge.read', 'knowledge.ingest', 'knowledge.publish',
    'analytics.view', 'analytics.manage',
    'subscriptions.read', 'subscriptions.manage',
    'ai.use', 'ai.manage', 'ai.generate', 'ai.review',
    'audit.read',
    'cms.access',
  ],
  content_admin: [
    'exam.manage',
    'users.read',
    'questions.read', 'questions.create', 'questions.update', 'questions.delete',
    'questions.publish', 'questions.review', 'questions.manage',
    'blueprints.manage', 'formulas.manage', 'knowledge.manage',
    'knowledge.read', 'knowledge.ingest', 'knowledge.publish',
    'analytics.view',
    'ai.use', 'ai.manage', 'ai.generate', 'ai.review',
    'audit.read',
    'cms.access',
  ],
  content_author: [
    'questions.read', 'questions.create', 'questions.update',
    'blueprints.manage', 'formulas.manage', 'knowledge.manage',
    'knowledge.read',
    'analytics.view',
    'ai.use', 'ai.generate',
  ],
  reviewer: [
    'questions.read', 'questions.review', 'questions.publish',
    'analytics.view',
    'cms.access',
    'knowledge.read',
    'ai.review',
  ],
  subscriber: [
    'student.learn', 'student.practice', 'student.progress',
    'exam.take', 'exam.review', 'exam.results',
    'tutor.use', 'tutor.history', 'tutor.coaching',
    'questions.read',
    'analytics.view',
    'subscriptions.read',
    'ai.use',
  ],
  free_user: [
    'student.learn', 'student.practice', 'student.progress',
    'exam.take', 'exam.review', 'exam.results',
    'tutor.use', 'tutor.history', 'tutor.coaching',
    'questions.read',
  ],
};

// ─── Main seed function ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🌱 Starting CE Board Master database seed...\n');

  // ── Roles ─────────────────────────────────────────────────────────────────
  console.log('📋 Seeding roles...');
  const roleMap = new Map<string, string>(); // slug → id

  for (const role of ROLES) {
    const upserted = await prisma.role.upsert({
      where:  { slug: role.slug },
      update: { name: role.name, description: role.description, sortOrder: role.sortOrder },
      create: { ...role, isActive: true },
      select: { id: true, slug: true },
    });
    roleMap.set(upserted.slug, upserted.id);
  }
  console.log(`  ✅ ${ROLES.length} roles seeded\n`);

  // ── Permissions ───────────────────────────────────────────────────────────
  console.log('🔐 Seeding permissions...');
  const permMap = new Map<string, string>(); // slug → id

  for (const perm of PERMISSIONS) {
    const upserted = await prisma.permission.upsert({
      where:  { slug: perm.slug },
      update: { name: perm.name, description: perm.description },
      create: { ...perm, isActive: true },
      select: { id: true, slug: true },
    });
    permMap.set(upserted.slug, upserted.id);
  }
  console.log(`  ✅ ${PERMISSIONS.length} permissions seeded\n`);

  // ── Role → Permission assignments ─────────────────────────────────────────
  console.log('🔗 Seeding role permission assignments...');
  let assignCount = 0;

  for (const [roleSlug, permSlugs] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleMap.get(roleSlug);
    if (!roleId) {
      console.warn(`  ⚠️  Role not found: ${roleSlug}`);
      continue;
    }

    for (const permSlug of permSlugs) {
      const permId = permMap.get(permSlug);
      if (!permId) {
        console.warn(`  ⚠️  Permission not found: ${permSlug}`);
        continue;
      }

      await prisma.rolePermission.upsert({
        where:  { roleId_permissionId: { roleId, permissionId: permId } },
        update: {},
        create: { roleId, permissionId: permId },
      });
      assignCount++;
    }
  }
  console.log(`  ✅ ${assignCount} role-permission assignments seeded\n`);

  // ── Difficulty levels ─────────────────────────────────────────────────────
  console.log('📊 Seeding difficulty levels...');
  const difficulties = [
    { name: 'Foundational', code: 1, passingThreshold: 70.00, colorHex: '#276749',
      description: 'Recall-level questions. Definition, formula identification, basic substitution.' },
    { name: 'Intermediate', code: 2, passingThreshold: 75.00, colorHex: '#C05621',
      description: 'Application-level. Multi-step problems requiring formula selection and calculation.' },
    { name: 'Advanced',     code: 3, passingThreshold: 80.00, colorHex: '#742A2A',
      description: 'Analysis/synthesis. Complex scenarios, multi-concept integration, engineering judgment.' },
  ];

  for (const diff of difficulties) {
    await prisma.difficultyLevel.upsert({
      where:  { code: diff.code },
      update: {},
      create: { ...diff, sortOrder: diff.code, isActive: true },
    });
  }
  console.log(`  ✅ ${difficulties.length} difficulty levels seeded\n`);

  // ── Subjects ───────────────────────────────────────────────────────────────
  console.log('📚 Seeding CE board examination subjects...');
  const subjects = [
    { name: 'Mathematics',                              code: 'MATH',   examDay: 1, prcWeightPercent: 20.00, colorHex: '#1B3A6B', sortOrder: 1 },
    { name: 'Hydraulics and Geotechnical Engineering', code: 'HGE',    examDay: 1, prcWeightPercent: 20.00, colorHex: '#2C5282', sortOrder: 2 },
    { name: 'Structural Engineering and Construction', code: 'STRUC',  examDay: 1, prcWeightPercent: 20.00, colorHex: '#276749', sortOrder: 3 },
    { name: 'Surveying',                               code: 'SURV',   examDay: 1, prcWeightPercent: 10.00, colorHex: '#C05621', sortOrder: 4 },
    { name: 'Transportation Engineering',              code: 'TRANSP', examDay: 1, prcWeightPercent: 10.00, colorHex: '#553C9A', sortOrder: 5 },
    { name: 'Sanitary Engineering',                    code: 'SANIT',  examDay: 2, prcWeightPercent: 10.00, colorHex: '#234E52', sortOrder: 6 },
    { name: 'Engineering Laws, Codes and Ethics',      code: 'ETHICS', examDay: 2, prcWeightPercent: 10.00, colorHex: '#742A2A', sortOrder: 7 },
    { name: 'General Civil Engineering',               code: 'GCE',    examDay: 2, prcWeightPercent: 10.00, colorHex: '#92400E', sortOrder: 8 },
  ];

  for (const subject of subjects) {
    await prisma.subject.upsert({
      where:  { code: subject.code },
      update: {},
      create: { ...subject, isActive: true },
    });
  }
  console.log(`  ✅ ${subjects.length} subjects seeded\n`);

  // ── Engineering codes ──────────────────────────────────────────────────────
  console.log('📋 Seeding engineering codes...');
  const codes = [
    { codeName: 'National Structural Code of the Philippines',                  codeAbbreviation: 'NSCP 2015',    codeType: 'structural'     as const, issuingBody: 'ASEP',  editionYear: 2015, country: 'PH', isPhilippineCode: true  },
    { codeName: 'National Building Code of the Philippines',                    codeAbbreviation: 'NBC',          codeType: 'general'        as const, issuingBody: 'DPWH',  editionYear: 2005, country: 'PH', isPhilippineCode: true  },
    { codeName: 'DPWH Standard Specifications for Highways, Bridges and Airports', codeAbbreviation: 'DPWH Blue Book', codeType: 'transportation' as const, issuingBody: 'DPWH',  editionYear: 2013, country: 'PH', isPhilippineCode: true  },
    { codeName: 'Philippine Water Code',                                        codeAbbreviation: 'Water Code',   codeType: 'hydraulic'      as const, issuingBody: 'NWRB',  editionYear: 1976, country: 'PH', isPhilippineCode: true  },
    { codeName: 'Building Code Requirements for Structural Concrete',           codeAbbreviation: 'ACI 318-19',   codeType: 'structural'     as const, issuingBody: 'ACI',   editionYear: 2019, country: 'US', isPhilippineCode: false },
    { codeName: 'AASHTO LRFD Bridge Design Specifications',                    codeAbbreviation: 'AASHTO LRFD',  codeType: 'transportation' as const, issuingBody: 'AASHTO',editionYear: 2020, country: 'US', isPhilippineCode: false },
    { codeName: 'ASTM International Standards',                                 codeAbbreviation: 'ASTM',         codeType: 'general'        as const, issuingBody: 'ASTM',  editionYear: 2023, country: 'US', isPhilippineCode: false },
  ];

  for (const code of codes) {
    await prisma.engineeringCode.upsert({
      where:  { codeAbbreviation: code.codeAbbreviation },
      update: {},
      create: { ...code, isActive: true },
    });
  }
  console.log(`  ✅ ${codes.length} engineering codes seeded\n`);

  // ── Sprint 3.3: Subscription Plans (production pricing) ─────────────────────
  console.log('💳 Seeding subscription plans...');

  // The next scheduled PRC Civil Engineering Board Exam date. Board Pass
  // buyers all expire on this single date regardless of purchase date.
  // ⚠️ PLACEHOLDER — set from the official PRC exam calendar and update every
  // cycle via `PATCH /plans/:id { fixedExpiryDate }` (or re-run this seed) —
  // no code change needed either way.
  const NEXT_BOARD_EXAM_DATE = new Date('2026-11-15T00:00:00+08:00');

  const PLANS = [
    {
      name: 'Free', slug: 'free', tier: 'free' as const, interval: 'free' as const,
      priceMinor: 0, durationDays: null, fixedExpiryDate: null, trialDays: 0, sortOrder: 0,
      features: [
        '100 questions total', '1 Mock Exam', 'AI Tutor for those 100 questions',
        'Formula Library preview', 'Flashcards preview', 'Review Notes preview',
        'Engineering diagrams',
      ],
      limits: { maxQuestions: 100, maxMockExams: 1, contentPreviewItems: 10 },
    },
    {
      name: 'Premium Monthly', slug: 'premium_monthly', tier: 'pro' as const, interval: 'monthly' as const,
      priceMinor: 19900, durationDays: 30, fixedExpiryDate: null, trialDays: 0, sortOrder: 10,
      features: [
        'Unlimited questions', 'Unlimited practice', 'Unlimited Mock Exams', 'Unlimited AI Tutor',
        'Unlimited Formula Library', 'Unlimited Flashcards', 'Unlimited Review Notes',
        'Unlimited Engineering Diagrams', 'Progress Analytics', 'Future content updates',
      ],
      limits: null,
    },
    {
      name: 'Premium Quarterly', slug: 'premium_quarterly', tier: 'pro' as const, interval: 'quarterly' as const,
      priceMinor: 49900, durationDays: 90, fixedExpiryDate: null, trialDays: 0, sortOrder: 20,
      features: [
        'Unlimited questions', 'Unlimited practice', 'Unlimited Mock Exams', 'Unlimited AI Tutor',
        'Unlimited Formula Library', 'Unlimited Flashcards', 'Unlimited Review Notes',
        'Unlimited Engineering Diagrams', 'Progress Analytics', 'Future content updates',
      ],
      limits: null,
    },
    {
      name: 'Board Pass', slug: 'premium_board_pass', tier: 'pro' as const, interval: 'custom' as const,
      priceMinor: 99900, durationDays: null, fixedExpiryDate: NEXT_BOARD_EXAM_DATE, trialDays: 0, sortOrder: 30,
      features: [
        'Unlimited questions', 'Unlimited practice', 'Unlimited Mock Exams', 'Unlimited AI Tutor',
        'Unlimited Formula Library', 'Unlimited Flashcards', 'Unlimited Review Notes',
        'Unlimited Engineering Diagrams', 'Progress Analytics', 'Future content updates',
        'Valid until the next PRC CE Board Exam',
      ],
      limits: null,
    },
  ];

  // Retire the old Sprint 2.5 pricing (pro_monthly/pro_quarterly/pro_annual/lifetime)
  // rather than delete — existing subscriptions still reference these rows.
  await prisma.subscriptionPlan.updateMany({
    where: { slug: { in: ['pro_monthly', 'pro_quarterly', 'pro_annual', 'lifetime'] } },
    data: { isActive: false },
  });

  for (const plan of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where:  { slug: plan.slug },
      update: {
        name: plan.name, priceMinor: plan.priceMinor, durationDays: plan.durationDays,
        fixedExpiryDate: plan.fixedExpiryDate, trialDays: plan.trialDays,
        sortOrder: plan.sortOrder, features: plan.features, limits: plan.limits, isActive: true,
      },
      create: {
        name: plan.name, slug: plan.slug, tier: plan.tier, interval: plan.interval,
        priceMinor: plan.priceMinor, currency: 'PHP', durationDays: plan.durationDays,
        fixedExpiryDate: plan.fixedExpiryDate, trialDays: plan.trialDays, features: plan.features,
        limits: plan.limits, sortOrder: plan.sortOrder, isActive: true,
      },
    });
  }
  console.log(`  ✅ ${PLANS.length} subscription plans seeded (4 old Sprint 2.5 plans retired)\n`);

  console.log('✅ CE Board Master seed complete!\n');
  console.log('📝 Sprint 2.3 RBAC seeded:');
  console.log(`   Roles:       ${ROLES.length}`);
  console.log(`   Permissions: ${PERMISSIONS.length}`);
  console.log(`   Assignments: ${assignCount}\n`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
