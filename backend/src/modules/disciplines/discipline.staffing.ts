import { ValidationError } from '../../shared/errors.js';
import { foldText } from '../../shared/text.js';
import type { UserRepository } from '../users/user.repository.js';
import type { DemoUser } from '../users/user.types.js';
import type { DisciplineService } from './discipline.service.js';
import type { Discipline, DisciplineInput, DisciplineListQuery } from './discipline.types.js';
import { validateDisciplineInput } from './discipline.validation.js';

/** A teacher account that can be put on a discipline. */
export interface TeacherOption {
  id: string;
  name: string;
}

/**
 * A discipline as the API shows it. Its teachers are the active teacher accounts that have it assigned, so the names
 * are always the accounts' current ones; `teacherIds` is empty and the stored names are shown for a discipline
 * whose teachers were typed in before teachers were accounts.
 */
export type StaffedDiscipline = Omit<Discipline, 'leadTeacherId'> & { teacherIds: string[]; leadTeacherId: string | null };

export interface DisciplineStaffingDeps {
  disciplines: DisciplineService;
  users: Pick<UserRepository, 'list' | 'replace'>;
}

const byName = (a: { name: string }, b: { name: string }) => foldText(a.name).localeCompare(foldText(b.name));

/**
 * Disciplines whose teachers are teacher accounts. Who teaches a discipline is stored once, on the accounts
 * (`disciplineIds`, the same list the users screen edits and the roster reads); the discipline itself only keeps
 * which of them is in charge. Saving a discipline here updates those accounts.
 */
export function createDisciplineStaffing({ disciplines, users }: DisciplineStaffingDeps) {
  const activeTeachers = (): DemoUser[] => users.list().filter((user) => user.active && user.role === 'teacher').sort(byName);

  function view(discipline: Discipline): StaffedDiscipline {
    const { leadTeacherId, ...rest } = discipline;
    if (leadTeacherId === undefined) return { ...rest, teacherIds: [], leadTeacherId: null };
    const assigned = activeTeachers().filter((teacher) => teacher.disciplineIds?.includes(discipline.id));
    // An account can lose the discipline from the users screen; the first remaining teacher is then in charge.
    const lead = assigned.find((teacher) => teacher.id === leadTeacherId) ?? assigned[0];
    return { ...rest, teachers: assigned.map(({ name }) => name), leadTeacher: lead?.name ?? '', teacherIds: assigned.map(({ id }) => id), leadTeacherId: lead?.id ?? null };
  }

  // The request names accounts; the discipline keeps their names as they are today, plus the id of the one in charge.
  function toInput(raw: unknown): { input: DisciplineInput; teacherIds: string[] } {
    const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const errors: Record<string, string> = {};
    const candidates = new Map(activeTeachers().map((teacher) => [teacher.id, teacher]));
    const sent = Array.isArray(body.teacherIds) ? [...new Set(body.teacherIds)] : [];
    const chosen = sent.map((id) => (typeof id === 'string' ? candidates.get(id) : undefined));

    if (sent.length === 0) errors.teachers = 'At least one teacher is required';
    else if (chosen.some((teacher) => !teacher)) errors.teachers = 'Every teacher must be an active teacher account';

    const lead = chosen.find((teacher) => teacher && teacher.id === body.leadTeacherId);
    if (typeof body.leadTeacherId !== 'string' || body.leadTeacherId === '') errors.leadTeacher = 'Lead teacher is required';
    else if (!lead && !errors.teachers) errors.leadTeacher = 'Lead teacher must be one of the teachers';

    const teachers = chosen.filter((teacher): teacher is DemoUser => teacher !== undefined);
    // Two accounts may share a name; the stored names must differ, so a repeated one carries its email.
    const repeated = (name: string) => teachers.filter((teacher) => foldText(teacher.name) === foldText(name)).length > 1;
    const label = ({ name, email }: DemoUser) => (repeated(name) ? `${name} (${email})` : name);

    if (Object.keys(errors).length > 0 || !lead) {
      // Report a bad name together with the teacher errors, in one answer.
      try { validateDisciplineInput({ name: body.name, teachers: ['x'], leadTeacher: 'x' }); } catch (error) {
        if (error instanceof ValidationError && error.fieldErrors.name) errors.name = error.fieldErrors.name;
      }
      throw new ValidationError(errors);
    }
    return {
      input: validateDisciplineInput({ name: body.name, teachers: teachers.map(label), leadTeacher: label(lead), leadTeacherId: lead.id }),
      teacherIds: teachers.map(({ id }) => id),
    };
  }

  // Gives the discipline to exactly these teacher accounts and takes it from every other one.
  function assign(disciplineId: string, teacherIds: readonly string[]): void {
    const current = users.list();
    const next = current.map((user) => {
      if (user.role !== 'teacher') return user;
      const has = user.disciplineIds?.includes(disciplineId) ?? false;
      const wanted = teacherIds.includes(user.id);
      if (has === wanted) return user;
      const others = (user.disciplineIds ?? []).filter((id) => id !== disciplineId);
      return { ...user, disciplineIds: wanted ? [...others, disciplineId] : others };
    });
    if (next.some((user, index) => user !== current[index])) users.replace(next);
  }

  return {
    /** The active teacher accounts, by name: the ones a discipline can be given to. */
    teachers: (): TeacherOption[] => activeTeachers().map(({ id, name }) => ({ id, name })),

    async list(query?: DisciplineListQuery): Promise<StaffedDiscipline[]> {
      return (await disciplines.list(query)).map(view);
    },

    async getById(id: string): Promise<StaffedDiscipline> {
      return view(await disciplines.getById(id));
    },

    async create(raw: unknown, actorId: string): Promise<StaffedDiscipline> {
      const { input, teacherIds } = toInput(raw);
      const created = await disciplines.create(input, actorId);
      assign(created.id, teacherIds);
      return view(created);
    },

    async update(id: string, raw: unknown, actorId: string): Promise<StaffedDiscipline> {
      // An unknown discipline is "not found" before its body is judged.
      await disciplines.getById(id);
      const { input, teacherIds } = toInput(raw);
      const updated = await disciplines.update(id, input, actorId);
      assign(id, teacherIds);
      return view(updated);
    },

    async deactivate(id: string, actorId: string): Promise<StaffedDiscipline> {
      return view(await disciplines.deactivate(id, actorId));
    },

    async reactivate(id: string, actorId: string): Promise<StaffedDiscipline> {
      return view(await disciplines.reactivate(id, actorId));
    },
  };
}

export type DisciplineStaffing = ReturnType<typeof createDisciplineStaffing>;
