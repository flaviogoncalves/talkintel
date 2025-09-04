import { createAuthHeaders } from '../config/api';

export interface AuthenticatedFetchOptions extends RequestInit {
  token: string;
  refreshToken?: () => Promise<boolean>;
}

/**
 * Fetch wrapper that automatically handles token refresh on 403 errors
 */
export async function authenticatedFetch(
  url: string, 
  options: AuthenticatedFetchOptions
): Promise<Response> {
  const { token, refreshToken, ...fetchOptions } = options;
  
  // First attempt with current token
  let response = await fetch(url, {
    ...fetchOptions,
    headers: {
      ...createAuthHeaders(token),
      ...fetchOptions.headers
    }
  });
  
  // If we get 403 and have refresh capability, try refreshing token
  if (response.status === 403 && refreshToken) {
    console.log('🔄 Token expired, attempting refresh...');
    
    const refreshSuccess = await refreshToken();
    if (refreshSuccess) {
      console.log('✅ Token refreshed, retrying request...');
      
      // Retry the request with refreshed token
      response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...createAuthHeaders(token), // This should now have the fresh token
          ...fetchOptions.headers
        }
      });
    } else {
      console.log('❌ Token refresh failed');
    }
  }
  
  return response;
}

/**
 * Simplified authenticated fetch for cases where we just need to handle errors gracefully
 */
export async function fetchWithAuth(url: string, token: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...createAuthHeaders(token),
      ...options?.headers
    }
  });
  
  if (response.status === 403) {
    throw new Error('Authentication expired. Please log in again.');
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response;
}