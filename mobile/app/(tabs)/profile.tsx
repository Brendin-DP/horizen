import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePostHog } from 'posthog-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { uploadAvatar, type Member } from '../../lib/api';
import { colors, borderRadius, shell, typography } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HelpFaqModal } from '../../components/HelpFaqModal';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const V2_GROUPED_SECTIONS = [
  {
    title: 'Settings',
    items: [
      { key: 'account', label: 'Account', icon: 'person-outline' as const },
      { key: 'privacy', label: 'Privacy', icon: 'shield-checkmark-outline' as const },
      { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' as const },
    ],
  },
  {
    title: 'Resources',
    items: [
      { key: 'help', label: 'Help', icon: 'help-circle-outline' as const },
      { key: 'invite', label: 'Invite a Friend', icon: 'people-outline' as const },
      { key: 'roadmap', label: 'Product Roadmap', icon: 'map-outline' as const },
      { key: 'request', label: 'Request a feature', icon: 'sparkles-outline' as const },
    ],
  },
];

function showComingSoon() {
  Alert.alert('Coming soon', "We're working on this. Stay tuned!");
}

function ProfileV2Content({
  member,
  logout,
  getAvatarUrl,
  handleChangePhoto,
  uploading,
  onSettingsItemPress,
}: {
  member: Member | null;
  logout: () => Promise<void>;
  getAvatarUrl: (url: string | null | undefined) => string | null;
  handleChangePhoto: () => Promise<void>;
  uploading: boolean;
  onSettingsItemPress: (key: string) => void;
}) {
  return (
    <>
      <View style={styles.titleRow}>
        <Text style={styles.screenTitle}>Profile</Text>
      </View>

      <View style={styles.v2AvatarSection}>
        {member?.avatarUrl ? (
          <Image source={{ uri: getAvatarUrl(member.avatarUrl) ?? member.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{getInitials(member?.name ?? '?')}</Text>
          </View>
        )}
        <Text style={styles.v2Name}>{member?.name ?? 'User'}</Text>
        <Pressable
          style={[styles.changePhotoBtn, uploading && styles.buttonDisabled]}
          onPress={handleChangePhoto}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.changePhotoText}>Change photo</Text>
          )}
        </Pressable>
      </View>

      {V2_GROUPED_SECTIONS.map((group) => (
        <View key={group.title} style={styles.v2SectionBlock}>
          <Text style={styles.v2SectionHeader}>{group.title}</Text>
          <View style={styles.v2SectionCard}>
            {group.items.map((item, idx) => (
              <Pressable
                key={item.key}
                style={[
                  styles.v2SectionRow,
                  idx === group.items.length - 1 && styles.v2SectionRowLast,
                ]}
                onPress={() => onSettingsItemPress(item.key)}
              >
                <Ionicons name={item.icon} size={22} color={colors.textSecondary} />
                <Text style={styles.v2SectionLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.v2SectionBlock}>
        <View style={styles.v2SectionCard}>
          <Pressable style={[styles.v2SectionRow, styles.v2SectionRowLast]} onPress={logout}>
            <Ionicons name="log-out-outline" size={22} color={colors.primary} />
            <Text style={[styles.v2SectionLabel, styles.v2LogoutText]}>Log out</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const posthog = usePostHog();
  const { member, token, updateMember, logout, getAvatarUrl } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [helpFaqOpen, setHelpFaqOpen] = useState(false);

  function handleSettingsItemPress(key: string) {
    if (key === 'privacy') {
      router.push('/privacy');
      return;
    }
    if (key === 'account') {
      router.push('/account');
      return;
    }
    if (key === 'roadmap') {
      router.push('/roadmap');
      return;
    }
    if (key === 'request') {
      router.push('/feature-request');
      return;
    }
    if (key === 'help') {
      setHelpFaqOpen(true);
      return;
    }
    showComingSoon();
  }

  async function handleChangePhoto() {
    if (!token) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to set your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const updated = await uploadAvatar(result.assets[0].uri, token);
      await updateMember(updated);
      posthog?.capture('changed_avatar');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <ProfileV2Content
          member={member}
          logout={logout}
          getAvatarUrl={getAvatarUrl}
          handleChangePhoto={handleChangePhoto}
          uploading={uploading}
          onSettingsItemPress={handleSettingsItemPress}
        />
      </ScrollView>
      <HelpFaqModal visible={helpFaqOpen} onClose={() => setHelpFaqOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: shell.body },
  scroll: { flex: 1 },
  container: { flexGrow: 1, padding: 24 },
  titleRow: {
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 22,
    color: colors.textPrimary,
    fontFamily: typography.heading,
  },
  v2AvatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  v2Name: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '600',
    color: colors.primary,
  },
  changePhotoBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changePhotoText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: { opacity: 0.6 },
  v2SectionBlock: {
    marginBottom: 24,
  },
  v2SectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: typography.headingSemibold,
  },
  v2SectionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  v2SectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  v2SectionRowLast: {
    borderBottomWidth: 0,
  },
  v2SectionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  v2LogoutText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
