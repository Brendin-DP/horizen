import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { updateProfile, uploadAvatar, type Member } from '../../lib/api';
import { colors, borderRadius } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHOW_PROFILE_V2_TAB } from '../../lib/featureFlags';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

type ProfileVersion = 'v1' | 'v2';

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
      { key: 'request', label: 'Request a feature', icon: 'sparkles-outline' as const },
    ],
  },
];

function showComingSoon() {
  Alert.alert('Coming soon', "We're working on this. Stay tuned!");
}

function ProfileV1Content({
  member,
  token,
  updateMember,
  logout,
  getAvatarUrl,
  handleChangePhoto,
  uploading,
}: {
  member: Member | null;
  token: string | null;
  updateMember: (member: Member) => Promise<void>;
  logout: () => Promise<void>;
  getAvatarUrl: (url: string | null | undefined) => string | null;
  handleChangePhoto: () => Promise<void>;
  uploading: boolean;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member?.name) {
      const parts = member.name.trim().split(/\s+/);
      setFirstName(parts[0] ?? '');
      setLastName(parts.slice(1).join(' ') ?? '');
    }
    if (member?.email) setEmail(member.email);
  }, [member?.name, member?.email]);

  async function handleSave() {
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim();
    if (!fullName) {
      setError('Name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile({ name: fullName, email: email.trim() }, token);
      await updateMember(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <View style={styles.avatarSection}>
        {member?.avatarUrl ? (
          <Image source={{ uri: getAvatarUrl(member.avatarUrl) ?? member.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{getInitials(member?.name ?? '?')}</Text>
          </View>
        )}
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

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.form}>
        <Text style={styles.label}>First name</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <Text style={styles.label}>Last name</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email@example.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Pressable
        style={[styles.saveBtn, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.saveBtnText}>Save changes</Text>
        )}
      </Pressable>
    </>
  );
}

function ProfileV2Content({
  member,
  logout,
  getAvatarUrl,
  handleChangePhoto,
  uploading,
}: {
  member: Member | null;
  logout: () => Promise<void>;
  getAvatarUrl: (url: string | null | undefined) => string | null;
  handleChangePhoto: () => Promise<void>;
  uploading: boolean;
}) {
  return (
    <>
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
                onPress={showComingSoon}
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
  const { member, token, updateMember, logout, getAvatarUrl } = useAuth();
  const [profileVersion, setProfileVersion] = useState<ProfileVersion>('v1');
  const [uploading, setUploading] = useState(false);

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
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, profileVersion === 'v2' && styles.safeV2]}
      edges={['top']}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {SHOW_PROFILE_V2_TAB && (
          <View style={styles.tabSwitcher}>
            <Pressable
              style={[styles.tab, profileVersion === 'v1' && styles.tabActive]}
              onPress={() => setProfileVersion('v1')}
            >
              <Text style={[styles.tabText, profileVersion === 'v1' && styles.tabTextActive]}>V1</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, profileVersion === 'v2' && styles.tabActive]}
              onPress={() => setProfileVersion('v2')}
            >
              <Text style={[styles.tabText, profileVersion === 'v2' && styles.tabTextActive]}>V2</Text>
            </Pressable>
          </View>
        )}

        {profileVersion === 'v1' ? (
          <ProfileV1Content
            member={member}
            token={token}
            updateMember={updateMember}
            logout={logout}
            getAvatarUrl={getAvatarUrl}
            handleChangePhoto={handleChangePhoto}
            uploading={uploading}
          />
        ) : (
          <ProfileV2Content
            member={member}
            logout={logout}
            getAvatarUrl={getAvatarUrl}
            handleChangePhoto={handleChangePhoto}
            uploading={uploading}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  safeV2: { backgroundColor: colors.backgroundDark },
  scroll: { flex: 1 },
  container: { flexGrow: 1, padding: 24 },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
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
  error: {
    color: colors.primary,
    fontSize: 14,
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.accent,
    borderRadius: 8,
  },
  form: { marginBottom: 24 },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    color: colors.textPrimary,
    fontSize: 16,
  },
  saveBtn: {
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
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
