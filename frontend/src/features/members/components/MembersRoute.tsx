import { useSearchParams } from 'react-router';
import { MembersView, type MembersViewProps } from './MembersView';

/** Socios at its address: `/socios?search=…` opens with that search applied. */
export function MembersRoute(props: Omit<MembersViewProps, 'initialSearch'>) {
  const [params] = useSearchParams();
  return <MembersView {...props} initialSearch={params.get('search') ?? ''} />;
}
