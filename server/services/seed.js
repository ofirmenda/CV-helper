export function seedCv() {
  return {
    personalInfo: {
      name: 'Alex Rivera',
      title: 'Senior Frontend Engineer',
      email: 'alex.rivera@example.com',
      phone: '+1 415 555 0142',
      linkedin: 'linkedin.com/in/alex-rivera',
      github: 'github.com/alexrivera',
      location: 'San Francisco, CA',
    },
    summary:
      'Senior Frontend Engineer with 7+ years building production React applications at scale. Strong product instinct paired with a systems mindset — I have led migrations from legacy stacks, owned design systems used across multiple teams, and partnered closely with backend and design to ship measurable revenue wins. Comfortable across the stack with Node.js, TypeScript, and AWS.',
    skills: [
      {
        category: 'Languages',
        items: ['TypeScript', 'JavaScript', 'Python', 'HTML', 'CSS'],
      },
      {
        category: 'Frontend',
        items: ['React', 'Next.js', 'Redux', 'Zustand', 'Tailwind', 'Vite', 'Framer Motion'],
      },
      {
        category: 'Backend',
        items: ['Node.js', 'Express', 'GraphQL', 'REST API', 'PostgreSQL'],
      },
      {
        category: 'Cloud & DevOps',
        items: ['AWS', 'Docker', 'GitHub Actions', 'Vercel', 'CloudFront'],
      },
      {
        category: 'Testing',
        items: ['Jest', 'Vitest', 'Playwright', 'Cypress'],
      },
    ],
    experience: [
      {
        role: 'Senior Frontend Engineer',
        company: 'Lumen Labs',
        dates: '2022 - Present',
        bullets: [
          'Led the migration of the customer-facing dashboard from CRA to Next.js, cutting Time-to-Interactive by 43% and lifting conversion 6%.',
          'Owned the internal design system (React + Tailwind), adopted by 4 product teams; reduced shipping time for new screens by ~30%.',
          'Mentored 3 mid-level engineers; introduced lightweight RFC process that reduced rework on cross-team changes.',
          'Partnered with backend to redesign the data-fetching layer with GraphQL + persisted queries, dropping P95 page load from 2.1s to 0.9s.',
        ],
      },
      {
        role: 'Frontend Engineer',
        company: 'Polar Group',
        dates: '2019 - 2022',
        bullets: [
          'Shipped checkout redesign that lifted mobile conversion 11% in A/B test across 1.4M monthly visitors.',
          'Built reusable form library with TypeScript + react-hook-form used in 12+ flows.',
          'Set up Playwright-based E2E suite covering 80% of critical user paths; cut prod regressions ~60%.',
        ],
      },
      {
        role: 'Software Engineer',
        company: 'NovaWave',
        dates: '2017 - 2019',
        bullets: [
          'Built features end-to-end across React frontend and Node.js backend for a B2B analytics product.',
          'Implemented role-based access control with JWT + Postgres row-level policies.',
        ],
      },
    ],
    projects: [
      {
        name: 'Pulse — open-source perf dashboard',
        description: 'React + Node.js tool that surfaces Core Web Vitals regressions on every PR.',
        bullets: [
          'Built a serverless API on AWS Lambda that ingests Lighthouse runs and compares against a rolling baseline.',
          '1.2k GitHub stars; used by 30+ small teams.',
        ],
      },
      {
        name: 'CV Mirror AI',
        description: 'AI-powered CV/JD analysis tool with split-screen Mirror UI and section-by-section approval flow.',
        bullets: ['React + Vite frontend, Express + OpenAI backend, Puppeteer PDF export.'],
      },
    ],
    education: [
      {
        degree: 'B.Sc. in Computer Science',
        institution: 'University of Washington',
        dates: '2013 - 2017',
      },
    ],
    languages: [
      { name: 'English', level: 'Native' },
      { name: 'Spanish', level: 'Fluent' },
    ],
  };
}

export function seedJobDescription() {
  return `Senior Frontend Engineer, Growth

We are looking for a Senior Frontend Engineer to join our Growth team and own the experimentation and acquisition surfaces of our web product. You'll work closely with product, design, and data to ship measurable wins, lead frontend architecture decisions, and mentor mid-level engineers.

Requirements:
- 5+ years of production experience with React and TypeScript
- Strong CSS skills; comfort with Tailwind and modern component patterns
- Experience with Next.js or similar SSR frameworks
- Solid grasp of REST APIs and GraphQL; can debug across the stack into Node.js services
- Experience with A/B testing, experimentation frameworks, and performance optimization (Core Web Vitals)
- Familiarity with AWS, Docker, and modern CI/CD (GitHub Actions or similar)
- Strong product instincts and excellent communication skills

Nice to have:
- Experience leading frontend migrations at scale
- Contributions to design systems or component libraries
- Background mentoring engineers and running RFC-style design reviews

You will:
- Lead the technical direction for growth-focused features
- Partner with product and design on rapid experiments and conversion-rate optimization
- Drive performance budgets and own Core Web Vitals across the marketing site and onboarding`;
}
