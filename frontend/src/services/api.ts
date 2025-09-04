import axios from 'axios';
import { 
  AnalysisRequest, 
  AnalysisResponse, 
  AnalysisStatus, 
  ExportRequest, 
  ExportResponse,
  ValidationResult 
} from '../../../shared/types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    
    if (error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    if (error.response?.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please try again.');
    }
    
    throw error;
  }
);

export const apiService = {
  // Validate URLs before analysis
  async validateUrls(urls: string[]): Promise<ValidationResult> {
    try {
      const response = await api.post('/validate', { urls });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to validate URLs');
    }
  },

  // Start analysis
  async startAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
    try {
      const response = await api.post('/analysis/start', request);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to start analysis');
    }
  },

  // Get analysis status
  async getAnalysisStatus(jobId: string): Promise<AnalysisStatus> {
    try {
      const response = await api.get(`/analysis/status/${jobId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get analysis status');
    }
  },

  // Get analysis results
  async getAnalysisResults(jobId: string) {
    try {
      const response = await api.get(`/analysis/results/${jobId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to get analysis results');
    }
  },

  // Export results
  async exportResults(request: ExportRequest): Promise<ExportResponse> {
    try {
      const response = await api.post('/export', request, {
        responseType: request.format === 'pdf' ? 'blob' : 'json'
      });
      
      if (request.format === 'pdf') {
        // Handle PDF blob download
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `seo-geo-analysis-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        return {
          success: true,
          metadata: {
            format: 'pdf',
            fileSize: blob.size,
            generatedAt: new Date()
          }
        };
      }
      
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to export results');
    }
  },

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await api.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
};

export default apiService;