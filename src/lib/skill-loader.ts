/**
 * Skill Loader — Selective Injection
 *
 * Reads skill markdown files from the /skills directory and injects
 * them into agent dispatch messages based on:
 * 1. ALWAYS_SKILLS: lean, universal skills per role (always injected)
 * 2. ON_DEMAND_SKILLS: only injected when task has matching skill_tags
 *
 * This reduces token usage by ~80% for typical tasks.
 */

import fs from 'fs';
import path from 'path';

/** Always injected per role — lean, universal skills. */
const ALWAYS_SKILLS: Record<string, string[]> = {
  builder: ['frontend-design', 'coding-standards-compact'],
  tester: ['verification-loop'],
  reviewer: ['security-review-compact', 'coding-standards-compact'],
  verifier: ['security-review-compact', 'coding-standards-compact'],
};

/** Only injected when explicitly requested via task.skill_tags. */
const ON_DEMAND_SKILLS = [
  'react-native-expo',
  'heroui-react',
  'frontend-patterns',
  'interaction-design',
  'ui-ux-pro-max',
  'tdd-workflow',
  'security-review',
  'coding-standards',
];

/** In-memory cache so we only read files once per process. */
const skillCache = new Map<string, string>();

/**
 * Read a single skill file. Returns empty string if not found.
 */
function readSkillFile(name: string): string {
  if (skillCache.has(name)) {
    return skillCache.get(name)!;
  }

  // Try multiple possible locations (dev vs Docker)
  const candidates = [
    path.join(process.cwd(), 'skills', `${name}.md`),
    path.join(__dirname, '..', '..', 'skills', `${name}.md`),
    `/app/skills/${name}.md`,
  ];

  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Strip YAML frontmatter (between --- markers)
      const stripped = content.replace(/^---[\s\S]*?---\s*\n/, '');
      skillCache.set(name, stripped);
      return stripped;
    } catch {
      // Try next candidate
    }
  }

  console.warn(`[Skill Loader] Skill file not found: ${name}.md`);
  skillCache.set(name, '');
  return '';
}

/**
 * Load skills for a task based on role + optional skill_tags.
 * - Always includes ALWAYS_SKILLS for the role
 * - Adds ON_DEMAND_SKILLS that match the task's skill_tags
 * Returns formatted markdown string ready for injection.
 */
export function getSkillsForTask(role: string, skillTags?: string[]): string {
  const normalizedRole = role.toLowerCase();
  const always = ALWAYS_SKILLS[normalizedRole] || [];
  const extra = (skillTags || []).filter(t => ON_DEMAND_SKILLS.includes(t));
  const combined = Array.from(new Set([...always, ...extra]));

  if (combined.length === 0) {
    return '';
  }

  const sections = combined
    .map(name => readSkillFile(name))
    .filter(content => content.length > 0);

  if (sections.length === 0) {
    return '';
  }

  return `\n---\n**SKILLS & STANDARDS (befolge diese Richtlinien):**\n\n${sections.join('\n\n---\n\n')}`;
}

/**
 * Legacy: Load all skills for a role (no filtering).
 * @deprecated Use getSkillsForTask() instead.
 */
export function getSkillsForRole(role: string): string {
  return getSkillsForTask(role);
}

/**
 * Load a specific skill by name.
 */
export function getSkill(name: string): string {
  return readSkillFile(name);
}

/**
 * Get list of available skills.
 */
export function listAvailableSkills(): string[] {
  const skillsDir = path.join(process.cwd(), 'skills');
  try {
    return fs.readdirSync(skillsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
  } catch {
    return [];
  }
}
