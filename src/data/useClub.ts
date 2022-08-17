import { ClubsViewClub, DataService, Member } from '@/models';
import { useFetchCache } from './useFetch'

export function useClub(clubId: string): DataService<ClubsViewClub> {
    const fetch = useFetchCache<ClubsViewClub>(`club-${clubId}`, `/api/club/${clubId}`);
    return { ...fetch }
}

export function useMembers(clubId: string): DataService<Member[]> {
    const fetch = useFetchCache<Member[]>(`members-${clubId}`, `/api/club/${clubId}/members`);
    return { ...fetch };
}
