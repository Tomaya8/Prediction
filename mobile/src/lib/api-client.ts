// API Client for PredictSpinz Mobile App
// Connects to backend for trading, markets, and portfolio
// Use environment variable or default to localhost for development

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// TypeScript interfaces for type safety
export interface Outcome {
  id: string;
  name: string;
  color?: string;
  currentPrice?: number;
  quantity?: number;
}

export interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  expiresAt: string;
  totalVolume: number;
  outcomes: Outcome[];
  prices?: Record<string, number>;
  liquidityParameter?: number;
}

export interface Trade {
  id: string;
  marketId: string;
  outcomeId: string;
  amount: number;
  cost: number;
  userId: string;
  timestamp: string;
}

export interface Portfolio {
  id: string;
  userId: string;
  marketId: string;
  outcomeId: string;
  shares: number;
  avgPrice: number;
  currentValue: number;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  credits: number;
  createdAt: string;
}

export interface TradeResult {
  cost: number;
  newBalance: number;
  prices: Record<string, number>;
  shares: number;
}

export interface ApiResponse<T> {
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

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount: number = 0
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
        // Provide more detailed error messages based on status code
        let errorMessage = data.error || 'Request failed';
        if (response.status === 401) {
          errorMessage = 'Unauthorized. Please log in again.';
          // Clear stale token so the auth guard in _layout.tsx redirects to login
          this.authToken = null;
        } else if (response.status === 403) {
          errorMessage = 'Access denied.';
        } else if (response.status === 404) {
          errorMessage = 'Resource not found.';
        } else if (response.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
        return { success: false, error: errorMessage };
      }

      // Backend already returns { success, data, error } — return it directly
      return data as ApiResponse<T>;
    } catch (error) {
      console.error('API request error:', error);
      
      // Retry logic for network errors (silent retry in production)
      if (retryCount < MAX_RETRIES) {
        // Only log retries in development mode
        if (__DEV__) {
          console.log(`Retrying request (${retryCount + 1}/${MAX_RETRIES})...`);
        }
        await this.delay(RETRY_DELAY * (retryCount + 1)); // Exponential backoff
        return this.request<T>(endpoint, options, retryCount + 1);
      }
      
      // Provide more specific error messages
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        return { success: false, error: 'Network error. Please check your internet connection.' };
      }
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  // ============ MARKETS ============
  
  async getMarkets(): Promise<ApiResponse<any[]>> {
    return this.request('/trades/markets');
  }

  async getMarket(id: string): Promise<ApiResponse<any>> {
    return this.request(`/trades/markets/${id}`);
  }

  async createMarket(params: {
    title: string;
    description: string;
    category: string;
    outcomes: string[];
    expiresAt: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/markets', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ============ TRADING ============
  
  async previewTrade(params: { marketId: string; outcomeId: string; amount: number }): Promise<ApiResponse<{ cost: number; pricePerShare: number; amount: number }>> {
    return this.request('/trades/preview', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async previewByCost(params: { marketId: string; outcomeId: string; credits: number }): Promise<ApiResponse<{ shares: number; actualCost: number; maxPayout: number; pricePerShare: number }>> {
    return this.request('/trades/preview-by-cost', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async executeTrade(params: {
    marketId: string;
    outcomeId: string;
    amount: number;
  }): Promise<ApiResponse<{ cost: number; newBalance: number; prices: Record<string, number> }>> {
    return this.request('/trades/trade', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async sellShares(params: {
    marketId: string;
    outcomeId: string;
    amount: number;
  }): Promise<ApiResponse<{ revenue: number; newBalance: number; prices: Record<string, number>; shares: number }>> {
    return this.request('/trades/sell', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ============ PORTFOLIO ============
  
  async getPortfolio(userId: string): Promise<ApiResponse<any[]>> {
    return this.request(`/trades/portfolio/${userId}`);
  }

  // ============ USER ============

  async getProfile(): Promise<ApiResponse<{ id: string; displayName: string; creditBalance: number; totalTrades: number; winningTrades: number; roi: number }>> {
    return this.request('/users/me');
  }

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

  async searchUsers(query: string): Promise<ApiResponse<any[]>> {
    return this.request(`/users/search?q=${encodeURIComponent(query)}`);
  }

  // ============ LEADERBOARD ============

  async getLeaderboard(type: 'credits' | 'roi' = 'credits'): Promise<ApiResponse<any[]>> {
    return this.request(`/leaderboard?type=${type}`);
  }

  // ============ TOURNAMENTS ============

  async getTournaments(status?: string): Promise<ApiResponse<any[]>> {
    const q = status ? `?status=${status}` : '';
    return this.request(`/tournaments${q}`);
  }

  async joinTournament(id: string): Promise<ApiResponse<any>> {
    return this.request(`/tournaments/${id}/join`, { method: 'POST' });
  }

  async getTournamentLeaderboard(id: string): Promise<ApiResponse<any[]>> {
    return this.request(`/tournaments/${id}/leaderboard`);
  }

  // ============ SOCIAL / FRIENDS ============

  async getFriends(): Promise<ApiResponse<any[]>> {
    return this.request('/social/friends');
  }

  async followUser(userId: string): Promise<ApiResponse<any>> {
    return this.request(`/social/follow/${userId}`, { method: 'POST' });
  }

  async unfollowUser(userId: string): Promise<ApiResponse<any>> {
    return this.request(`/social/follow/${userId}`, { method: 'DELETE' });
  }

  async getChallenges(): Promise<ApiResponse<any[]>> {
    return this.request('/social/challenges');
  }

  async createChallenge(data: {
    challengedId: string;
    marketId: string;
    challengerOutcomeId: string;
    amount: number;
  }): Promise<ApiResponse<any>> {
    return this.request('/social/challenges', { method: 'POST', body: JSON.stringify(data) });
  }

  async acceptChallenge(id: string, challengedOutcomeId: string): Promise<ApiResponse<any>> {
    return this.request(`/social/challenges/${id}/accept`, {
      method: 'PUT',
      body: JSON.stringify({ challengedOutcomeId }),
    });
  }

  async declineChallenge(id: string): Promise<ApiResponse<any>> {
    return this.request(`/social/challenges/${id}/decline`, { method: 'PUT' });
  }

  async getReferralInfo(): Promise<ApiResponse<any>> {
    return this.request('/social/referral');
  }

  // ============ COMMENTS ============

  async getComments(marketId: string, offset = 0): Promise<ApiResponse<any[]>> {
    return this.request(`/markets/${marketId}/comments?limit=20&offset=${offset}`);
  }

  async postComment(marketId: string, content: string, parentId?: string): Promise<ApiResponse<any>> {
    return this.request(`/markets/${marketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId }),
    });
  }

  async likeComment(marketId: string, commentId: string): Promise<ApiResponse<any>> {
    return this.request(`/markets/${marketId}/comments/${commentId}/like`, { method: 'POST' });
  }

  // ============ USER (extended) ============

  async getMe(): Promise<ApiResponse<any>> {
    return this.request('/users/me');
  }

  async claimDailyReward(): Promise<ApiResponse<any>> {
    return this.request('/users/me/daily-reward', { method: 'POST' });
  }

  // ============ PROPOSALS ============

  async submitProposal(params: {
    title: string;
    description?: string;
    category: string;
    outcomes?: string[];
    suggestedExpiry: string;
    resolutionCriteria?: string;
    sourceUrl?: string;
  }): Promise<ApiResponse<any>> {
    return this.request('/proposals', { method: 'POST', body: JSON.stringify(params) });
  }

  async getProposals(status = 'PENDING', sort = 'upvotes'): Promise<ApiResponse<any[]>> {
    return this.request(`/proposals?status=${status}&sort=${sort}`);
  }

  async getMyProposals(): Promise<ApiResponse<any[]>> {
    return this.request('/proposals/mine');
  }

  async voteProposal(proposalId: string): Promise<ApiResponse<any>> {
    return this.request(`/proposals/${proposalId}/vote`, { method: 'POST' });
  }

  // ============ TRANSACTIONS ============

  async getTransactions(type?: string): Promise<ApiResponse<any[]>> {
    const q = type ? `?type=${type}` : '';
    return this.request(`/users/me/transactions${q}`);
  }

  async getAchievements(): Promise<ApiResponse<any[]>> {
    return this.request('/leaderboard/achievements');
  }
}

// Update method return types to use proper interfaces
class ApiClientTyped extends ApiClient {
  async getMarkets(): Promise<ApiResponse<Market[]>> {
    return super.getMarkets() as Promise<ApiResponse<Market[]>>;
  }

  async getMarket(id: string): Promise<ApiResponse<Market>> {
    return super.getMarket(id) as Promise<ApiResponse<Market>>;
  }

  async executeTrade(params: {
    marketId: string;
    outcomeId: string;
    amount: number;
  }): Promise<ApiResponse<TradeResult>> {
    return super.executeTrade(params) as Promise<ApiResponse<TradeResult>>;
  }

  async getPortfolio(userId: string): Promise<ApiResponse<Portfolio[]>> {
    return super.getPortfolio(userId) as Promise<ApiResponse<Portfolio[]>>;
  }

  async getUser(userId: string): Promise<ApiResponse<User>> {
    return super.getUser(userId) as Promise<ApiResponse<User>>;
  }
}

// Export singleton instance with typed methods
export const apiClient = new ApiClientTyped();
