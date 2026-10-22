import React, { useState, useEffect } from 'react';
import { securedApi } from '../../../../../utils/auth';
import { authApi } from '../../../../../utils/auth';
import { syncProjectWorker } from '../../../../../utils/syncWorker';
import { useAppState } from '../../../../context/AppContext';

interface TemplateVariablesSettingsProps {
  project: {
    projectId: string;
    templateVariables?: string;
  };
  onSave?: (updatedTemplateVariables: string) => void;
}

export default function TemplateVariablesSettings({ 
  project, 
  onSave 
}: TemplateVariablesSettingsProps) {
  const { appData, setAppData } = useAppState();
  const [success, setSuccess] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Safe JSON parse utility
  function safeParseJSON(jsonString: string) {
    try {
      return JSON.parse(jsonString);
    } catch (err) {
      // Try to fix common JSON issues: remove trailing commas
      try {
        const fixed = jsonString
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        return JSON.parse(fixed);
      } catch (err2) {
        return undefined;
      }
    }
  }

  useEffect(() => {
    if (!project.templateVariables) {
      setTemplateVariables({});
      setError(null);
      setSuccess(false);
      return;
    }
    const parsedVariables = safeParseJSON(project.templateVariables);
    if (!parsedVariables) {
      setTemplateVariables({});
      setError('Template variables are not valid JSON. Please check and fix the data.');
      setSuccess(false);
      return;
    }
    setError(null);
    setSuccess(false);
    const excludedKeys = ['formId', 'postURL', 'token'];
    const flatVars: Record<string, string> = {};
    // Flatten top-level fields except excluded and nested objects
    Object.keys(parsedVariables).forEach(key => {
      if (!excludedKeys.includes(key) && typeof parsedVariables[key] !== 'object') {
        flatVars[key] = parsedVariables[key];
      }
    });
    // Handle nested templateData (or similar)
    Object.keys(parsedVariables).forEach(key => {
      if (
        typeof parsedVariables[key] === 'object' &&
        parsedVariables[key] !== null &&
        !Array.isArray(parsedVariables[key])
      ) {
        Object.keys(parsedVariables[key]).forEach(nestedKey => {
          // Use dot notation for nested keys
          flatVars[`${key}.${nestedKey}`] = parsedVariables[key][nestedKey];
        });
      }
    });
    setTemplateVariables(flatVars);
  }, [project]);

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Robustly parse project.templateVariables (string or object)
      let original: any = {};
      if (typeof project.templateVariables === 'string') {
        try {
          original = JSON.parse(project.templateVariables);
        } catch (err) {
          setError('Original template variables are not valid JSON. Cannot save.');
          setLoading(false);
          return;
        }
      } else if (typeof project.templateVariables === 'object' && project.templateVariables !== null) {
        original = project.templateVariables;
      }

      const excludedKeys = ['formId', 'postURL', 'token'];
      const result: any = {};
      // Copy over system fields and non-object fields
      Object.keys(original).forEach(key => {
        if (excludedKeys.includes(key) || typeof original[key] !== 'object') {
          result[key] = original[key];
        }
      });
      // Now fill in edited fields
      Object.entries(templateVariables).forEach(([key, value]) => {
        if (key.includes('.')) {
          // Nested value
          const [parent, child] = key.split('.');
          if (!result[parent]) result[parent] = {};
          result[parent][child] = value;
        } else {
          result[key] = value;
        }
      });

      let resultString = '';
      try {
        resultString = JSON.stringify(result);
      } catch (err) {
        setError('Failed to serialize template variables. Please check for invalid values.');
        setLoading(false);
        return;
      }


      const response = await securedApi.callBackendFunction({
        functionName: 'updateProjectTemplateVariables',
        projectId: project.projectId,
        templateVariables: resultString
      });

      if (response.success) {
        setSuccess(true);
        void syncProjectWorker(project.projectId);
        if (onSave) {
          onSave(resultString);
        }
      } else {
        setError(response.error || 'Failed to update template variables');
      }
    } catch (error) {
      console.error('Error saving template variables:', error);
      setError('Failed to save template variables');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div>
      {Object.keys(templateVariables).length === 0 ? (
        <div className="text-gray-500 text-sm mb-4 dark:text-gray-400">No template variables to edit for this project.</div>
      ) : (
        Object.entries(templateVariables).map(([key, value]) => (
          <div key={key} className="mb-3">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">{key}</label>
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setTemplateVariables(prev => ({
                  ...prev,
                  [key]: e.target.value
                }));
                setSuccess(false);
              }}
              className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        ))
      )}
      {success && (
        <div className="text-green-600 text-sm mt-2 dark:text-green-400">Template variables updated successfully!</div>
      )}
      {error && (
        <div className="text-red-500 text-sm mt-2 dark:text-red-400">{error}</div>
      )}
      {Object.keys(templateVariables).length > 0 && (
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white"
          >
            {loading ? 'Saving...' : 'Save Variables'}
          </button>
        </div>
      )}
    </div>
  );
}
