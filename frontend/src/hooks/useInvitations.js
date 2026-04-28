import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getMyProjectInvitations, getMysSiteInvitations,
  acceptProjectInvitation, declineProjectInvitation,
  acceptSiteInvitation, declineSiteInvitation,
} from '../api/projects'

export function useMyInvitations() {
  const projectQ = useQuery({ queryKey: ['my-project-invitations'], queryFn: getMyProjectInvitations })
  const siteQ    = useQuery({ queryKey: ['my-site-invitations'],    queryFn: getMysSiteInvitations })

  const allPending = [
    ...(projectQ.data?.filter(i => i.status === 'pending') ?? []).map(i => ({ ...i, _type: 'project' })),
    ...(siteQ.data?.filter(i => i.status === 'pending') ?? []).map(i => ({ ...i, _type: 'site' })),
  ]

  return {
    projectInvitations: projectQ.data ?? [],
    siteInvitations:    siteQ.data ?? [],
    pendingCount: allPending.length,
    isLoading: projectQ.isLoading || siteQ.isLoading,
  }
}

export function useInvitationActions() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['my-project-invitations'] })
    qc.invalidateQueries({ queryKey: ['my-site-invitations'] })
    qc.invalidateQueries({ queryKey: ['projects'] })
  }

  return {
    acceptProject:  useMutation({ mutationFn: acceptProjectInvitation,  onSuccess: invalidate }),
    declineProject: useMutation({ mutationFn: declineProjectInvitation, onSuccess: invalidate }),
    acceptSite:     useMutation({ mutationFn: acceptSiteInvitation,     onSuccess: invalidate }),
    declineSite:    useMutation({ mutationFn: declineSiteInvitation,    onSuccess: invalidate }),
  }
}