import React, {useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AppIcon} from '@/components/common/AppIcon';
import {deleteAccount, changePassword} from '@/services/api';
import {useAlert} from '@/providers/AlertContext';
import {useAuth} from '@/providers/AuthContext';
import {usePreferences} from '@/providers/PreferencesContext';

const SNOOZE_OPTIONS_MINUTES = [2, 5, 10, 15, 30, 60] as const;

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: {value: T; label: string}[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="toggle-group">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className={`toggle-option ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const {showAlert} = useAlert();
  const {signOut} = useAuth();
  const {
    preferences,
    setDarkMode,
    setDateFormat,
    setTimeFormat,
    setDefaultSnoozeMinutes,
    resetPreferences,
  } = usePreferences();

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordNew, setPasswordNew] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [snoozeInput, setSnoozeInput] = useState(String(preferences.defaultSnoozeMinutes));

  useEffect(() => {
    setSnoozeInput(String(preferences.defaultSnoozeMinutes));
  }, [preferences.defaultSnoozeMinutes]);

  function applyCustomSnoozeInput() {
    const trimmed = snoozeInput.trim();
    if (!trimmed) {
      setSnoozeInput(String(preferences.defaultSnoozeMinutes));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setSnoozeInput(String(preferences.defaultSnoozeMinutes));
      return;
    }
    const safeMinutes = Math.max(1, Math.min(1440, Math.round(parsed)));
    void setDefaultSnoozeMinutes(safeMinutes);
    setSnoozeInput(String(safeMinutes));
  }

  async function handlePasswordChange() {
    if (passwordNew.length < 6) {
      showAlert('Invalid password', 'New password must be at least 6 characters.');
      return;
    }
    if (passwordNew !== passwordConfirm) {
      showAlert("Passwords don't match", 'New password and confirm password must match.');
      return;
    }

    setChangingPassword(true);
    try {
      await changePassword(passwordNew);
      setPasswordNew('');
      setPasswordConfirm('');
      setPasswordModalVisible(false);
      showAlert('Password updated', 'Your password was changed successfully.');
    } catch (error) {
      showAlert('Change failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      showAlert('Password required', 'Please enter your password to delete your account.');
      return;
    }
    setDeletingAccount(true);
    try {
      await deleteAccount();
      await signOut();
      router.replace('/login');
    } catch (error) {
      showAlert('Delete failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <div className="detail-page">
      <section className="detail-card settings-card">
        <div className="detail-header">
          <div>
            <Link href="/profile" className="back-link">
              <AppIcon name="chevron-left" size={18} />
              <span>Back to profile</span>
            </Link>
            <h1>Settings</h1>
          </div>
          <button type="button" className="icon-button subtle" onClick={() => void resetPreferences()}>
            <AppIcon name="rotate-ccw" size={18} />
          </button>
        </div>

        <div className="settings-section">
          <h2>Preferences</h2>

          <ToggleGroup
            value={preferences.darkMode ? 'dark' : 'light'}
            options={[
              {value: 'light', label: 'Light'},
              {value: 'dark', label: 'Dark'},
            ]}
            onChange={value => {
              void setDarkMode(value === 'dark');
            }}
          />

          <ToggleGroup
            value={preferences.dateFormat}
            options={[
              {value: 'eu', label: 'DD/MM/YYYY'},
              {value: 'us', label: 'MM/DD/YYYY'},
            ]}
            onChange={value => {
              void setDateFormat(value);
            }}
          />

          <ToggleGroup
            value={preferences.timeFormat}
            options={[
              {value: '12h', label: '12-hour'},
              {value: '24h', label: '24-hour'},
            ]}
            onChange={value => {
              void setTimeFormat(value);
            }}
          />

          <div className="settings-snooze-panel">
            <div className="settings-snooze-header">
              <strong>Snooze</strong>
              <div className="field-inline mini">
                <input
                  value={snoozeInput}
                  onChange={event => setSnoozeInput(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  onBlur={applyCustomSnoozeInput}
                />
                <span>min</span>
              </div>
            </div>

            <div className="priority-row">
              {SNOOZE_OPTIONS_MINUTES.map(minutes => (
                <button
                  key={minutes}
                  type="button"
                  className={`chip ${preferences.defaultSnoozeMinutes === minutes ? 'active' : ''}`}
                  onClick={() => {
                    setSnoozeInput(String(minutes));
                    void setDefaultSnoozeMinutes(minutes);
                  }}>
                  {minutes}m
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2>Account</h2>
          <div className="action-stack">
            <button type="button" className="action-pill muted wide" onClick={() => void signOut()}>
              <AppIcon name="log-out" size={16} />
              <span>Logout</span>
            </button>
            <button type="button" className="action-pill accent wide" onClick={() => setPasswordModalVisible(true)}>
              <AppIcon name="key-round" size={16} />
              <span>Change password</span>
            </button>
            <button type="button" className="action-pill danger wide" onClick={() => setDeleteModalVisible(true)}>
              <AppIcon name="trash-2" size={16} />
              <span>Delete account</span>
            </button>
          </div>
        </div>
      </section>

      {passwordModalVisible ? (
        <div className="overlay-layer">
          <div className="modal-backdrop" onClick={() => setPasswordModalVisible(false)} />
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Change Password</h3>
              <button type="button" className="icon-button subtle" onClick={() => setPasswordModalVisible(false)}>
                <AppIcon name="x" />
              </button>
            </div>
            <div className="form-stack">
              <label className="field">
                <span>New Password</span>
                <input type="password" value={passwordNew} onChange={event => setPasswordNew(event.target.value)} />
              </label>
              <label className="field">
                <span>Confirm Password</span>
                <input type="password" value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="action-pill muted" onClick={() => setPasswordModalVisible(false)}>
                Cancel
              </button>
              <button type="button" className="action-pill accent" disabled={changingPassword} onClick={() => void handlePasswordChange()}>
                {changingPassword ? 'Saving...' : 'Change password'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteModalVisible ? (
        <div className="overlay-layer">
          <div className="modal-backdrop" onClick={() => setDeleteModalVisible(false)} />
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Delete Account</h3>
              <button type="button" className="icon-button subtle" onClick={() => setDeleteModalVisible(false)}>
                <AppIcon name="x" />
              </button>
            </div>
            <div className="form-stack">
              <p className="settings-warning">
                This permanently deletes your account and all related data. This action cannot be undone.
              </p>
              <label className="field">
                <span>Password</span>
                <input type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="action-pill muted" onClick={() => setDeleteModalVisible(false)}>
                Cancel
              </button>
              <button type="button" className="action-pill danger" disabled={deletingAccount} onClick={() => void handleDeleteAccount()}>
                {deletingAccount ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
