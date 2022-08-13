import { ClubsViewClub } from '@/models';
import { useFetchCache } from './useFetch'

export function useClub(clubId: string | string[]) {
    const fetch = useFetchCache<ClubsViewClub>(`club-${clubId}`, `/api/club/${clubId}`);
    return { ...fetch, club: fetch.data }
}
