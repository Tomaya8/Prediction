/**
 * API Client
 * HTTP client for communicating with the backend API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Request failed',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // ============================================
  // MARKETS
  // ============================================

  async getMarkets(params?: {
    category?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const query = queryParams.toString();
    return this.request(`/markets${query ? `?${query}` : ''}`);
  }

  async getMarket(id: string): Promise<ApiResponse<any>> {
    return this.request(`/markets/${id}`);
  }

  async getTrendingMarkets(): Promise<ApiResponse<any>> {
    return this.request('/markets/meta/trending');
  }

  async getCategories(): Promise<ApiResponse<string[]>> {
    return this.request('/markets/meta/categories');
  }

  // ============================================
  // TRADING
  // ============================================

  async executeTrade(data: {
    marketId: string;
    outcomeId: string;
    quantity: number;
    type: 'BUY' | 'SELL';
  }): Promise<ApiResponse<any>> {
    return this.request('/trades', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTradeHistory(params?: {
    marketId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const query = queryParams.toString();
    return this.request(`/trades${query ? `?${query}` : ''}`);
  }

  async getPortfolio(): Promise<ApiResponse<any>> {
    return this.request('/trades/portfolio');
  }

  // ============================================
  // USER
  // ============================================

  async getMe(): Promise<ApiResponse<any>> {
    return this.request('/users/me');
  }

  async updateProfile(data: {
    displayName?: string;
    avatarUrl?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getTransactions(params?: {
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const query = queryParams.toString();
    return this.request(`/users/me/transactions${query ? `?${query}` : ''}`);
  }

  async getStats(): Promise<ApiResponse<any>> {
    return this.request('/users/me/stats');
  }

  async claimDailyReward(): Promise<ApiResponse<any>> {
    return this.request('/users/me/daily-reward', {
      method: 'POST',
    });
  }

  async buyCredits(packCode: string): Promise<ApiResponse<any>> {
    return this.request('/users/me/buy-credits', {
      method: 'POST',
      body: JSON.stringify({ packCode }),
    });
  }

  async getCreditPacks(): Promise<ApiResponse<any>> {
    return this.request('/users/credit-packs');
  }

  // ============================================
  // LEADERBOARD
  // ============================================

  async getLeaderboard(params?: {
    period?: string;
    scoreType?: string;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    const query = queryParams.toString();
    return this.request(`/leaderboard${query ? `?${query}` : ''}`);
  }

  async getMyRank(scoreType?: string): Promise<ApiResponse<any>> {
    const query = scoreType ? `?scoreType=${scoreType}` : '';
    return this.request(`/leaderboard/me${query}`);
  }

  async getAchievements(): Promise<ApiResponse<any>> {
    return this.request('/leaderboard/achievements');
  }

  async getMyAchievements(): Promise<ApiResponse<any>> {
    return this.request('/leaderboard/achievements/me');
  }

  // ============================================
  // AUTH (Firebase handled client-side)
  // ============================================

  async verifyToken(firebaseToken: string): Promise<ApiResponse<{ token: string }>> {
    return this.request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token: firebaseToken }),
    });
  }

  // ============================================
  // ADMIN
  // ============================================

  async getAdminStats(): Promise<ApiResponse<any>> {
    return this.request('/admin/stats');
  }

  async getAdminUsers(search?: string): Promise<ApiResponse<any>> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/admin/users${query}`);
  }

  async addCredits(userId: string, amount: number, reason?: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/users/${userId}/credits`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason }),
    });
  }

  async banUser(userId: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/users/${userId}/ban`, {
      method: 'POST',
    });
  }

  async createMarket(data: {
    title: string;
    description: string;
    category: string;
    expiresAt: string;
    outcomes: { name: string }[];
  }): Promise<ApiResponse<any>> {
    return this.request('/markets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resolveMarket(id: string, outcomeId: string): Promise<ApiResponse<any>> {
    return this.request(`/markets/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ outcomeId }),
    });
  }

  async cancelMarket(id: string): Promise<ApiResponse<any>> {
    return this.request(`/markets/${id}/cancel`, {
      method: 'POST',
    });
  }
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);

// Export types
export type { ApiResponse };
