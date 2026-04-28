import apiClient from './client'

// ---- Projects ----
export const getProjects = () => apiClient.get('/projects/').then(r => r.data)
export const getProject  = (id) => apiClient.get(`/projects/${id}/`).then(r => r.data)
export const createProject = (data) => apiClient.post('/projects/', data).then(r => r.data)
export const updateProject = (id, data) => apiClient.patch(`/projects/${id}/`, data).then(r => r.data)
export const deleteProject = (id) => apiClient.delete(`/projects/${id}/`)

// ---- Project invitations ----
export const inviteToProject = (id, data) => apiClient.post(`/projects/${id}/invite/`, data).then(r => r.data)
export const getProjectInvitations = (id) => apiClient.get(`/projects/${id}/invitations/`).then(r => r.data)

// ---- Sites ----
export const getSites = (projectId) => apiClient.get(`/projects/${projectId}/sites/`).then(r => r.data)
export const getSite  = (projectId, siteId) => apiClient.get(`/projects/${projectId}/sites/${siteId}/`).then(r => r.data)
export const createSite = (projectId, data) => apiClient.post(`/projects/${projectId}/sites/`, data).then(r => r.data)
export const updateSite = (projectId, siteId, data) => apiClient.patch(`/projects/${projectId}/sites/${siteId}/`, data).then(r => r.data)
export const deleteSite = (projectId, siteId) => apiClient.delete(`/projects/${projectId}/sites/${siteId}/`)

// ---- Site invitations ----
export const inviteToSite = (projectId, siteId, data) => apiClient.post(`/projects/${projectId}/sites/${siteId}/invite/`, data).then(r => r.data)
export const getSiteInvitations = (projectId, siteId) => apiClient.get(`/projects/${projectId}/sites/${siteId}/invitations/`).then(r => r.data)

// ---- Work Items ----
export const getWorkItems = (projectId, siteId) => apiClient.get(`/projects/${projectId}/sites/${siteId}/workitems/`).then(r => r.data)
export const getWorkItem  = (projectId, siteId, wiId) => apiClient.get(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/`).then(r => r.data)
export const createWorkItem = (projectId, siteId, data) => apiClient.post(`/projects/${projectId}/sites/${siteId}/workitems/`, data).then(r => r.data)
export const updateWorkItem = (projectId, siteId, wiId, data) => apiClient.patch(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/`, data).then(r => r.data)
export const deleteWorkItem = (projectId, siteId, wiId) => apiClient.delete(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/`)

// ---- Job Items ----
export const getJobItems = (projectId, siteId, wiId) => apiClient.get(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/jobitems/`).then(r => r.data)
export const getJobItem  = (projectId, siteId, wiId, jiId) => apiClient.get(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/jobitems/${jiId}/`).then(r => r.data)
export const createJobItem = (projectId, siteId, wiId, data) => apiClient.post(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/jobitems/`, data).then(r => r.data)
export const updateJobItem = (projectId, siteId, wiId, jiId, data) => apiClient.patch(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/jobitems/${jiId}/`, data).then(r => r.data)

// ---- Job Reports ----
export const getJobReports = (projectId, siteId, wiId, jiId) => apiClient.get(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/jobitems/${jiId}/reports/`).then(r => r.data)
export const createJobReport = (projectId, siteId, wiId, jiId, data) => apiClient.post(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/jobitems/${jiId}/reports/`, data).then(r => r.data)
export const updateJobReport = (projectId, siteId, wiId, jiId, repId, data) => apiClient.patch(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/jobitems/${jiId}/reports/${repId}/`, data).then(r => r.data)
export const approveReport  = (projectId, siteId, wiId, jiId, repId) => apiClient.post(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/jobitems/${jiId}/reports/${repId}/approve/`).then(r => r.data)
export const rejectReport   = (projectId, siteId, wiId, jiId, repId, data) => apiClient.post(`/projects/${projectId}/sites/${siteId}/workitems/${wiId}/jobitems/${jiId}/reports/${repId}/reject/`, data).then(r => r.data)

// ---- My Invitations ----
export const getMyProjectInvitations = () => apiClient.get('/invitations/projects/').then(r => r.data)
export const acceptProjectInvitation  = (id) => apiClient.post(`/invitations/projects/${id}/accept/`).then(r => r.data)
export const declineProjectInvitation = (id) => apiClient.post(`/invitations/projects/${id}/decline/`).then(r => r.data)
export const revokeProjectInvitation  = (id) => apiClient.post(`/invitations/projects/${id}/revoke/`).then(r => r.data)

export const getMysSiteInvitations = () => apiClient.get('/invitations/sites/').then(r => r.data)
export const acceptSiteInvitation  = (id) => apiClient.post(`/invitations/sites/${id}/accept/`).then(r => r.data)
export const declineSiteInvitation = (id) => apiClient.post(`/invitations/sites/${id}/decline/`).then(r => r.data)
export const revokeSiteInvitation  = (id) => apiClient.post(`/invitations/sites/${id}/revoke/`).then(r => r.data)