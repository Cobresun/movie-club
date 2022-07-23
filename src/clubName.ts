import { ref } from 'vue'

export function useClubName(clubId: string | string[]) {
    const clubName = ref("")

    fetch(`/api/club/${clubId}`)
        .then((res) => res.json())
        .then((json) => (clubName.value = json.clubName))
    
    return { clubName }
}
