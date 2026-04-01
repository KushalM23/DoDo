import React, {useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {AppIcon} from '@/components/common/AppIcon';
import {cx, tw} from '@/lib/tw';
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
    <div className="flex gap-2 rounded-full bg-surface p-1">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          className={cx(
            'min-h-[42px] flex-1 rounded-full bg-surface-light px-4 text-text transition hover:-translate-y-px',
            value === option.value && 'bg-accent text-white',
          )}
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
    <div className="grid items-start justify-items-center">
      <section className="w-full max-w-[840px] rounded-[28px] border border-border bg-surface p-6 shadow-[0_24px_60px_var(--shadow)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/profile" className="mb-4 inline-flex items-center gap-1.5 text-muted-text">
              <AppIcon name="chevron-left" size={18} />
              <span>Back to profile</span>
            </Link>
            <h1 className={tw.h1}>Settings</h1>
          </div>
          <button type="button" className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px" onClick={() => void resetPreferences()}>
            <AppIcon name="rotate-ccw" size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-[18px]">
          <h2 className={tw.h2}>Preferences</h2>

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

          <div className="grid gap-3 rounded-[22px] bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <strong>Snooze</strong>
              <div className="flex w-[112px] items-center gap-2 rounded-[18px] border border-border bg-surface-light pr-2">
                <input
                  className="min-h-[38px] flex-1 border-0 bg-transparent px-4 text-text outline-none"
                  value={snoozeInput}
                  onChange={event => setSnoozeInput(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                  onBlur={applyCustomSnoozeInput}
                />
                <span>min</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {SNOOZE_OPTIONS_MINUTES.map(minutes => (
                <button
                  key={minutes}
                  type="button"
                  className={cx(
                    'min-h-[42px] rounded-full bg-surface-light px-4 text-text transition hover:-translate-y-px',
                    preferences.defaultSnoozeMinutes === minutes && 'bg-accent text-white',
                  )}
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

        <div className="mt-6 grid gap-[18px]">
          <h2 className={tw.h2}>Account</h2>
          <div className="grid gap-3.5">
            <button type="button" className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-surface-light px-[18px] font-sans-bold text-text transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" onClick={() => void signOut()}>
              <AppIcon name="log-out" size={16} />
              <span>Logout</span>
            </button>
            <button type="button" className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-accent px-[18px] font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" onClick={() => setPasswordModalVisible(true)}>
              <AppIcon name="key-round" size={16} />
              <span>Change password</span>
            </button>
            <button type="button" className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-danger px-[18px] font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" onClick={() => setDeleteModalVisible(true)}>
              <AppIcon name="trash-2" size={16} />
              <span>Delete account</span>
            </button>
          </div>
        </div>
      </section>

      {passwordModalVisible ? (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setPasswordModalVisible(false)} />
          <div className="relative w-[min(100vw-32px,460px)] rounded-[28px] border border-border bg-surface p-[22px] shadow-[0_24px_60px_var(--shadow)]" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-4">
              <h3 className={tw.h2}>Change Password</h3>
              <button type="button" className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px" onClick={() => setPasswordModalVisible(false)}>
                <AppIcon name="x" />
              </button>
            </div>
            <div className="mt-4 grid gap-3.5">
              <label className="grid gap-2">
                <span className={tw.fieldLabel}>New Password</span>
                <input className={tw.fieldInput} type="password" value={passwordNew} onChange={event => setPasswordNew(event.target.value)} />
              </label>
              <label className="grid gap-2">
                <span className={tw.fieldLabel}>Confirm Password</span>
                <input className={tw.fieldInput} type="password" value={passwordConfirm} onChange={event => setPasswordConfirm(event.target.value)} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-surface-light px-[18px] font-sans-bold text-text transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" onClick={() => setPasswordModalVisible(false)}>
                Cancel
              </button>
              <button type="button" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-accent px-[18px] font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" disabled={changingPassword} onClick={() => void handlePasswordChange()}>
                {changingPassword ? 'Saving...' : 'Change password'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteModalVisible ? (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/80" onClick={() => setDeleteModalVisible(false)} />
          <div className="relative w-[min(100vw-32px,460px)] rounded-[28px] border border-border bg-surface p-[22px] shadow-[0_24px_60px_var(--shadow)]" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-4">
              <h3 className={tw.h2}>Delete Account</h3>
              <button type="button" className="inline-grid h-10 w-10 place-items-center rounded-full bg-surface-light text-text transition hover:-translate-y-px" onClick={() => setDeleteModalVisible(false)}>
                <AppIcon name="x" />
              </button>
            </div>
            <div className="mt-4 grid gap-3.5">
              <p className="m-0 text-muted-text">
                This permanently deletes your account and all related data. This action cannot be undone.
              </p>
              <label className="grid gap-2">
                <span className={tw.fieldLabel}>Password</span>
                <input className={tw.fieldInput} type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-surface-light px-[18px] font-sans-bold text-text transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" onClick={() => setDeleteModalVisible(false)}>
                Cancel
              </button>
              <button type="button" className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-danger px-[18px] font-sans-bold text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55" disabled={deletingAccount} onClick={() => void handleDeleteAccount()}>
                {deletingAccount ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

