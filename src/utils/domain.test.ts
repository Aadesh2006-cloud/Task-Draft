import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessWorkspace,
  canAccessFile,
  canSubmitReview,
  validateProjectBrief,
  calculateSellerCompletion,
  calculateBuyerCompletion,
  validateUploadFile,
  computeMilestoneSum,
} from './domain';

test('workspace access enforces strict participant and admin isolation', () => {
  const ws = { buyerId: 10, sellerId: 20 };
  assert.equal(canAccessWorkspace({ id: 10, isAdmin: false }, ws), true);
  assert.equal(canAccessWorkspace({ id: 20, isAdmin: false }, ws), true);
  assert.equal(canAccessWorkspace({ id: 99, isAdmin: true }, ws), true);
  assert.equal(canAccessWorkspace({ id: 30, isAdmin: false }, ws), false);
  assert.equal(canAccessWorkspace(null, ws), false);
});

test('private CVs and proposal samples are never publicly downloadable', () => {
  const cvFile = { ownerId: 20, scope: 'cv', scopeRefId: null, isPublic: true };
  assert.equal(canAccessFile(null, cvFile), false);
  assert.equal(canAccessFile({ id: 30, isAdmin: false }, cvFile), false);
  assert.equal(canAccessFile({ id: 20, isAdmin: false }, cvFile), true);
  assert.equal(canAccessFile({ id: 10, isAdmin: false }, cvFile, { isBuyerOfSubmittedProposal: true }), true);
  assert.equal(canAccessFile({ id: 99, isAdmin: true }, cvFile), true);
});

test('workspace files deny non-participants and anonymous users', () => {
  const wsFile = { ownerId: 20, scope: 'workspace', scopeRefId: 5, isPublic: false };
  assert.equal(canAccessFile(null, wsFile), false);
  assert.equal(canAccessFile({ id: 30, isAdmin: false }, wsFile, { isWorkspaceParticipant: false }), false);
  assert.equal(canAccessFile({ id: 10, isAdmin: false }, wsFile, { isWorkspaceParticipant: true }), true);
});

test('review rules block pre-completion, non-participants, and duplicates', () => {
  const activeWs = { buyerId: 10, sellerId: 20, status: 'active' };
  assert.equal(canSubmitReview(activeWs, 10, []).allowed, false);

  const doneWs = { buyerId: 10, sellerId: 20, status: 'completed' };
  assert.equal(canSubmitReview(doneWs, 30, []).allowed, false);
  assert.equal(canSubmitReview(doneWs, 10, []).allowed, true);
  assert.equal(canSubmitReview(doneWs, 10, [10]).allowed, false);
  assert.equal(canSubmitReview(doneWs, 20, [10]).allowed, true);
});

test('project brief validation blocks incomplete required fields and warns on unpaid samples', () => {
  const incomplete = validateProjectBrief({
    title: 'Short',
    brief: 'Too short',
    categoryId: null,
    scopeOfWork: '',
    deliverables: [],
    acceptanceCriteria: '',
    budgetType: 'fixed',
    budgetMin: 0,
    budgetMax: 0,
    deadline: '',
    requiredSkills: [],
    sampleRequested: true,
    samplePaid: false,
    sampleDetails: '',
  });
  assert.equal(incomplete.canPublish, false);
  assert.ok(incomplete.blockingErrors.length >= 4);
  assert.ok(incomplete.warnings.some((w) => w.includes('Unpaid work sample')));

  const complete = validateProjectBrief({
    title: 'Design System Audit and Component Library',
    brief: 'We need an experienced product designer to audit our B2B analytics app and deliver a Figma component library.',
    categoryId: 1,
    scopeOfWork: 'Audit 18 core screens, define spacing and color tokens, build reusable Figma variants.',
    deliverables: ['Token architecture', 'Figma component kit'],
    acceptanceCriteria: 'All components pass WCAG AA contrast and cover desktop and mobile breakpoints.',
    budgetType: 'fixed',
    budgetMin: 4500,
    budgetMax: 6500,
    deadline: '2026-12-20',
    requiredSkills: ['Figma', 'Design Systems'],
    sampleRequested: false,
    samplePaid: false,
    sampleDetails: '',
  });
  assert.equal(complete.canPublish, true);
  assert.equal(complete.warnings.length, 0);
});

test('profile completion calculations report accurate percentages and missing items', () => {
  const seller = calculateSellerCompletion(
    {
      headline: 'Senior Full-Stack Product Engineer',
      bio: 'Ten years building B2B SaaS products, design systems, and PostgreSQL-backed platforms.',
      skills: ['TypeScript', 'PostgreSQL', 'React'],
      experience: [{ role: 'Lead', company: 'North', period: '2021-2026', summary: 'Led web team' }],
      hourlyRate: 115,
      location: 'London, UK',
      cvFileId: null,
    },
    2
  );
  assert.equal(seller.percent, 88);
  assert.deepEqual(seller.missing, ['Private CV / resume upload']);

  const buyer = calculateBuyerCompletion({
    organizationName: 'Northstar Logistics',
    description: 'Regional supply chain technology company operating across Europe.',
    industry: 'Logistics',
    location: 'Amsterdam',
    website: 'https://northstar.example',
  });
  assert.equal(buyer.percent, 100);
});

test('upload validator enforces MIME allowlist and size ceiling', () => {
  assert.equal(validateUploadFile('resume.pdf', 'application/pdf', 120000).valid, true);
  assert.equal(validateUploadFile('script.exe', 'application/x-msdownload', 1024).valid, false);
  assert.equal(validateUploadFile('huge.pdf', 'application/pdf', 10 * 1024 * 1024).valid, false);
});

test('milestone sum computes exact totals', () => {
  assert.equal(computeMilestoneSum([{ amount: 1500 }, { amount: 2500 }, { amount: 1000 }]), 5000);
});
