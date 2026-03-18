// API Client for PredictSpinz Mobile App
// Connects to backend for trading, markets, and portfolio
// Use environment variable or default to localhost for development

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('API request error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // ============ MARKETS ============
  
  async getMarkets(): Promise<ApiResponse<any[]>> {
    return this.request('/trades/markets');
  }

  async getMarket(id: string): Promise<ApiResponse<any>> {
    return this.request(`/trades/markets/${id}`);
  }

  // ============ TRADING ============
  
  async executeTrade(params: {
    marketId: string;
    outcomeId: string;
    amount: number;
    userId: string;
  }): Promise<ApiResponse<{ cost: number; newBalance: number; prices: Record<string, number> }>> {
    return this.request('/trades/trade', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ============ PORTFOLIO ============
  
  async getPortfolio(userId: string): Promise<ApiResponse<any[]>> {
    return this.request(`/trades/portfolio/${userId}`);
  }

  // ============ USER ============
  
  async getUser(userId: string): Promise<ApiResponse<any>> {
    return this.request(`/users/${userId}`);
  }

  async updateUser(userId: string, data: any): Promise<ApiResponse<any>> {
    return this.request(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // ============ AUTH ============
  
  async verifyToken(firebaseToken: string): Promise<ApiResponse<{ token: string }>> {
    return this.request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token: firebaseToken }),
    });
  }

  // ============ LEADERBOARD ============
  
  async getLeaderboard(type: 'credits' | 'roi' = 'credits'): Promise<ApiResponse<any[]>> {
    return this.request(`/leaderboard?type=${type}`);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types
export type { ApiResponse };
