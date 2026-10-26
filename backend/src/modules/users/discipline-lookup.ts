// Port owned by the users module: the only thing it needs to know about disciplines.
export interface DisciplineIdLookup {
  // Unknown ids are simply absent from the result.
  findByIds(ids: readonly string[]): Promise<Array<{ id: string }>>;
}
