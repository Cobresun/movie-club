import { ClubsViewClub, DataService } from '@/models';
import { useFetchCache } from './useFetch'

export function useClub(clubId: string | string[]): DataService<ClubsViewClub> {
    const fetch = useFetchCache<ClubsViewClub>(`club-${clubId}`, `/api/club/${clubId}`);
    return { ...fetch }
}
