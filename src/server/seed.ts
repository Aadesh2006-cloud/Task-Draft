import { db } from '../db/index.ts';
import {
  adminAuditLogs,
  buyerProfiles,
  categories,
  portfolioItems,
  sellerProfiles,
  storedFiles,
  users,
} from '../db/schema.ts';
import { hashPassword } from './auth.ts';

let seedPromise: Promise<void> | null = null;

export function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('Seed execution failed:', err);
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed() {
  const existingCategories = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  if (existingCategories.length > 0) {
    // Ensure the Custom Brief category exists even on already-initialized databases
    if (!existingCategories.some((c) => c.slug === 'custom-brief')) {
      await db
        .insert(categories)
        .values({
          name: 'Custom Brief',
          slug: 'custom-brief',
          description: 'Bespoke, cross-disciplinary, or specialized projects outside standard categories.',
          subcategories: ['Custom Brief', 'Consulting & Advisory', 'Research & Strategy', 'Operations & Support'],
          suggestedSkills: ['Project Management', 'Strategy', 'Research', 'Consulting'],
          sortOrder: 7,
        })
        .onConflictDoNothing();
    }
    return;
  }

  // 1. Seed focused categories (every category includes "Custom Brief" in its sub-menu, plus a dedicated Custom Brief category)
  const insertedCategories = await db
    .insert(categories)
    .values([
      {
        name: 'Product & UI Design',
        slug: 'product-ui-design',
        description: 'Design systems, web application interfaces, UX audits, and interactive prototypes.',
        subcategories: ['Design Systems', 'SaaS Web Apps', 'UX Audits', 'Prototyping', 'Custom Brief'],
        suggestedSkills: ['Figma', 'Design Systems', 'WCAG Accessibility', 'Prototyping', 'User Research'],
        sortOrder: 1,
      },
      {
        name: 'Full-Stack Web Engineering',
        slug: 'full-stack-web-engineering',
        description: 'TypeScript web applications, API architecture, PostgreSQL optimization, and cloud delivery.',
        subcategories: ['React & TypeScript', 'API & Databases', 'Performance Engineering', 'Integrations', 'Custom Brief'],
        suggestedSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'GraphQL', 'REST APIs'],
        sortOrder: 2,
      },
      {
        name: 'Brand Identity & Systems',
        slug: 'brand-identity-systems',
        description: 'Visual identity guidelines, typography systems, packaging, and editorial brand collateral.',
        subcategories: ['Visual Identity', 'Packaging', 'Brand Guidelines', 'Art Direction', 'Custom Brief'],
        suggestedSkills: ['Brand Strategy', 'Typography', 'Illustrator', 'Packaging Design', 'Editorial Layout'],
        sortOrder: 3,
      },
      {
        name: 'Technical Content & Docs',
        slug: 'technical-content-docs',
        description: 'Developer documentation, product messaging playbooks, case studies, and API guides.',
        subcategories: ['Developer Docs', 'Product Messaging', 'Case Studies', 'UX Writing', 'Custom Brief'],
        suggestedSkills: ['Technical Writing', 'API Documentation', 'Information Architecture', 'UX Copy'],
        sortOrder: 4,
      },
      {
        name: 'Data & Analytics Engineering',
        slug: 'data-analytics-engineering',
        description: 'Analytics pipelines, KPI instrumentation, executive reporting, and warehouse modeling.',
        subcategories: ['SQL & Modeling', 'BI Dashboards', 'Event Tracking', 'Data Audits', 'Custom Brief'],
        suggestedSkills: ['SQL', 'dbt', 'Python', 'Data Visualization', 'PostgreSQL'],
        sortOrder: 5,
      },
      {
        name: 'Mobile App Development',
        slug: 'mobile-app-development',
        description: 'Native and cross-platform iOS/Android applications, offline sync, and release prep.',
        subcategories: ['iOS & Swift', 'Android & Kotlin', 'React Native', 'App Architecture', 'Custom Brief'],
        suggestedSkills: ['React Native', 'Swift', 'Kotlin', 'Mobile UX', 'API Integration'],
        sortOrder: 6,
      },
      {
        name: 'Custom Brief',
        slug: 'custom-brief',
        description: 'Bespoke, cross-disciplinary, or specialized projects outside standard categories.',
        subcategories: ['Custom Brief', 'Consulting & Advisory', 'Research & Strategy', 'Operations & Support'],
        suggestedSkills: ['Project Management', 'Strategy', 'Research', 'Consulting'],
        sortOrder: 7,
      },
    ])
    .returning();

  const catDesign = insertedCategories[0];

  // 2. Seed demo users (clearly marked isDemo: true)
  const demoPasswordHash = hashPassword('DemoPass123!');

  const [maya, liam, priya, admin] = await db
    .insert(users)
    .values([
      {
        uid: 'demo_buyer_maya',
        email: 'maya@northstar.demo',
        passwordHash: demoPasswordHash,
        name: 'Maya Lin',
        avatarUrl: '/src/assets/images/avatar_maya_client_1795195340900.jpg',
        canBuy: true,
        canSell: true,
        activeRole: 'buyer',
        isAdmin: false,
        emailVerified: true,
        isDemo: true,
      },
      {
        uid: 'demo_seller_liam',
        email: 'liam@studiofield.demo',
        passwordHash: demoPasswordHash,
        name: "Liam O'Connor",
        avatarUrl: '/src/assets/images/avatar_liam_freelancer_1795195346353.jpg',
        canBuy: false,
        canSell: true,
        activeRole: 'seller',
        isAdmin: false,
        emailVerified: true,
        isDemo: true,
      },
      {
        uid: 'demo_seller_priya',
        email: 'priya@atelier.demo',
        passwordHash: demoPasswordHash,
        name: 'Priya Nair',
        avatarUrl: null,
        canBuy: true,
        canSell: true,
        activeRole: 'seller',
        isAdmin: false,
        emailVerified: true,
        isDemo: true,
      },
      {
        uid: 'demo_admin_jordan',
        email: 'admin@briefline.demo',
        passwordHash: demoPasswordHash,
        name: 'Jordan Reid',
        avatarUrl: null,
        canBuy: true,
        canSell: false,
        activeRole: 'admin',
        isAdmin: true,
        emailVerified: true,
        isDemo: true,
      },
    ])
    .returning();

  // 3. Seed Buyer & Seller Profiles
  await db.insert(buyerProfiles).values([
    {
      userId: maya.id,
      organizationName: 'Northstar Telemetry',
      description: 'B2B financial and industrial telemetry software team hiring independent product designers, frontend engineers, and technical writers for scoped project engagements.',
      website: 'https://northstar-telemetry.example',
      industry: 'B2B Financial Software',
      contactPreference: 'Platform messages & weekly async check-ins',
      location: 'Toronto, Canada',
      timezone: 'America/Toronto (EST)',
    },
    {
      userId: priya.id,
      organizationName: 'Atelier Advisory',
      description: 'Independent research practice occasionally hiring visual specialists.',
      website: 'https://atelier-advisory.example',
      industry: 'Design & Research',
      contactPreference: 'Platform messages',
      location: 'London, UK',
      timezone: 'Europe/London (GMT)',
    },
    {
      userId: admin.id,
      organizationName: 'Briefline Trust & Safety',
      description: 'Platform governance and dispute mediation team.',
      website: 'https://briefline.example',
      industry: 'Marketplace Operations',
      contactPreference: 'Platform notices',
      location: 'Singapore',
      timezone: 'Asia/Singapore (SGT)',
    },
  ]);

  // Private CV files for Liam and Priya (isPublic: false!)
  const liamCvText = `LIAM O'CONNOR — PRINCIPAL PRODUCT DESIGNER & FRONTEND ARCHITECT
Location: Dublin, Ireland (GMT) | Availability: Available for scoped projects

SUMMARY
10+ years designing and shipping B2B SaaS design systems, treasury dashboards, and React/TypeScript web applications for Series A-C software companies.

EXPERIENCE
- Independent Principal Designer & Engineer, Studiofield (2022–Present): Delivered 14 milestone-scoped design systems and production frontend portals.
- Staff Product Designer, Ledgercraft (2019–2022): Led component token architecture across 32 enterprise financial views; reduced UI defects by 41%.

EDUCATION
- B.Sc. Computer Science & Visual Interaction, Trinity College Dublin (2016)
`;
  const priyaCvText = `PRIYA NAIR — PRODUCT STRATEGIST & UX RESEARCH LEAD
Location: London, UK (GMT) | Availability: Limited (15 hrs/week)

SUMMARY
8 years specializing in B2B product positioning, usability testing, and design-system information architecture.

EXPERIENCE
- Independent UX Lead, Atelier Advisory (2021–Present): Conducted workflow research and IA redesigns for 11 SaaS platforms.
- Senior UX Researcher, Finbridge (2018–2021): Owned enterprise onboarding studies and accessibility audits.
`;

  const [liamCvFile, priyaCvFile] = await db
    .insert(storedFiles)
    .values([
      {
        ownerId: liam.id,
        scope: 'cv',
        scopeRefId: null,
        fileName: 'Liam_OConnor_CV_2026.txt',
        mimeType: 'text/plain',
        sizeBytes: Buffer.byteLength(liamCvText, 'utf8'),
        contentBase64: Buffer.from(liamCvText, 'utf8').toString('base64'),
        isPublic: false,
      },
      {
        ownerId: priya.id,
        scope: 'cv',
        scopeRefId: null,
        fileName: 'Priya_Nair_CV_2026.txt',
        mimeType: 'text/plain',
        sizeBytes: Buffer.byteLength(priyaCvText, 'utf8'),
        contentBase64: Buffer.from(priyaCvText, 'utf8').toString('base64'),
        isPublic: false,
      },
    ])
    .returning();

  await db.insert(sellerProfiles).values([
    {
      userId: maya.id,
      headline: 'Product Operations Advisor',
      bio: 'Advises early-stage B2B teams on scoping technical milestones and roadmap architecture.',
      skills: ['Product Strategy', 'Roadmapping', 'UX Audits'],
      experience: [
        { role: 'Director of Product', company: 'Northstar Telemetry', period: '2022–Present', summary: 'Overseeing treasury and reporting product lines.' },
      ],
      education: [{ degree: 'M.B.A.', institution: 'Rotman School of Management', year: '2019' }],
      languages: ['English', 'Mandarin'],
      pricingPreference: 'fixed',
      hourlyRate: 145,
      currency: 'USD',
      availability: 'limited',
      location: 'Toronto, Canada',
      timezone: 'America/Toronto',
      portfolioLinks: [],
    },
    {
      userId: liam.id,
      headline: 'Principal Product Designer & TypeScript Design-Systems Engineer',
      bio: 'I partner with B2B SaaS teams to turn dense operational workflows into clear, accessible interfaces and production React component kits. Every engagement is structured around concrete milestones, testable acceptance criteria, and documented handover.',
      skills: ['Figma', 'Design Systems', 'React', 'TypeScript', 'WCAG Accessibility', 'Prototyping'],
      experience: [
        {
          role: 'Principal Designer & Frontend Architect',
          company: 'Studiofield (Independent)',
          period: '2022–Present',
          summary: 'Scoped and delivered 14 B2B SaaS portals and Figma-to-React component libraries.',
        },
        {
          role: 'Staff Product Designer',
          company: 'Ledgercraft',
          period: '2019–2022',
          summary: 'Unified 32 enterprise financial screens under a single tokenized component architecture.',
        },
      ],
      education: [{ degree: 'B.Sc. Computer Science', institution: 'Trinity College Dublin', year: '2016' }],
      languages: ['English', 'Irish'],
      pricingPreference: 'both',
      hourlyRate: 120,
      currency: 'USD',
      availability: 'available',
      location: 'Dublin, Ireland',
      timezone: 'Europe/Dublin (GMT)',
      cvFileId: liamCvFile.id,
      portfolioLinks: [
        { label: 'Studiofield Case Archive', url: 'https://studiofield.example/work' },
        { label: 'GitHub Design Tokens', url: 'https://github.com/studiofield-example' },
      ],
    },
    {
      userId: priya.id,
      headline: 'Senior UX Architect, Brand Systems & B2B Messaging Strategist',
      bio: 'Independent UX researcher and brand systems designer helping SaaS and hardware teams align visual identity, navigation hierarchy, and clear enterprise documentation.',
      skills: ['UX Audits', 'Brand Strategy', 'Figma', 'User Research', 'Information Architecture', 'Technical Writing'],
      experience: [
        {
          role: 'Principal Consultant',
          company: 'Atelier Advisory',
          period: '2021–Present',
          summary: 'Led brand systems, IA audits, and messaging playbooks for 11 B2B launches.',
        },
      ],
      education: [{ degree: 'M.A. Interaction Design', institution: 'Royal College of Art', year: '2018' }],
      languages: ['English', 'Hindi'],
      pricingPreference: 'fixed',
      hourlyRate: 110,
      currency: 'USD',
      availability: 'limited',
      location: 'London, UK',
      timezone: 'Europe/London (GMT)',
      cvFileId: priyaCvFile.id,
      portfolioLinks: [{ label: 'Atelier Monograph', url: 'https://atelier-advisory.example/cases' }],
    },
  ]);

  // 4. Portfolio Items (sample briefs intentionally omitted so the marketplace only displays buyer-posted projects)
  await db.insert(portfolioItems).values([
    {
      sellerId: liam.id,
      title: 'Meridian Treasury Analytics & Modular UI Kit',
      description: 'Redesigned multi-currency cash-flow dashboards and delivered 48 WCAG-AA Figma components paired with Storybook React primitives. Cut analyst reporting time by 34%.',
      toolsUsed: ['Figma', 'React', 'TypeScript', 'Tailwind CSS', 'Storybook'],
      rolePerformed: 'Lead Product Designer & Frontend Engineer',
      externalUrl: 'https://studiofield.example/meridian-treasury',
      imageUrl: '/src/assets/images/portfolio_fintech_system_1795195353155.jpg',
      verifiedContribution: true,
    },
    {
      sellerId: liam.id,
      title: 'Aeterna Architectural Brand & Packaging System',
      description: 'Created modular grid documentation, tactile print guidelines, and digital brand portal for an industrial studio launch.',
      toolsUsed: ['Figma', 'Illustrator', 'InDesign', 'Design Tokens'],
      rolePerformed: 'Brand Systems Designer',
      externalUrl: 'https://studiofield.example/aeterna-system',
      imageUrl: '/src/assets/images/portfolio_brand_packaging_1795195341104.jpg',
      verifiedContribution: true,
    },
    {
      sellerId: priya.id,
      title: 'Aeterna Editorial Identity & Packaging Spec',
      description: 'Developed positioning architecture, typographic hierarchy, and tactile stationery guidelines for hardware product launch.',
      toolsUsed: ['Brand Strategy', 'Typography', 'Figma'],
      rolePerformed: 'Brand Strategist & UX Architect',
      externalUrl: 'https://atelier-advisory.example/aeterna',
      imageUrl: '/src/assets/images/portfolio_brand_packaging_1795195341104.jpg',
      verifiedContribution: true,
    },
  ]);

  await db.insert(adminAuditLogs).values([
    {
      adminId: admin.id,
      adminName: admin.name,
      action: 'category_initialized',
      targetType: 'category',
      targetId: catDesign.id,
      details: 'Initialized marketplace categories (including Custom Brief) and curated skill taxonomies.',
    },
    {
      adminId: admin.id,
      adminName: admin.name,
      action: 'policy_published',
      targetType: 'platform',
      targetId: null,
      details: 'Enabled paid sample-task disclosure guidelines and strict workspace file isolation.',
    },
  ]);
}
