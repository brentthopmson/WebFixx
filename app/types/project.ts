export interface Project {
  id: string;
  formId: string;
  projectId: string;
  projectType: string;
  projectTitle: string;
  templateNiche: string;
  templateTitle: string;
  templateType: string;
  pageHealth: string;
  redirectId?: string;
  redirectURL?: string;
  redirectHealth?: string;
  domainId?: string;
  domainURL?: string;
  domainHealth?: string;
  pageVisits: number;
  botVisits: number;
  flaggedVisits: number;
  expiryDate: string;
  response: string;
  email?: string;
  telegramGroupId?: string;
  responseCount: number;
  responses: any[]; // TODO: Define a more specific type for responses
  templateVariables: string;
  systemStatus: string;
  pageURL?: string;
  templateId: string;
  links?: any[]; // TODO: Define a more specific type for links
  notifyVisits: boolean;
}
