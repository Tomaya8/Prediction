import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Linking,
} from 'react-native';
import { Colors } from '../colors';

export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  thumbnail?: string;
  relevanceScore?: number;
}

interface NewsLinksProps {
  marketId: string;
  news: NewsArticle[];
  title?: string;
}

export const NewsLinks: React.FC<NewsLinksProps> = ({
  marketId,
  news,
  title = 'Related News',
}) => {
  const handleOpenArticle = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderNewsItem = ({ item }: { item: NewsArticle }) => (
    <TouchableOpacity
      style={styles.newsItem}
      onPress={() => handleOpenArticle(item.url)}
      activeOpacity={0.7}
    >
      <View style={styles.newsContent}>
        <Text style={styles.newsTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.newsMeta}>
          <Text style={styles.source}>{item.source}</Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.date}>{formatDate(item.publishedAt)}</Text>
        </View>
      </View>
      <View style={styles.arrow}>
        <Text style={styles.arrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );

  if (news.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Powered by PredictSpinz News</Text>
      </View>
      
      <FlatList
        data={news}
        renderItem={renderNewsItem}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
      />
      
      <TouchableOpacity style={styles.viewAllButton}>
        <Text style={styles.viewAllText}>View All News</Text>
      </TouchableOpacity>
    </View>
  );
};

// Mock news data for demo
export const generateMockNews = (marketTitle: string): NewsArticle[] => {
  const mockNews: NewsArticle[] = [
    {
      id: 'news-1',
      title: 'Market Analysis: Key factors driving prediction market movement',
      source: 'Bloomberg',
      url: 'https://bloomberg.com',
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'news-2',
      title: 'Expert opinions on the future direction of this sector',
      source: 'Reuters',
      url: 'https://reuters.com',
      publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'news-3',
      title: 'New data reveals important trends investors should watch',
      source: 'CNBC',
      url: 'https://cnbc.com',
      publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'news-4',
      title: 'Breaking: Major developments could impact market predictions',
      source: 'Financial Times',
      url: 'https://ft.com',
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  return mockNews;
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  newsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  newsContent: {
    flex: 1,
    marginRight: 12,
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  newsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  source: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  separator: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginHorizontal: 6,
  },
  date: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  arrow: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  viewAllButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
});
