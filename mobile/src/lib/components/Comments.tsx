import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Colors } from '../colors';

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  likes: number;
  isLikedByUser?: boolean;
}

interface CommentsProps {
  marketId: string;
  comments: Comment[];
  onAddComment: (content: string) => void;
  onLikeComment: (commentId: string) => void;
}

export const Comments: React.FC<CommentsProps> = ({
  marketId,
  comments,
  onAddComment,
  onLikeComment,
}) => {
  const [newComment, setNewComment] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);

  const displayedComments = showAllComments ? comments : comments.slice(0, 3);

  const handleSubmit = () => {
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment('');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.userName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.commentMeta}>
          <Text style={styles.userName}>{item.userName}</Text>
          <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
      </View>
      <Text style={styles.commentContent}>{item.content}</Text>
      <View style={styles.commentActions}>
        <TouchableOpacity
          style={styles.likeButton}
          onPress={() => onLikeComment(item.id)}
        >
          <Text style={[
            styles.likeIcon,
            item.isLikedByUser && styles.likeIconActive,
          ]}>
            {item.isLikedByUser ? '❤️' : '🤍'}
          </Text>
          <Text style={[
            styles.likeCount,
            item.isLikedByUser && styles.likeCountActive,
          ]}>
            {item.likes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.replyButton}>
          <Text style={styles.replyText}>Reply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discussion</Text>
        <Text style={styles.count}>{comments.length} comments</Text>
      </View>

      {displayedComments.length > 0 ? (
        <FlatList
          data={displayedComments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No comments yet</Text>
          <Text style={styles.emptySubtext}>Be the first to share your thoughts!</Text>
        </View>
      )}

      {comments.length > 3 && !showAllComments && (
        <TouchableOpacity
          style={styles.showMoreButton}
          onPress={() => setShowAllComments(true)}
        >
          <Text style={styles.showMoreText}>
            Show {comments.length - 3} more comments
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          placeholderTextColor={Colors.textSecondary}
          value={newComment}
          onChangeText={setNewComment}
          multiline
          scrollEnabled={false}
          onFocus={() => {
            // Small delay to let keyboard appear, then parent ScrollView will adjust
            setTimeout(() => {}, 300);
          }}
        />
        <TouchableOpacity
          style={[
            styles.submitButton,
            !newComment.trim() && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!newComment.trim()}
        >
          <Text style={styles.submitText}>Post</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Mock data generator for demo purposes
export const generateMockComments = (count: number = 5): Comment[] => {
  const users = [
    { id: '1', name: 'CryptoKing' },
    { id: '2', name: 'TraderJoe' },
    { id: '3', name: 'BullRunner' },
    { id: '4', name: 'MarketWatcher' },
    { id: '5', name: 'PricePredictor' },
    { id: '6', name: 'AlphaSeeker' },
    { id: '7', name: 'TrendTrader' },
  ];

  const commentTexts = [
    "This market seems fairly priced at current levels.",
    "I'm leaning towards Yes, the fundamentals support it.",
    "Anyone else thinking No on this one?",
    "Great opportunity here, loaded up my position.",
    "Volume is picking up, could see some movement soon.",
    "The timing on this resolution is key.",
    "I've been tracking this for weeks, very interesting.",
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `comment-${i}`,
    userId: users[i % users.length].id,
    userName: users[i % users.length].name,
    content: commentTexts[i % commentTexts.length],
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    likes: Math.floor(Math.random() * 50),
    isLikedByUser: Math.random() > 0.7,
  }));
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  count: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  commentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  commentMeta: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  timeAgo: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  commentContent: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  likeIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  likeIconActive: {
    transform: [{ scale: 1.1 }],
  },
  likeCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  likeCountActive: {
    color: Colors.primary,
  },
  replyButton: {
    padding: 4,
  },
  replyText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  showMoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    maxHeight: 100,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.textSecondary,
  },
  submitText: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
});
