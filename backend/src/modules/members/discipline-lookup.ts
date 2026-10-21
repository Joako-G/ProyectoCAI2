// Port owned by the members module: the only thing it needs to know about disciplines.
export interface DisciplineRef {
  id: string;
  status: 'active' | 'inactive';
}

export interface DisciplineLookup {
  // Unknown ids are simply absent from the result.
  findByIds(ids: readonly string[]): Promise<DisciplineRef[]>;
}
