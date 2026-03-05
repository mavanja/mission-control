/**
 * Skill Loader
 *
 * Reads skill markdown files from the /skills directory and injects
 * them into agent dispatch messages based on the agent's workflow role.
 *
 * Skills are 1:1 copies from the Anthropic skills repository
 * (installed via `npx skills add https://github.com/anthropics/skills`).
 */

import fs from 'fs';
import path from 'path';

/** Map workflow roles to skill file names (without .md extension). */
const ROLE_SKILLS: Record<string, string[]> = {
  builder: ['frontend-design', 'frontend-patterns', 'interaction-design', 'heroui-react', 'tdd-workflow', 'coding-standards'],
  tester: ['verification-loop'],
  reviewer: ['security-review', 'coding-standards'],
  verifier: ['security-review', 'coding-standards'],
};

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
 * Load and concatenate all skills for a given workflow role.
 * Returns formatted markdown string ready for injection into dispatch message.
 */
export function getSkillsForRole(role: string): string {
  const normalizedRole = role.toLowerCase();
  const skillNames = ROLE_SKILLS[normalizedRole];

  if (!skillNames || skillNames.length === 0) {
    return '';
  }

  const sections = skillNames
    .map(name => readSkillFile(name))
    .filter(content => content.length > 0);

  if (sections.length === 0) {
    return '';
  }

  return `\n---\n**SKILLS & STANDARDS (befolge diese Richtlinien):**\n\n${sections.join('\n\n---\n\n')}`;
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
